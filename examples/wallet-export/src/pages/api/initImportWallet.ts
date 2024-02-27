import type { NextApiRequest, NextApiResponse } from "next";
import { TurnkeyClient, createActivityPoller } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

type InitImportWalletRequest = {
  userId: string;
};

type InitImportWalletResponse = {
  importBundle: string;
};

type ErrorMessage = {
  message: string;
};

export default async function initImportWallet(
  req: NextApiRequest,
  res: NextApiResponse<InitImportWalletResponse | ErrorMessage>
) {
  try {
    const request = req.body as InitImportWalletRequest;
    const turnkeyClient = new TurnkeyClient(
      { baseUrl: process.env.NEXT_PUBLIC_BASE_URL! },
      new ApiKeyStamper({
        apiPublicKey: process.env.API_PUBLIC_KEY!,
        apiPrivateKey: process.env.API_PRIVATE_KEY!,
      })
    );

    const activityPoller = createActivityPoller({
      client: turnkeyClient,
      requestFn: turnkeyClient.initImportWallet,
    });

    const completedActivity = await activityPoller({
      type: "ACTIVITY_TYPE_INIT_IMPORT_WALLET",
      timestampMs: String(Date.now()),
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
      parameters: {
        userId: request.userId,
      },
    });

    const importBundle =
      completedActivity.result.initImportWalletResult?.importBundle;
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
