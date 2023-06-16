import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { toHex } from "@cosmjs/encoding";
import { SigningStargateClient } from "@cosmjs/stargate";
import { TurnkeyDirectWallet } from "@turnkey/cosmjs";
import { createNewCosmosPrivateKey } from "./createNewCosmosPrivateKey";
import { print, refineNonNull } from "./shared";

// https://docs.celestia.org/nodes/blockspace-race/#rpc-endpoints
const ENDPOINT = "https://rpc-celestia-testnet-blockspacerace.keplr.app";

async function main() {
  if (!process.env.PRIVATE_KEY_ID) {
    // If you don't specify a `PRIVATE_KEY_ID`, we'll create one for you via calling the Turnkey API.
    await createNewCosmosPrivateKey();
    return;
  }

  // Initialize a Turnkey Signer
  const turnkeySigner = await TurnkeyDirectWallet.init({
    config: {
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      baseUrl: process.env.BASE_URL!,
      organizationId: process.env.ORGANIZATION_ID!,
      privateKeyId: process.env.PRIVATE_KEY_ID!,
    },
    prefix: "celestia",
  });

  const account = refineNonNull((await turnkeySigner.getAccounts())[0]);
  const compressedPublicKey = toHex(account.pubkey);
  const selfAddress = account.address;

  print("Compressed public key:", compressedPublicKey);
  print("Wallet address:", selfAddress);
  print(
    "Wallet on explorer:",
    `https://testnet.mintscan.io/celestia-incentivized-testnet/account/${selfAddress}`
  );

  // Connect it to testnet
  const signingClient = await SigningStargateClient.connectWithSigner(
    ENDPOINT,
    turnkeySigner
  );

  const allBalances = await signingClient.getAllBalances(selfAddress);

  print("Account balance:", JSON.stringify(allBalances));

  if (allBalances.length === 0) {
    console.warn(
      "Unable to send a transaction because your account balance is zero."
    );
    signingClient.disconnect();
    process.exit(0);
  }

  const destinationAddress = "celestia1vsvx8n7f8dh5udesqqhgrjutyun7zqrgehdq2l";
  const transactionAmount = "100";

  // Send a transaction
  const result = await signingClient.sendTokens(
    selfAddress,
    destinationAddress,
    [{ denom: "utia", amount: transactionAmount }],
    {
      amount: [{ denom: "utia", amount: "500" }],
      gas: "200000",
    },
    "Hello from Turnkey!"
  );

  print(
    `Sent ${
      Number(transactionAmount) / 1_000_000
    } TIA to ${destinationAddress}:`,
    `https://testnet.mintscan.io/celestia-incentivized-testnet/txs/${result.transactionHash}`
  );

  signingClient.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
