import * as path from "path";
import * as dotenv from "dotenv";

import { createAccount } from "@turnkey/viem";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import {
  createWalletClient,
  http,
  recoverMessageAddress,
  type Account,
} from "viem";
import { sepolia } from "viem/chains";
import { print, assertEqual } from "../util";
import { createNewEthereumPrivateKey } from "./createNewEthereumPrivateKey";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  if (!process.env.SIGN_WITH) {
    // If you don't specify a `PRIVATE_KEY_ID`, we'll create one for you via calling the Turnkey API.
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

  const turnkeyAccount = await createAccount({
    client: turnkeyClient,
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  const client = createWalletClient({
    account: turnkeyAccount as Account,
    chain: sepolia,
    transport: http(
      `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY!}`
    ),
  });

  // This demo sends ETH back to our faucet (we keep a bunch of Sepolia ETH at this address)
  const turnkeyFaucet = "0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7";

  // 1. Simple send tx
  const transactionRequest = {
    to: turnkeyFaucet as `0x${string}`,
    value: 1000000000000000n,
  };

  let txHash = await client.sendTransaction(transactionRequest);

  print("Source address", client.account.address);
  print("Transaction", `https://sepolia.etherscan.io/tx/${txHash}`);

  // 2. Sign a simple message
  let address = client.account.address;
  let message = "Hello Turnkey";
  let signature = await client.signMessage({
    message,
  });
  let recoveredAddress = await recoverMessageAddress({
    message,
    signature,
  });

  print("Turnkey-powered signature:", `${signature}`);
  print("Recovered address:", `${recoveredAddress}`);
  assertEqual(address, recoveredAddress);

  // 3. Sign and broadcast tx separately
  const preparedTransaction = await client.prepareTransactionRequest({
    ...transactionRequest,
    type: "eip1559",
  });
  const signedTransaction = await client.signTransaction(preparedTransaction);

  txHash = await client.sendRawTransaction({
    serializedTransaction: signedTransaction,
  });

  print("Signed transaction", signedTransaction);
  print("Broadcasted transaction", `https://sepolia.etherscan.io/tx/${txHash}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
