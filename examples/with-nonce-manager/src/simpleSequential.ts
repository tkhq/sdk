import * as path from "path";
import * as dotenv from "dotenv";
import { ethers } from "ethers";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeySigner } from "@turnkey/ethers";
import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";

import { createNewEthereumWallet } from "./createNewWallet";
import { print } from "./util";

async function main() {
  if (!process.env.SIGN_WITH) {
    // If you don't specify a `SIGN_WITH`, we'll create a new wallet for you via calling the Turnkey API.
    await createNewEthereumWallet();
    return;
  }

  const turnkeyClient = new TurnkeySDKServer({
    apiBaseUrl: "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  // Initialize a Turnkey Signer
  const turnkeySigner = new TurnkeySigner({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  // Bring your own provider (such as Alchemy or Infura: https://docs.ethers.org/v6/api/providers/)
  const network = "goerli";
  const provider = new ethers.InfuraProvider(network);
  const connectedSigner = turnkeySigner.connect(provider);

  const chainId = (await connectedSigner.provider?.getNetwork())?.chainId ?? 0n;
  const address = await connectedSigner.getAddress();
  const balance = (await connectedSigner.provider?.getBalance(address)) ?? 0n;
  const transactionCount =
    (await connectedSigner.provider?.getTransactionCount(address)) ?? 0;

  print("Network:", `${network} (chain ID ${chainId})`);
  print("Address:", address);
  print("Balance:", `${ethers.formatEther(balance)} Ether`);
  print("Transaction count:", `${transactionCount}`);

  if (balance === 0n) {
    let warningMessage =
      "The transactions won't be broadcasted because your account balance is zero.\n";
    if (network === "goerli") {
      warningMessage +=
        "Use https://goerlifaucet.com/ to request funds on Goerli, then run the script again.\n";
    }

    console.warn(warningMessage);
    return;
  }

  // Create 5 simple send transactions sequentially in a blocking manner
  for (let i = 0; i < 5; i++) {
    const transactionAmount = "0";
    const destinationAddress = "0x2Ad9eA1E677949a536A270CEC812D6e868C88108";
    const transactionRequest = {
      to: destinationAddress,
      value: ethers.parseEther(transactionAmount),
      type: 2,
      nonce: transactionCount + i, // manually specify the nonce
    };

    const sendTx = await connectedSigner.sendTransaction(transactionRequest);

    print(
      `Sent ${ethers.formatEther(sendTx.value)} Ether to ${sendTx.to}:`,
      `https://${network}.etherscan.io/tx/${sendTx.hash}`
    );

    // Wait for a block confirmation before proceeding
    await connectedSigner.provider?.waitForTransaction(sendTx.hash, 1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
