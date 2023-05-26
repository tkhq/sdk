import * as path from "path";
import * as dotenv from "dotenv";

import {
  TurnkeyApi,
  stamp,
  stableStringify,
  stringToBase64urlString,
} from "@turnkey/http";
import { input } from "@inquirer/prompts";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Generates the request containing the POST body that needs to be POSTed to the Turnkey API
function createPrivateKeyRequest(
  organizationId: string,
  privateKeyName: string
): TurnkeyApi.TPostCreatePrivateKeysInput {
  return {
    body: {
      timestampMs: String(Date.now()), // millisecond timestamp
      type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS",
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
    },
  };
}

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
  const apiPublicKey = process.env.API_PUBLIC_KEY;
  const apiPrivateKey = process.env.API_PRIVATE_KEY;
  const organizationId = process.env.ORGANIZATION_ID;

  console.log(
    `Creating a new Private Key for organization ${organizationId} using the configured Turnkey API key...`
  );

  const privateKeyName = await input({ message: "New Private Key Name" });

  const request = createPrivateKeyRequest(organizationId, privateKeyName);
  const postBody = stableStringify(request.body);

  const requestStamp = stringToBase64urlString(
    stableStringify(
      await stamp({
        content: postBody,
        privateKey: apiPrivateKey,
        publicKey: apiPublicKey,
      })
    )
  );

  console.log("Your request details:");
  console.log("✅ Route:");
  console.log(
    `\thttps://coordinator-beta.turnkey.io/public/v1/submit/create_private_keys`
  );
  console.log("✅ Stamp (goes in X-Stamp HTTP header)");
  console.log(`\t${requestStamp}`);
  console.log("✅ POST body:");
  console.log(`\t${postBody}`);

  console.log(
    "\nFor example, you can send this request to Turnkey by running the following cURL command:"
  );
  console.log(
    `\tcurl -X POST -d'${postBody}' -H'X-Stamp:${requestStamp}' -v 'https://coordinator-beta.turnkey.io/public/v1/submit/create_private_keys'`
  );

  console.log(
    "\nImportant note: this request is only be valid for 24hrs. After that, a new request needs to be generated."
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
