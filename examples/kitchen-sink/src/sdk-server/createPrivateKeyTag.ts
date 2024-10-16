import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";

import { refineNonNull } from "../utils";

async function main() {
  // Initialize a Turnkey client
  const turnkeyClient = new TurnkeySDKServer({
    apiBaseUrl: "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const privateKeyTagName = "<your desired private key tag name>";
  const privateKeyIds = ["<relevant private key ID>"];

  const { privateKeyTagId } = await turnkeyClient
    .apiClient()
    .createPrivateKeyTag({
      privateKeyTagName,
      privateKeyIds,
    });

  const newPrivateKeyTagId = refineNonNull(privateKeyTagId);

  // Success!
  console.log(
    [
      `New private key tag created!`,
      `- Name: ${privateKeyTagName}`,
      `- Private key tag ID: ${newPrivateKeyTagId}`,
      ``,
    ].join("\n")
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
