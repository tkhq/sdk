import type { NextApiRequest, NextApiResponse } from "next";
import { TurnkeyClient, createActivityPoller } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

type ExportWalletRequest = {
  walletId: string;
  targetPublicKey: string;
};

type ExportWalletResponse = {
  walletId: string;
  exportBundle: string;
};

type ErrorMessage = {
  message: string;
};

export default async function exportWallet(
  req: NextApiRequest,
  res: NextApiResponse<ExportWalletResponse | ErrorMessage>
) {
  try {
    const request = req.body as ExportWalletRequest;
    const turnkeyClient = new TurnkeyClient(
      { baseUrl: process.env.NEXT_PUBLIC_BASE_URL! },
      new ApiKeyStamper({
        apiPublicKey: process.env.API_PUBLIC_KEY!,
        apiPrivateKey: process.env.API_PRIVATE_KEY!,
      })
    );

    const activityPoller = createActivityPoller({
      client: turnkeyClient,
      requestFn: turnkeyClient.exportWallet,
    });

    const completedActivity = await activityPoller({
      type: "ACTIVITY_TYPE_EXPORT_WALLET",
      timestampMs: String(Date.now()),
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
      parameters: {
        walletId: request.walletId,
        targetPublicKey: request.targetPublicKey,
      },
    });

    const walletId = completedActivity.result.exportWalletResult?.walletId;
    if (!walletId) {
      throw new Error("Expected a non-null wallet ID!");
    }

    const exportBundle =
      completedActivity.result.exportWalletResult?.exportBundle;
    if (!exportBundle) {
      throw new Error("Expected a non-null export bundle!");
    }

    res.status(200).json({
      walletId,
      exportBundle,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: "Something went wrong.",
    });
  }
}
