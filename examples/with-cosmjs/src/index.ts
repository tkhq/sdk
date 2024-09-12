import * as dotenv from "dotenv";
import * as path from "path";
import { toHex } from "@cosmjs/encoding";
import { SigningStargateClient } from "@cosmjs/stargate";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeyDirectWallet } from "@turnkey/cosmjs";
import { createNewCosmosWallet } from "./createNewCosmosWallet";
import { print, refineNonNull } from "./util";

// https://docs.celestia.org/nodes/arabica-devnet/#rpc-endpoints
const ENDPOINT = "https://rpc.celestia-arabica-11.com/";

async function main() {
  if (!process.env.SIGN_WITH) {
    // If you don't specify a `SIGN_WITH`, we'll create one for you via calling the Turnkey API.
    await createNewCosmosWallet();
    return;
  }

  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  // Initialize a Turnkey Signer
  const turnkeySigner = await TurnkeyDirectWallet.init({
    config: {
      client: turnkeyClient.apiClient(),
      organizationId: process.env.ORGANIZATION_ID!,
      signWith: process.env.SIGN_WITH!,
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
    `https://arabica.celenium.io/address/${selfAddress}`
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
      "Unable to send a transaction because your account balance is zero. Get funds at https://faucet.celestia-arabica-11.com/"
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
      amount: [{ denom: "utia", amount: "20000" }],
      gas: "200000",
    },
    "Hello from Turnkey!"
  );

  print(
    `Sent ${
      Number(transactionAmount) / 1_000_000
    } TIA to ${destinationAddress}:`,
    `https://arabica.celenium.io/tx/${result.transactionHash}`
  );

  signingClient.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
