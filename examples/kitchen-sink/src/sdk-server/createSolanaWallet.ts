import * as path from "path";
import * as dotenv from "dotenv";
import * as crypto from "crypto";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";

import { refineNonNull } from "../utils";

async function main() {
  console.log("creating a new wallet on Turnkey...\n");

  const walletName = `SOL Wallet ${crypto.randomBytes(2).toString("hex")}`;

  const turnkeyClient = new TurnkeySDKServer({
    apiBaseUrl: "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const { walletId, addresses } = await turnkeyClient.apiClient().createWallet({
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
  });

  const newWalletId = refineNonNull(walletId);
  const address = refineNonNull(addresses[0]);

  // Success!
  console.log(
    [
      `New SOL wallet created!`,
      `- Name: ${walletName}`,
      `- Wallet ID: ${newWalletId}`,
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
