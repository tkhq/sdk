import { TurnkeyApi, withAsyncPolling } from "@turnkey/http";
import { refineNonNull } from "./shared";

export async function createCosmosPrivateKey(input: {
  privateKeyName: string;
}): Promise<{ privateKeyId: string }> {
  const { privateKeyName } = input;

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

  return { privateKeyId };
}
