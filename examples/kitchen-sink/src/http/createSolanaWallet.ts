import * as path from "path";
import * as dotenv from "dotenv";
import * as crypto from "crypto";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeyClient, createActivityPoller } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

import { refineNonNull } from "../utils";

async function main() {
  console.log("creating a new wallet on Turnkey...\n");

  const walletName = `SOL Wallet ${crypto.randomBytes(2).toString("hex")}`;

  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    })
  );

  const activityPoller = createActivityPoller({
    client: turnkeyClient,
    requestFn: turnkeyClient.createWallet,
  });

  const completedActivity = await activityPoller({
    type: "ACTIVITY_TYPE_CREATE_WALLET",
    timestampMs: String(Date.now()),
    organizationId: process.env.ORGANIZATION_ID!,
    parameters: {
      walletName,
      accounts: [
        {
          pathFormat: "PATH_FORMAT_BIP32",
          // https://github.com/satoshilabs/slips/blob/master/slip-0044.md
          path: "m/44'/501'/0'/0'",
          curve: "CURVE_ED25519",
          addressFormat: "ADDRESS_FORMAT_SOLANA",
        },
      ],
    },
  });

  const wallet = refineNonNull(completedActivity.result.createWalletResult);
  const walletId = refineNonNull(wallet.walletId);
  const address = refineNonNull(wallet.addresses[0]);

  // Success!
  console.log(
    [
      `New SOL wallet created!`,
      `- Name: ${walletName}`,
      `- Wallet ID: ${walletId}`,
      `- Address: ${address}`,
      ``,
      "Now you can take the address, put it in `.env.local` (`SIGN_WITH=<address>`), then re-run the script.",
    ].join("\n")
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
