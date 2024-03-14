import type { NextApiRequest, NextApiResponse } from "next";
import { TurnkeyClient, createActivityPoller } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

type InitImportPrivateKeyRequest = {
  userId: string;
};

type InitImportPrivateKeyResponse = {
  importBundle: string;
};

type ErrorMessage = {
  message: string;
};

export default async function initImportPrivateKey(
  req: NextApiRequest,
  res: NextApiResponse<InitImportPrivateKeyResponse | ErrorMessage>
) {
  try {
    const request = req.body as InitImportPrivateKeyRequest;
    const turnkeyClient = new TurnkeyClient(
      { baseUrl: process.env.NEXT_PUBLIC_BASE_URL! },
      new ApiKeyStamper({
        apiPublicKey: process.env.API_PUBLIC_KEY!,
        apiPrivateKey: process.env.API_PRIVATE_KEY!,
      })
    );

    const activityPoller = createActivityPoller({
      client: turnkeyClient,
      requestFn: turnkeyClient.initImportPrivateKey,
    });

    const completedActivity = await activityPoller({
      type: "ACTIVITY_TYPE_INIT_IMPORT_PRIVATE_KEY",
      timestampMs: String(Date.now()),
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
      parameters: {
        userId: request.userId,
      },
    });

    const importBundle =
      completedActivity.result.initImportPrivateKeyResult?.importBundle;
    if (!importBundle) {
      throw new Error("Expected a non-null import bundle!");
    }

    res.status(200).json({
      importBundle,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: "Something went wrong.",
    });
  }
}
