import type { NextApiRequest, NextApiResponse } from "next";
import { TurnkeyClient, createActivityPoller } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

type ExportKeyRequest = {
  privateKeyId: string;
  targetPublicKey: string;
};

type ExportKeyResponse = {
  privateKeyId: string;
  exportBundle: string;
};

type ErrorMessage = {
  message: string;
};

export default async function exportPrivateKey(
  req: NextApiRequest,
  res: NextApiResponse<ExportKeyResponse | ErrorMessage>
) {
  try {
    const request = req.body as ExportKeyRequest;
    const turnkeyClient = new TurnkeyClient(
      { baseUrl: process.env.NEXT_PUBLIC_BASE_URL! },
      new ApiKeyStamper({
        apiPublicKey: process.env.API_PUBLIC_KEY!,
        apiPrivateKey: process.env.API_PRIVATE_KEY!,
      })
    );

    const activityPoller = createActivityPoller({
      client: turnkeyClient,
      requestFn: turnkeyClient.exportPrivateKey,
    });

    const completedActivity = await activityPoller({
      type: "ACTIVITY_TYPE_EXPORT_PRIVATE_KEY",
      timestampMs: String(Date.now()),
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
      parameters: {
        privateKeyId: request.privateKeyId,
        targetPublicKey: request.targetPublicKey,
      },
    });

    const privateKeyId = completedActivity.result.exportPrivateKeyResult?.privateKeyId;
    if (!privateKeyId) {
      throw new Error("Expected a non-null private key ID!");
    }

    const exportBundle = completedActivity.result.exportPrivateKeyResult?.exportBundle;
    if (!exportBundle) {
      throw new Error("Expected a non-null export bundle!");
    }

    res.status(200).json({
      privateKeyId,
      exportBundle,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: "Something went wrong.",
    });
  }
}
