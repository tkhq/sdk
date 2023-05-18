import { init as httpInit, TurnkeyApi, withAsyncPolling } from "@turnkey/http";
import * as crypto from "crypto";
import { refineNonNull } from "./shared";

export async function createNewCosmosPrivateKey() {
  httpInit({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    baseUrl: process.env.BASE_URL!,
  });

  console.log(
    "`process.env.PRIVATE_KEY_ID` not found; creating a new Cosmos private key on Turnkey...\n"
  );

  const privateKeyName = `Cosmos Key ${crypto.randomBytes(2).toString("hex")}`;

  const createKeyMutation = withAsyncPolling({
    request: TurnkeyApi.postCreatePrivateKeys,
    refreshIntervalMs: 250, // defaults to 500ms
  });

  // TODO: fix/simplify the address derivation after `ADDRESS_FORMAT_COMPRESSED` is fully supported
  const activity = await createKeyMutation({
    body: {
      type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS",
      organizationId: process.env.ORGANIZATION_ID!,
      parameters: {
        privateKeys: [
          {
            privateKeyName,
            curve: "CURVE_SECP256K1",
            addressFormats: ["ADDRESS_FORMAT_ETHEREUM"],
            privateKeyTags: [],
          },
        ],
      },
      timestampMs: String(Date.now()),
    },
  });

  const privateKeyId = refineNonNull(
    activity.result.createPrivateKeysResult?.privateKeyIds?.[0]
  );

  console.log(
    [
      `New Cosmos private key created!`,
      `- Name: ${privateKeyName}`,
      `- Private key ID: ${privateKeyId}`,
      ``,
      "Now you can take the private key ID, put it in `.env.local`, then re-run the script.",
    ].join("\n")
  );
}
