import * as path from "path";
import * as dotenv from "dotenv";

import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import prompts from "prompts";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  if (!process.env.ORGANIZATION_ID) {
    console.error(
      "ORGANIZATION_ID is not set. Please create .env.local and populate it with `ORGANIZATION_ID=<your Turnkey organization ID>`"
    );
  }
  if (!process.env.API_PUBLIC_KEY) {
    console.error(
      "API_PUBLIC_KEY is not set. Please create .env.local and populate it with `API_PUBLIC_KEY=<your Turnkey API public key>`"
    );
  }
  if (!process.env.API_PRIVATE_KEY) {
    console.error(
      "API_PRIVATE_KEY is not set. Please create .env.local and populate it with `API_PRIVATE_KEY=<your Turnkey API private key>`"
    );
  }
  if (
    !process.env.ORGANIZATION_ID ||
    !process.env.API_PUBLIC_KEY ||
    !process.env.API_PRIVATE_KEY
  ) {
    console.error(
      "Detected one or more missing configuration values (see above). Aborting."
    );
    return;
  }
  console.log("Configuration loaded!");

  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    })
  );

  const organizationId = process.env.ORGANIZATION_ID;

  console.log(
    `Creating a new Private Key for organization ${organizationId} using the configured Turnkey API key...`
  );

  const { privateKeyName } = await prompts([
    {
      type: "text",
      name: "privateKeyName",
      message: "New Private Key Name:",
    },
  ]);

  const signedRequest = await turnkeyClient.stampCreatePrivateKeys({
    timestampMs: String(Date.now()), // millisecond timestamp
    type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
    organizationId: organizationId,
    parameters: {
      privateKeys: [
        {
          privateKeyName: privateKeyName,
          curve: "CURVE_SECP256K1",
          addressFormats: ["ADDRESS_FORMAT_ETHEREUM"],
          privateKeyTags: [],
        },
      ],
    },
  });

  console.log("Your signed request details:");
  console.log("✅ Request URL:");
  console.log(`\t${signedRequest.url}`);
  console.log("✅ Stamp header name and value");
  console.log(
    `\t${signedRequest.stamp.stampHeaderName}: ${signedRequest.stamp.stampHeaderValue}`
  );
  console.log("✅ POST body:");
  console.log(`\t${signedRequest.body}`);

  console.log(
    "\nFor example, you can send this request to Turnkey by running the following cURL command:"
  );
  console.log(
    `\tcurl -X POST -d'${signedRequest.body}' -H'${signedRequest.stamp.stampHeaderName}:${signedRequest.stamp.stampHeaderValue}' -v '${signedRequest.url}'`
  );

  console.log(
    "\nImportant note: this request is only valid for 24hrs. After that, a new request needs to be generated."
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
