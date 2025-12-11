import { ethers } from "ethers";
import { getProvider, getTurnkeySigner, getTurnkeyClientForSubOrg } from "./provider";
import { ERC20_ABI, USDC_DECIMALS, toReadableAmount, fromReadableAmount, formatAddress } from "./utils";

export interface SweepResult {
  success: boolean;
  amount: string;
  transactionHash?: string;
  error?: string;
}

/**
 * Sweeps USDC from a merchant wallet to the treasury wallet
 * 
 * IMPORTANT: The merchant wallet pays for gas fees. The transaction is signed
 * by the merchant wallet's private key, so ETH must be available in the merchant
 * wallet to cover gas costs.
 * 
 * NOTE: The sweep threshold is enforced at the application level because Turnkey's
 * policy language doesn't support parsing hex strings to numbers for comparison.
 * The policy enforces: USDC-only transfers to treasury wallet only.
 */
export async function sweepUSDC(
  merchantAddress: string,
  merchantSubOrgId: string,
  merchantWalletId: string,
  treasuryAddress: string,
  usdcTokenAddress: string,
  network: string = "sepolia",
): Promise<SweepResult> {
  const provider = getProvider(network);
  
  // Create a Turnkey client configured for the sub-organization
  // This is critical - the client must use sub-org ID as default to properly resolve wallets
  const turnkeyClient = getTurnkeyClientForSubOrg(merchantSubOrgId);
  let signWith = merchantAddress;
  
  try {
    // Get wallet details to find the correct signing identifier
    // Using sub-org client ensures proper authentication context
    const wallet = await turnkeyClient.apiClient().getWallet({
      organizationId: merchantSubOrgId,
      walletId: merchantWalletId,
    });
    
    console.log(`   Wallet query successful`);
    
    // Try to get private key IDs from accounts (most reliable)
    const walletData = wallet.wallet as any;
    if (walletData?.accounts && Array.isArray(walletData.accounts) && walletData.accounts.length > 0) {
      const ethAccount = walletData.accounts.find(
        (acc: any) => acc.addressFormat === "ADDRESS_FORMAT_ETHEREUM"
      );
      
      if (ethAccount?.privateKeyId) {
        signWith = ethAccount.privateKeyId;
        console.log(`   Using private key ID from account: ${signWith}`);
      } else if (ethAccount?.address) {
        // Use the exact address from the wallet response
        signWith = ethAccount.address;
        console.log(`   Using exact address from wallet account: ${signWith}`);
      }
    }
    // Fallback: try wallet addresses array
    else if (walletData?.addresses && Array.isArray(walletData.addresses) && walletData.addresses.length > 0) {
      signWith = walletData.addresses[0];
      console.log(`   Using exact address from wallet: ${signWith}`);
    }
    else {
      // Final fallback to provided address (checksummed)
      signWith = ethers.getAddress(merchantAddress);
      console.log(`   Using checksummed address: ${signWith}`);
    }
  } catch (error: any) {
    // If wallet query fails, use checksummed address
    console.log(`   Could not query wallet: ${error.message}`);
    signWith = ethers.getAddress(merchantAddress);
    console.log(`   Using checksummed address: ${signWith}`);
  }
  
  // Create signer using the sub-organization client
  const signer = getTurnkeySigner(provider, merchantSubOrgId, signWith, turnkeyClient);

  // IMPORTANT: Check if merchant wallet has ETH for gas fees
  // The merchant wallet pays for gas since it's signing the transaction
  let merchantEthBalance: bigint;
  try {
    merchantEthBalance = await provider.getBalance(merchantAddress);
    const ethBalanceReadable = ethers.formatEther(merchantEthBalance);
    console.log(`   Merchant wallet ETH balance: ${ethBalanceReadable} ETH`);
    
    // Estimate if balance is sufficient (rough check - 0.001 ETH should be enough for most transactions)
    if (merchantEthBalance < ethers.parseEther("0.001")) {
      return {
        success: false,
        amount: "0",
        error: `Insufficient ETH for gas fees. Merchant wallet has ${ethBalanceReadable} ETH but needs at least ~0.001 ETH for gas. Please fund the merchant wallet with ETH.`,
      };
    }
  } catch (error: any) {
    // If we can't check ETH balance, proceed with warning
    console.log(`   [WARNING] Could not check ETH balance: ${error.message}`);
    console.log(`   Proceeding with sweep, but transaction may fail if insufficient ETH for gas.`);
  }

  // Get USDC contract instance
  const usdcContract = new ethers.Contract(usdcTokenAddress, ERC20_ABI, signer);

  // Check balance - handle errors gracefully
  let balance: bigint;
  try {
    const balanceOfFn = usdcContract.balanceOf;
    if (!balanceOfFn) {
      return {
        success: false,
        amount: "0",
        error: "USDC contract does not have balanceOf function",
      };
    }
    const balanceResult = await balanceOfFn(merchantAddress);
    balance = balanceResult ?? 0n;
  } catch (error: any) {
    // If contract call fails, it might mean the contract doesn't exist or there's an RPC issue
    return {
      success: false,
      amount: "0",
      error: `Unable to check balance: ${error.message || "Contract call failed"}`,
    };
  }

  if (balance === 0n) {
    return {
      success: false,
      amount: "0",
      error: "No USDC balance to sweep",
    };
  }

  // Check if balance meets the threshold (enforced at application level)
  // Note: Turnkey policy language doesn't support parsing hex strings to numbers,
  // so threshold enforcement happens here instead of in the policy
  const sweepThresholdUSDC = parseFloat(process.env.SWEEP_THRESHOLD_USDC || "0.03");
  const thresholdRaw = fromReadableAmount(sweepThresholdUSDC.toString(), USDC_DECIMALS);
  
  if (balance < thresholdRaw) {
    const readableBalance = toReadableAmount(balance, USDC_DECIMALS);
    return {
      success: false,
      amount: readableBalance,
      error: `Balance ${readableBalance} USDC is below threshold of ${sweepThresholdUSDC} USDC`,
    };
  }

  const readableBalance = toReadableAmount(balance, USDC_DECIMALS);

  console.log(
    `\nMerchant wallet ${formatAddress(merchantAddress)} has ${readableBalance} USDC`,
  );
  console.log(`Sweeping to treasury ${formatAddress(treasuryAddress)}...`);
  console.log(`[NOTE] Gas fees will be paid by the merchant wallet (${formatAddress(merchantAddress)})`);
  console.log(`[NOTE] Threshold check: ${readableBalance} USDC >= ${sweepThresholdUSDC} USDC ✓`);

  try {
    // Transfer all USDC to treasury
    const transferFn = usdcContract.transfer;
    if (!transferFn) {
      return {
        success: false,
        amount: readableBalance,
        error: "USDC contract does not have transfer function",
      };
    }
    const transferTx = await transferFn(treasuryAddress, balance) as ethers.ContractTransactionResponse;

    console.log(`Transaction sent: ${transferTx.hash}`);
    console.log(`Waiting for confirmation...`);

    // Wait for 1 block confirmation
    const receipt = await provider.waitForTransaction(transferTx.hash, 1);

    if (receipt && receipt.status === 1) {
      return {
        success: true,
        amount: readableBalance,
        transactionHash: transferTx.hash,
      };
    } else {
      return {
        success: false,
        amount: readableBalance,
        error: "Transaction failed",
      };
    }
  } catch (error: any) {
    return {
      success: false,
      amount: readableBalance,
      error: error.message || "Unknown error during transfer",
    };
  }
}

