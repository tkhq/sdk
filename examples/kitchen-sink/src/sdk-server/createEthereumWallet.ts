import * as path from "path";
import * as dotenv from "dotenv";
import * as crypto from "crypto";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";

import { refineNonNull } from "../utils";

async function main() {
  const turnkeyClient = new TurnkeySDKServer({
    apiBaseUrl: "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const walletName = `ETH Wallet ${crypto.randomBytes(2).toString("hex")}`;

  const { walletId, addresses } = await turnkeyClient.apiClient().createWallet({
    walletName,
    accounts: [
      {
        curve: "CURVE_SECP256K1",
        pathFormat: "PATH_FORMAT_BIP32",
        path: "m/44'/60'/0'/0/0",
        addressFormat: "ADDRESS_FORMAT_ETHEREUM",
      },
    ],
  });

  const address = refineNonNull(addresses[0]);

  // Success!
  console.log(
    [
      `New Ethereum wallet created!`,
      `- Name: ${walletName}`,
      `- Wallet ID: ${walletId}`,
      `- Address: ${address}`,
      ``,
      "Now you can take the address, put it in `.env.local`, then re-run the script.",
    ].join("\n")
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
