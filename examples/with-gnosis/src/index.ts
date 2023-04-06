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
  if (!process.env.PRIVATE_KEY_ID) {
    // If you don't specify a `PRIVATE_KEY_ID`, we'll create one for you via calling the Turnkey API.
    await createNewEthereumPrivateKey();
    return;
  }

  // Initialize a Turnkey Signer
  const turnkeySigner = new TurnkeySigner({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    baseUrl: process.env.BASE_URL!,
    organizationId: process.env.ORGANIZATION_ID!,
    privateKeyId: process.env.PRIVATE_KEY_ID!,
  });

  // Bring your own provider (such as Alchemy or Infura: https://docs.ethers.org/v5/api/providers/)
  const network = "goerli";
  const provider = new ethers.providers.InfuraProvider(network);
  const connectedSigner = turnkeySigner.connect(provider);

  const chainId = await connectedSigner.getChainId();
  const address = await connectedSigner.getAddress();
  const balance = await connectedSigner.getBalance();
  const transactionCount = await connectedSigner.getTransactionCount();

  print("Network:", `${network} (chain ID ${chainId})`);
  print("Address:", address);
  print("Balance:", `${ethers.utils.formatEther(balance)} Ether`);
  print("Transaction count:", `${transactionCount}`);

  // Configure Gnosis
  const ethAdapter = new EthersAdapter({
    ethers,
    signerOrProvider: connectedSigner,
  });

  // Configure transaction
  const transactionAmount = "0.00001";
  const destinationAddress = "0x2Ad9eA1E677949a536A270CEC812D6e868C88108";
  const safeTransactionData: SafeTransactionDataPartial = {
    to: destinationAddress,
    value: ethers.utils.parseEther(transactionAmount).toString(),
    data: "0x",
  };

  // Create new Safe
  // const safeFactory = await SafeFactory.create({ ethAdapter });
  // const owners = [address];
  // const threshold = 1;
  // const safeAccountConfig: SafeAccountConfig = {
  //   owners,
  //   threshold,
  //   // ...
  // };
  // const safeSdk: Safe = await safeFactory.deploySafe({ safeAccountConfig });

  // connect to existing safe
  const safeSdk = await Safe.create({ ethAdapter: ethAdapter, safeAddress: "0xeB15EF3162123ACD1a9d88B911cBFaD9e4e59F17" })

  const safeAddress = safeSdk.getAddress();
  print("Gnosis Safe Address:", safeAddress);

  const safeTransaction = await safeSdk.createTransaction({
    safeTransactionData,
  });

  console.log('safe transaction', safeTransaction);

  // off-chain signature
  const signedSafeTransaction = await safeSdk.signTransaction(safeTransaction);
  console.log("Signed Safe Transaction:", signedSafeTransaction);

  // second signer, onchain
  // const ethAdapterOwner2 = new EthersAdapter({ ethers, signerOrProvider: owner2 })
  // const safeSdk2 = await safeSdk.connect({ ethAdapter: ethAdapterOwner2, safeAddress })
  // const txHash = await safeSdk2.getTransactionHash(safeTransaction)
  // const approveTxResponse = await safeSdk2.approveTransactionHash(txHash)
  // await approveTxResponse.transactionResponse?.wait()

  // third signer, onchain + execute transaction
  // const ethAdapterOwner3 = new EthersAdapter({
  //   ethers,
  //   signerOrProvider: owner3,
  // });
  // const safeSdk3 = await safeSdk2.connect({
  //   ethAdapter: ethAdapterOwner3,
  //   safeAddress,
  // });
  // const executeTxResponse = await safeSdk3.executeTransaction(safeTransaction);
  // await executeTxResponse.transactionResponse?.wait();

  if (balance.isZero()) {
    let warningMessage =
      "The transaction won't be broadcasted because your account balance is zero.\n";
    if (network === "goerli") {
      warningMessage +=
        "Use https://goerlifaucet.com/ to request funds on Goerli, then run the script again.\n";
    }

    console.warn(warningMessage);
    return;
  }

  if (network === "goerli") {
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function print(header: string, body: string): void {
  console.log(`${header}\n\t${body}\n`);
}
