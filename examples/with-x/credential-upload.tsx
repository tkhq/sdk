import { webcrypto as nodeCrypto } from "node:crypto";
if (!globalThis.crypto) {
  // @ts-ignore
  globalThis.crypto = nodeCrypto as unknown as Crypto;
}

import { encryptOauth2ClientSecret } from "@turnkey/crypto";
import { Turnkey } from "@turnkey/sdk-server";
import dotenv from "dotenv";

dotenv.config({ path: "./.env.local" });

(async () => {
  // obtain the args to this script and ensure there is exactly 1
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log(
      "Invalid client secret provided. To input a client secret run: pnpm run credential-upload -- <client_secret>",
    );
    process.exit(1);
  }

  if (!process.env.X_CLIENT_ID) {
    console.log(
      "Invalid client ID provided. Please provide it in your .env.local file",
    );
    process.exit(1);
  }

  // obtain the client secret from the arguments
  const client_secret = args[1];

  // encrypt the client secret to TLS Fetchers public key
  const encryptedClientSecret = await encryptOauth2ClientSecret(client_secret);

  try {
    // create a new SDK client to upload the OAuth 2.0 Credential
    const turnkeyClient = new Turnkey({
      apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
      defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    // upload the client id and encrypted client secret
    const createOauth2CredentialResponse = await turnkeyClient
      .apiClient()
      .createOauth2Credential({
        provider: "OAUTH2_PROVIDER_X",
        clientId: process.env.X_CLIENT_ID!,
        encryptedClientSecret: encryptedClientSecret,
      });

    console.log();
    console.log("X encrypted client secret successfully uploaded! ✅");
    console.log(
      "Enter this ID in your .env.local for the OAUTH2_CREDENTIAL_ID environment variable",
    );
    console.log(
      "OAuth 2.0 Credential ID: " +
        createOauth2CredentialResponse.oauth2CredentialId,
    );
  } catch (e) {
    console.log("Failed uploading OAuth 2.0 encrypted client secret");
    console.log(e);
  }
})();
