import type { NextApiRequest, NextApiResponse } from "next";
import { TurnkeyClient, createActivityPoller } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

type ImportPrivateKeyRequest = {
  userId: string;
  privateKeyName: string;
  encryptedBundle: string;
  curve: "CURVE_SECP256K1" | "CURVE_ED25519";
  addressFormats:("ADDRESS_FORMAT_UNCOMPRESSED" | "ADDRESS_FORMAT_COMPRESSED" | "ADDRESS_FORMAT_ETHEREUM" | "ADDRESS_FORMAT_SOLANA" | "ADDRESS_FORMAT_COSMOS" | "ADDRESS_FORMAT_TRON")[];
};

type ImportPrivateKeyResponse = {
  privateKeyId: string;
};

type ErrorMessage = {
  message: string;
};

export default async function importPrivateKey(
  req: NextApiRequest,
  res: NextApiResponse<ImportPrivateKeyResponse | ErrorMessage>
) {
  try {
    const request = req.body as ImportPrivateKeyRequest;
    const turnkeyClient = new TurnkeyClient(
      { baseUrl: process.env.NEXT_PUBLIC_BASE_URL! },
      new ApiKeyStamper({
        apiPublicKey: process.env.API_PUBLIC_KEY!,
        apiPrivateKey: process.env.API_PRIVATE_KEY!,
      })
    );

    const activityPoller = createActivityPoller({
      client: turnkeyClient,
      requestFn: turnkeyClient.importPrivateKey,
    });

    console.log("here: " + request);

    const completedActivity = await activityPoller({
      type: "ACTIVITY_TYPE_IMPORT_PRIVATE_KEY",
      timestampMs: String(Date.now()),
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
      parameters: {
        userId: request.userId,
        privateKeyName: request.privateKeyName,
        encryptedBundle: request.encryptedBundle,
        curve: request.curve,
        addressFormats: request.addressFormats,
      },
    });

    const privateKeyId = completedActivity.result.importPrivateKeyResult?.privateKeyId;
    if (!privateKeyId) {
      throw new Error("Expected a non-null private key ID!");
    }

    res.status(200).json({
      privateKeyId: privateKeyId,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: "Something went wrong.",
    });
  }
}
