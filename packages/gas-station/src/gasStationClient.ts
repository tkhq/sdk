import {
  encodeFunctionData,
  type SignedAuthorization,
  type PublicClient,
  type WalletClient,
  type Account,
  type Chain,
  type Transport,
} from "viem";
import { gasStationAbi } from "./abi/gas-station";
import type { GasStationConfig, ExecutionIntent } from "./config";
import {
  DEFAULT_DELEGATE_CONTRACT,
  DEFAULT_EXECUTION_CONTRACT,
} from "./config";
import { IntentBuilder } from "./intentBuilder";
import {
  createPublicClientForChain,
  packExecutionData,
  packExecutionDataNoValue,
} from "./gasStationUtils";

export class GasStationClient {
  private walletClient: WalletClient<Transport, Chain, Account>;
  private publicClient: PublicClient;
  private delegateContract: `0x${string}`;
  private executionContract: `0x${string}`;

  constructor(config: GasStationConfig) {
    this.walletClient = config.walletClient;
    this.publicClient = createPublicClientForChain(
      config.walletClient.chain,
      config.walletClient.transport.url!,
    );
    this.delegateContract =
      config.delegateContract ?? DEFAULT_DELEGATE_CONTRACT;
    this.executionContract =
      config.executionContract ?? DEFAULT_EXECUTION_CONTRACT;
  }

  /**
   * Sign an EIP-7702 authorization to delegate control to the gas station contract
   * Call this with an end-user client to get a signed authorization
   * The authorization can then be submitted by the paymaster using submitAuthorization()
   */
  async signAuthorization(): Promise<SignedAuthorization> {
    const authorization = await this.walletClient.signAuthorization({
      contractAddress: this.delegateContract,
      account: this.walletClient.account,
      chainId: 0, // 0 means valid on any EIP-7702 compatible chain
    });

    return authorization as SignedAuthorization;
  }

  /**
   * Submit a signed EIP-7702 authorization transaction
   * Call this with a paymaster client to broadcast the authorization transaction
   * The paymaster pays for the gas
   */
  async submitAuthorization(
    authorization: SignedAuthorization,
  ): Promise<{ txHash: `0x${string}`; blockNumber: bigint }> {
    const authTxHash = await this.walletClient.sendTransaction({
      from: "0x0000000000000000000000000000000000000000",
      gas: BigInt(200000),
      authorizationList: [authorization],
      to: "0x0000000000000000000000000000000000000000",
      type: "eip7702",
      account: this.walletClient.account,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: authTxHash,
    });

    if (receipt.status !== "success") {
      // Try to get the revert reason if available
      const revertReason = await this.getRevertReason(authTxHash);
      throw new Error(
        `Authorization failed: ${revertReason || "Transaction reverted"}. ` +
          `Gas used: ${receipt.gasUsed}/${receipt.cumulativeGasUsed}. ` +
          `Transaction hash: ${authTxHash}`,
      );
    }

    return { txHash: authTxHash, blockNumber: receipt.blockNumber };
  }

  /**
   * Convenience method that combines signAuthorization and submitAuthorization
   * This requires the caller to have access to both the end-user and paymaster clients
   * For separate flows, use signAuthorization() and submitAuthorization() directly
   */
  async authorize(
    paymasterClient: GasStationClient,
  ): Promise<{ txHash: `0x${string}`; blockNumber: bigint }> {
    // End user signs the authorization
    const authorization = await this.signAuthorization();

    // Paymaster submits the transaction
    const result = await paymasterClient.submitAuthorization(authorization);

    // Verify the delegation took effect by polling isDelegated
    const maxRetries = 10;
    let retries = 0;
    while (retries < maxRetries) {
      const delegated = await this.isDelegated();
      if (delegated) {
        break;
      }
      retries++;
      if (retries === maxRetries) {
        throw new Error(
          "Delegation verification failed - account code not set after authorization",
        );
      }
      // Wait 1 second before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return result;
  }

  /**
   * Check if an EOA has delegated control to the gas station contract
   * If no address is provided, uses the signer's address
   */
  async isDelegated(eoaAddress?: `0x${string}`): Promise<boolean> {
    const address = eoaAddress ?? this.walletClient.account.address;

    const isDelegated = await this.publicClient.readContract({
      address: this.executionContract,
      abi: gasStationAbi,
      functionName: "isDelegated",
      args: [address],
    });

    return isDelegated as boolean;
  }

  /**
   * Get the current nonce for an EOA address from the gas station contract
   * If no address is provided, uses the signer's address
   */
  async getNonce(eoaAddress?: `0x${string}`): Promise<bigint> {
    const address = eoaAddress ?? this.walletClient.account.address;

    const nonce = await this.publicClient.readContract({
      address: this.executionContract,
      abi: gasStationAbi,
      functionName: "getNonce",
      args: [address],
    });

    return nonce as bigint;
  }

  /**
   * Attempts to get the revert reason from a failed transaction.
   * Replays the transaction via eth_call to extract detailed error information.
   *
   * This helps surface on-chain failure reasons such as:
   * - Out of gas errors
   * - Revert with reason strings
   * - Custom error selectors
   * - Insufficient balance errors
   */
  private async getRevertReason(txHash: `0x${string}`): Promise<string | null> {
    try {
      const tx = await this.publicClient.getTransaction({ hash: txHash });

      // Replay the transaction via eth_call to trigger the revert and get the reason
      await this.publicClient.call({
        to: tx.to,
        data: tx.input,
        gas: tx.gas,
        value: tx.value,
      });

      // If call succeeds, we don't have a revert reason (shouldn't happen for failed tx)
      return null;
    } catch (error: any) {
      // Extract revert reason from error message
      if (error?.details) {
        return error.details;
      }
      if (error?.message) {
        // Check for out of gas errors
        const outOfGasMatch = error.message.match(/out of gas/i);
        if (outOfGasMatch) {
          return "Out of gas";
        }

        // Check for standard revert with reason string
        const revertMatch = error.message.match(
          /reverted with reason string '([^']+)'/,
        );
        if (revertMatch) {
          return revertMatch[1];
        }

        // Check for custom errors (Solidity 0.8.4+)
        const customErrorMatch = error.message.match(
          /reverted with the following \(custom\) error:\s*([^\n]+)/,
        );
        if (customErrorMatch) {
          return customErrorMatch[1];
        }

        // Return the full error message if no specific pattern matches
        return error.message;
      }

      return null;
    }
  }

  /**
   * Create an intent builder for composing complex transactions
   * Call this with an end-user client to create intents for signing
   */
  createIntent(): IntentBuilder {
    if (!this.walletClient.account?.address) {
      throw new Error(
        `Wallet client account is not properly configured. Account: ${JSON.stringify(this.walletClient.account)}`,
      );
    }
    return IntentBuilder.create({
      eoaWalletClient: this.walletClient,
      chainId: this.walletClient.chain.id,
      eoaAddress: this.walletClient.account.address,
      nonceType: "uint128",
    });
  }

  /**
   * Sign an execution transaction for a signed intent (paymaster signs, doesn't send)
   * This is useful for testing policies - the paymaster attempts to sign the execution
   * but doesn't actually broadcast it to the network.
   * Call this with a paymaster client to test if the paymaster can sign the execution.
   */
  async signExecution(intent: ExecutionIntent): Promise<`0x${string}`> {
    // Pack the execution data based on whether we're sending ETH
    const packedData =
      intent.ethAmount > 0n
        ? packExecutionData(
            intent.signature,
            intent.nonce,
            intent.outputContract,
            intent.ethAmount,
            intent.callData,
          )
        : packExecutionDataNoValue(
            intent.signature,
            intent.nonce,
            intent.outputContract,
            intent.callData,
          );

    // Determine which function to call based on ETH amount
    const functionName = intent.ethAmount > 0n ? "execute" : "executeNoValue";

    // Encode the function call data
    const callData = encodeFunctionData({
      abi: gasStationAbi,
      functionName,
      args: [intent.eoaAddress, packedData],
    });

    // Sign the transaction without sending it
    const signedTx = await this.walletClient.signTransaction({
      to: this.executionContract,
      data: callData,
      gas: BigInt(200000),
      type: "eip1559",
      account: this.walletClient.account,
      chain: this.walletClient.chain,
    });

    return signedTx;
  }

  /**
   * Execute a signed intent through the gas station contract.
   * Packs the execution data according to the delegate contract's expected format and
   * submits it via the execution contract.
   * Call this with a paymaster client to submit and pay for the transaction.
   */
  async execute(
    intent: ExecutionIntent,
  ): Promise<{ txHash: `0x${string}`; blockNumber: bigint; gasUsed: bigint }> {
    // Pack the execution data based on whether we're sending ETH
    const packedData =
      intent.ethAmount > 0n
        ? packExecutionData(
            intent.signature,
            intent.nonce,
            intent.outputContract,
            intent.ethAmount,
            intent.callData,
          )
        : packExecutionDataNoValue(
            intent.signature,
            intent.nonce,
            intent.outputContract,
            intent.callData,
          );

    // Determine which function to call based on ETH amount
    const functionName = intent.ethAmount > 0n ? "execute" : "executeNoValue";

    const txHash = await this.walletClient.sendTransaction({
      to: this.executionContract,
      data: encodeFunctionData({
        abi: gasStationAbi,
        functionName,
        args: [intent.eoaAddress, packedData],
      }),
      gas: BigInt(200000),
      account: this.walletClient.account,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (receipt.status !== "success") {
      // Try to get the revert reason if available
      const revertReason = await this.getRevertReason(txHash);
      throw new Error(
        `Execution failed: ${revertReason || "Transaction reverted"}. ` +
          `Gas used: ${receipt.gasUsed}/${receipt.cumulativeGasUsed}. ` +
          `Transaction hash: ${txHash}`,
      );
    }

    return {
      txHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
    };
  }
}
