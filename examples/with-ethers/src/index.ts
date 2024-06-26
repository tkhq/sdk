import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeySigner } from "@turnkey/ethers";
import { ethers } from "ethers";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createNewWallet } from "./createNewWallet";
import { print, assertEqual } from "./util";
import WETH_TOKEN_ABI from "./weth-contract-abi.json";

const WETH_TOKEN_ADDRESS_SEPOLIA = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";

async function main() {
  if (!process.env.SIGN_WITH) {
    // If you don't specify a `SIGN_WITH`, we'll create a new wallet for you via calling the Turnkey API.
    await createNewWallet();
    return;
  }

  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  // Initialize a Turnkey Signer
  const turnkeySigner = new TurnkeySigner({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  // Bring your own provider (such as Alchemy or Infura: https://docs.ethers.org/v6/api/providers/)
  const network = "sepolia";
  const provider = new ethers.JsonRpcProvider(
    `https://${network}.infura.io/v3/${process.env.INFURA_KEY}`
  );
  const connectedSigner = turnkeySigner.connect(provider);

  const chainId = (await connectedSigner.provider?.getNetwork())?.chainId ?? 0;
  const address = await connectedSigner.getAddress();
  const balance = (await connectedSigner.provider?.getBalance(address)) ?? 0;
  const transactionCount = await connectedSigner.provider?.getTransactionCount(
    address
  );

  print("Network:", `${network} (chain ID ${chainId})`);
  print("Address:", address);
  print("Balance:", `${ethers.formatEther(balance)} Ether`);
  print("Transaction count:", `${transactionCount}`);

  // 1. Sign a raw payload (`eth_sign` style)
  const message = "Hello Turnkey";
  const signature = await connectedSigner.signMessage(message);
  const recoveredAddress = ethers.verifyMessage(message, signature);

  print("Turnkey-powered signature:", `${signature}`);
  print("Recovered address:", `${recoveredAddress}`);
  assertEqual(recoveredAddress, address);

  // Create a simple send transaction
  const transactionAmount = "0.00001";
  const destinationAddress = "0x2Ad9eA1E677949a536A270CEC812D6e868C88108";
  const transactionRequest = {
    to: destinationAddress,
    value: ethers.parseEther(transactionAmount),
    type: 2,
  };

  const signedTx = await connectedSigner.signTransaction(transactionRequest);

  print("Turnkey-signed transaction:", `${signedTx}`);

  if (balance === 0) {
    let warningMessage =
      "The transaction won't be broadcasted because your account balance is zero.\n";
    if (network === "sepolia") {
      warningMessage +=
        "Use https://sepoliafaucet.com/ to request funds on Sepolia, then run the script again.\n";
    }

    console.warn(warningMessage);
    return;
  }

  // 2. Simple send tx
  const sentTx = await connectedSigner.sendTransaction(transactionRequest);

  print(
    `Sent ${ethers.formatEther(sentTx.value)} Ether to ${sentTx.to}:`,
    `https://${network}.etherscan.io/tx/${sentTx.hash}`
  );

  if (network === "sepolia") {
    // https://sepolia.etherscan.io/address/0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6
    const wethContract = new ethers.Contract(
      WETH_TOKEN_ADDRESS_SEPOLIA,
      WETH_TOKEN_ABI,
      connectedSigner
    );

    // Read from contract
    const wethBalance = await wethContract?.balanceOf?.(address);

    print("WETH Balance:", `${ethers.formatEther(wethBalance)} WETH`);

    // 3. Wrap ETH -> WETH
    const depositTx = await wethContract?.deposit?.({
      value: ethers.parseEther(transactionAmount),
    });

    print(
      `Wrapped ${ethers.formatEther(depositTx.value)} ETH:`,
      `https://${network}.etherscan.io/tx/${depositTx.hash}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
