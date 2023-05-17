import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import * as crypto from "crypto";
import { TurnkeyApi, init as httpInit, withAsyncPolling } from "@turnkey/http";

async function main() {
  httpInit({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    baseUrl: process.env.BASE_URL!,
  });

  const createKeyMutation = withAsyncPolling({
    request: TurnkeyApi.postCreatePrivateKeys,
    refreshIntervalMs: 250, // defaults to 500ms
  });

  const privateKeyName = `Cosmos Key ${crypto.randomBytes(2).toString("hex")}`;

  const activity = await createKeyMutation({
    body: {
      type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS",
      organizationId: process.env.ORGANIZATION_ID!,
      parameters: {
        privateKeys: [
          {
            privateKeyName,
            curve: "CURVE_SECP256K1",
            addressFormats: ["ADDRESS_FORMAT_COMPRESSED"],
            privateKeyTags: [],
          },
        ],
      },
      timestampMs: String(Date.now()), // millisecond timestamp
    },
  });

  const privateKeyId = refineNonNull(
    activity.result.createPrivateKeysResult?.privateKeyIds?.[0]
  );

  print(`Created ${privateKeyName}:`, privateKeyId);

  const keyInfo = await TurnkeyApi.postGetPrivateKey({
    body: {
      organizationId: process.env.ORGANIZATION_ID!,
      privateKeyId,
    },
  });

  console.log(keyInfo);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function print(header: string, body: string): void {
  console.log(`${header}\n\t${body}\n`);
}

export function refineNonNull<T>(
  input: T | null | undefined,
  errorMessage?: string
): T {
  if (input == null) {
    throw new Error(errorMessage ?? `Unexpected ${JSON.stringify(input)}`);
  }

  return input;
}
