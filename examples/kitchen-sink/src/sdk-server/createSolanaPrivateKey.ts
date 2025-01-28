import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";

import * as crypto from "crypto";

import { refineNonNull } from "../utils";

async function main() {
  console.log("creating a new Solana private key on Turnkey...");

  const turnkeyClient = new TurnkeySDKServer({
    apiBaseUrl: "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const privateKeyName = `SOL Key ${crypto.randomBytes(2).toString("hex")}`;

  const { privateKeys } = await turnkeyClient.apiClient().createPrivateKeys({
    privateKeys: [
      {
        privateKeyName,
        curve: "CURVE_ED25519",
        addressFormats: ["ADDRESS_FORMAT_SOLANA"],
        privateKeyTags: [],
      },
    ],
  });

  const newPrivateKeys = refineNonNull(privateKeys);
  const privateKeyId = refineNonNull(newPrivateKeys[0]?.privateKeyId);
  const address = refineNonNull(newPrivateKeys[0]?.addresses?.[0]?.address);

  // Success!
  console.log(
    [
      `New Solana private key created!`,
      `- Name: ${privateKeyName}`,
      `- Private key ID: ${privateKeyId}`,
      `- Address: ${address}`,
      ``,
      "Now you can take the private key ID, put it in `.env.local`, then re-run the script.",
    ].join("\n")
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
