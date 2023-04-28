import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeySigner } from "@turnkey/ethers";
import { ethers } from "ethers";
import EthersAdapter from "@safe-global/safe-ethers-lib";
import Safe, {
  SafeFactory,
  SafeAccountConfig,
} from "@safe-global/safe-core-sdk";
import type { SafeTransactionDataPartial } from "@safe-global/safe-core-sdk-types";
import { createNewEthereumPrivateKey } from "./createNewEthereumPrivateKey";

async function main() {
  if (
    !(
      process.env.PRIVATE_KEY_ID_1 &&
      process.env.PRIVATE_KEY_ID_2 &&
      process.env.PRIVATE_KEY_ID_3
    )
  ) {
    // You're missing a private key ID. We'll create one for you via calling the Turnkey API.
    await createNewEthereumPrivateKey();
    return;
  }

  // Initialize a Turnkey Signer
  const turnkeySigner1 = new TurnkeySigner({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    baseUrl: process.env.BASE_URL!,
    organizationId: process.env.ORGANIZATION_ID!,
    privateKeyId: process.env.PRIVATE_KEY_ID_1!,
  });

  const turnkeySigner2 = new TurnkeySigner({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    baseUrl: process.env.BASE_URL!,
    organizationId: process.env.ORGANIZATION_ID!,
    privateKeyId: process.env.PRIVATE_KEY_ID_2!,
  });

  const turnkeySigner3 = new TurnkeySigner({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    baseUrl: process.env.BASE_URL!,
    organizationId: process.env.ORGANIZATION_ID!,
    privateKeyId: process.env.PRIVATE_KEY_ID_3!,
  });

  // Bring your own provider (such as Alchemy or Infura: https://docs.ethers.org/v5/api/providers/)
  const network = "sepolia";
  const provider = new ethers.providers.InfuraProvider(network);

  const connectedSigner1 = turnkeySigner1.connect(provider);
  const address1 = await connectedSigner1.getAddress();
  const balance1 = await connectedSigner1.getBalance();
  const transactionCount1 = await connectedSigner1.getTransactionCount();

  print("Address 1:", address1);
  print("Balance 1:", `${ethers.utils.formatEther(balance1)} Ether`);
  print("Transaction count 1:", `${transactionCount1}`);

  const connectedSigner2 = turnkeySigner2.connect(provider);
  const address2 = await connectedSigner2.getAddress();
  const balance2 = await connectedSigner2.getBalance();
  const transactionCount2 = await connectedSigner2.getTransactionCount();

  print("Address 2:", address2);
  print("Balance 2:", `${ethers.utils.formatEther(balance2)} Ether`);
  print("Transaction count 2:", `${transactionCount2}`);

  const connectedSigner3 = turnkeySigner3.connect(provider);
  const address3 = await connectedSigner3.getAddress();
  const balance3 = await connectedSigner3.getBalance();
  const transactionCount3 = await connectedSigner3.getTransactionCount();

  print("Address 3:", address3);
  print("Balance 3:", `${ethers.utils.formatEther(balance3)} Ether`);
  print("Transaction count 3:", `${transactionCount3}`);

  if (balance1.isZero() || balance2.isZero() || balance3.isZero()) {
    let warningMessage =
      "The transaction won't be broadcasted because your account balance is zero.\n";
    if (network === "sepolia") {
      warningMessage +=
        "Use https://sepoliafaucet.com/ to request funds on Sepolia, then run the script again.\n";
    }

    console.warn(warningMessage);
    return;
  }

  // Configure Gnosis Safe
  const ethAdapter1 = new EthersAdapter({
    ethers,
    signerOrProvider: connectedSigner1,
  });
  const ethAdapter2 = new EthersAdapter({
    ethers,
    signerOrProvider: connectedSigner2,
  });
  const ethAdapter3 = new EthersAdapter({
    ethers,
    signerOrProvider: connectedSigner3,
  });

  // Configure Safe transaction
  const transactionAmount = "0.00001";
  const destinationAddress = "0x2Ad9eA1E677949a536A270CEC812D6e868C88108";
  const safeTransactionData: SafeTransactionDataPartial = {
    to: destinationAddress,
    value: ethers.utils.parseEther(transactionAmount).toString(),
    data: "0x",
  };

  // Create new Safe using address 1
  const safeFactory = await SafeFactory.create({ ethAdapter: ethAdapter1 });
  const owners = [address1, address2, address3];
  const threshold = 3;
  const safeAccountConfig: SafeAccountConfig = {
    owners,
    threshold,
    // ... other options
  };

  const safeSdk1: Safe = await safeFactory.deploySafe({ safeAccountConfig });
  const safeAddress = safeSdk1.getAddress();
  print("New Gnosis Safe Address:", safeAddress);

  // Have other signers connect to deployed Safe
  const safeSdk2 = await safeSdk1.connect({
    ethAdapter: ethAdapter2,
    safeAddress,
  });
  const safeSdk3 = await Safe.create({
    ethAdapter: ethAdapter3,
    safeAddress,
  });

  // Fund the safe using signer 1
  const fundingRequest = {
    to: safeAddress,
    value: ethers.utils.parseEther(transactionAmount),
    type: 2,
  };
  const sentTx = await connectedSigner1.sendTransaction(fundingRequest);
  print(
    `Sent ${ethers.utils.formatEther(sentTx.value)} Ether to ${sentTx.to}:`,
    `https://${network}.etherscan.io/tx/${sentTx.hash}`
  );

  // Create Safe transaction using signer 1
  const safeTransaction = await safeSdk1.createTransaction({
    safeTransactionData,
  });

  // Obtain *offchain* signature from signer 1 and attach it to the safeTransaction
  let txHash = await safeSdk1.getTransactionHash(safeTransaction);
  let signature = await safeSdk1.signTransactionHash(txHash);
  print(
    `Signed transaction offchain using signer 1:`, signature.data
  );
  safeTransaction.addSignature(signature);

  // Obtain onchain signature from signer 2
  txHash = await safeSdk2.getTransactionHash(safeTransaction);
  let approveTxResponse = await safeSdk2.approveTransactionHash(txHash);
  await approveTxResponse.transactionResponse?.wait();
  print(
    `Approved transaction using signer 2:`,
    `https://${network}.etherscan.io/tx/${approveTxResponse.hash}`
  );

  // Obtain onchain signature from signer 3.
  // This is technically redundant given this signer will go on to execute the transaction,
  // but is left in for demonstration purposes.
  txHash = await safeSdk3.getTransactionHash(safeTransaction);
  approveTxResponse = await safeSdk3.approveTransactionHash(txHash);
  await approveTxResponse.transactionResponse?.wait();
  print(
    `Approved transaction using signer 3:`,
    `https://${network}.etherscan.io/tx/${approveTxResponse.hash}`
  );

  // Execute transaction using last signer
  const executeTxResponse = await safeSdk3.executeTransaction(safeTransaction);
  await executeTxResponse.transactionResponse?.wait();
  print(
    `Executed transaction using signer 3:`,
    `https://${network}.etherscan.io/tx/${executeTxResponse.hash}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function print(header: string, body: string): void {
  console.log(`${header}\n\t${body}\n`);
}
