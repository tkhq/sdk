import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeySigner } from "@turnkey/ethers";
import { ethers } from "ethers";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import Safe, {
  EthersAdapter,
  SafeFactory,
  SafeAccountConfig,
} from "@safe-global/protocol-kit";
import type { SafeTransactionDataPartial } from "@safe-global/safe-core-sdk-types";
import { createNewEthereumPrivateKey } from "./createNewEthereumPrivateKey";
import { print } from "./util";

async function main() {
  if (
    !(
      process.env.SIGN_WITH_1 &&
      process.env.SIGN_WITH_2 &&
      process.env.SIGN_WITH_3
    )
  ) {
    // You're missing a private key ID. We'll create one for you via calling the Turnkey API.
    console.log("One or more local private keys not found.");
    await createNewEthereumPrivateKey();
    return;
  }

  const turnkeyClient = new TurnkeyClient(
    {
      baseUrl: process.env.BASE_URL!,
    },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    })
  );

  // Initialize a Turnkey Signer
  const turnkeySigner1 = new TurnkeySigner({
    client: turnkeyClient,
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH_1!,
  });

  const turnkeySigner2 = new TurnkeySigner({
    client: turnkeyClient,
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH_2!,
  });

  const turnkeySigner3 = new TurnkeySigner({
    client: turnkeyClient,
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH_3!,
  });

  // Bring your own provider (for the sake of this demo, we recommend using Sepolia + Infura)
  const network = "sepolia";
  const provider = new ethers.InfuraProvider(network);

  const connectedSigner1 = turnkeySigner1.connect(provider);
  const connectedSigner2 = turnkeySigner2.connect(provider);
  const connectedSigner3 = turnkeySigner3.connect(provider);

  for (let signer of [connectedSigner1, connectedSigner2, connectedSigner3]) {
    const address = await signer.getAddress();
    const balance = (await signer.provider?.getBalance(address)) ?? 0;
    const transactionCount = await signer.provider?.getTransactionCount(
      address
    );

    print("Address:", address);
    print("Balance:", `${ethers.formatEther(balance)} ETH`);
    print("Transaction count:", `${transactionCount}`);

    if (balance === 0) {
      let warningMessage = `The transaction won't be broadcasted because the balance for address ${address} is zero.\n`;
      if (network === "sepolia") {
        warningMessage +=
          "Use https://sepoliafaucet.com/ to request funds on Sepolia, then run the script again.\n";
      }

      console.warn(warningMessage);
      return;
    }
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
    value: ethers.parseEther(transactionAmount).toString(),
    data: "0x",
  };

  // Create new Safe using address 1
  const safeFactory = await SafeFactory.create({ ethAdapter: ethAdapter1 });
  const owners = [
    await connectedSigner1.getAddress(),
    await connectedSigner2.getAddress(),
    await connectedSigner3.getAddress(),
  ];
  const threshold = 3;
  const safeAccountConfig: SafeAccountConfig = {
    owners,
    threshold,
    // ... other options
  };

  const safeSdk1: Safe = await safeFactory.deploySafe({ safeAccountConfig });
  const safeAddress = await safeSdk1.getAddress();
  print("New Gnosis Safe Address:", safeAddress);

  // Have other signers connect to deployed Safe
  const safeSdk2 = await safeSdk1.connect({
    ethAdapter: ethAdapter2,
    safeAddress,
  });

  // Alternative method to connecting to a precreated Safe
  const safeSdk3 = await Safe.create({
    ethAdapter: ethAdapter3,
    safeAddress,
  });

  // Fund the safe using signer 1
  const fundingRequest = {
    to: safeAddress,
    value: ethers.parseEther(transactionAmount),
    type: 2,
  };
  const sentTx = await connectedSigner1.sendTransaction(fundingRequest);
  print(
    `Funding the safe: sent ${ethers.formatEther(sentTx.value)} ETH to ${
      sentTx.to
    }:`,
    `https://${network}.etherscan.io/tx/${sentTx.hash}`
  );

  // Create Safe transaction using signer 1
  let safeTransaction = await safeSdk1.createTransaction({
    transactions: [safeTransactionData],
  });

  // Obtain *offchain* signature from signer 1 using EIP-712
  let txHash = await safeSdk1.getTransactionHash(safeTransaction);
  safeTransaction = await safeSdk1.signTransaction(
    safeTransaction,
    "eth_signTypedData"
  );
  print(
    `Signed transaction offchain using signer 1. Signature:`,
    safeTransaction.signatures.get(
      (await connectedSigner1.getAddress()).toLowerCase()
    )?.data ?? ""
  );

  // Approve safe transaction *offchain* with Signer 2
  safeTransaction = await safeSdk2.signTransaction(safeTransaction);
  print(
    `Signed transaction offchain using signer 2. Signature:`,
    safeTransaction.signatures.get(
      (await connectedSigner2.getAddress()).toLowerCase()
    )?.data ?? ""
  );

  // Obtain *onchain* signature from signer 3.
  // This is technically redundant given this signer will go on to execute the transaction,
  // but is left in for demonstration purposes.
  txHash = await safeSdk3.getTransactionHash(safeTransaction);
  let approveTxResponse = await safeSdk3.approveTransactionHash(txHash);
  await approveTxResponse.transactionResponse?.wait();
  print(
    `Approved transaction onchain using signer 3. Etherscan link:`,
    `https://${network}.etherscan.io/tx/${approveTxResponse.hash}`
  );

  // Execute transaction using signer 3
  const executeTxResponse = await safeSdk3.executeTransaction(safeTransaction);
  await executeTxResponse.transactionResponse?.wait();
  print(
    `Executed transaction. Etherscan link:`,
    `https://${network}.etherscan.io/tx/${executeTxResponse.hash}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
