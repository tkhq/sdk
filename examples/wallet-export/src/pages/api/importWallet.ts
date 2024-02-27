import type { NextApiRequest, NextApiResponse } from "next";
import { TurnkeyClient, createActivityPoller } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

type ImportWalletRequest = {
  userId: string;
  walletName: string;
  encryptedBundle: string;
};

type ImportWalletResponse = {
  walletId: string;
};

type ErrorMessage = {
  message: string;
};

export default async function importWallet(
  req: NextApiRequest,
  res: NextApiResponse<ImportWalletResponse | ErrorMessage>
) {
  try {
    const request = req.body as ImportWalletRequest;
    const turnkeyClient = new TurnkeyClient(
      { baseUrl: process.env.NEXT_PUBLIC_BASE_URL! },
      new ApiKeyStamper({
        apiPublicKey: process.env.API_PUBLIC_KEY!,
        apiPrivateKey: process.env.API_PRIVATE_KEY!,
      })
    );

    const activityPoller = createActivityPoller({
      client: turnkeyClient,
      requestFn: turnkeyClient.importWallet,
    });

    const completedActivity = await activityPoller({
      type: "ACTIVITY_TYPE_IMPORT_WALLET",
      timestampMs: String(Date.now()),
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
      parameters: {
        userId: request.userId,
        walletName: request.walletName,
        encryptedBundle: request.encryptedBundle,
        accounts: [],
      },
    });

    const walletId = completedActivity.result.importWalletResult?.walletId;
    if (!walletId) {
      throw new Error("Expected a non-null wallet ID!");
    }

    res.status(200).json({
      walletId,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: "Something went wrong.",
    });
  }
}
