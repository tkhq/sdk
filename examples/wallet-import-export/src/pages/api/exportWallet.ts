import type { NextApiRequest, NextApiResponse } from "next";
import { Turnkey } from "@turnkey/sdk-server";

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
    const turnkeyClient = new Turnkey({
      apiBaseUrl: "https://api.turnkey.com",
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
      defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    const exportResponse = await turnkeyClient.apiClient().exportWallet({
      walletId: request.walletId,
      targetPublicKey: request.targetPublicKey,
    });

    const { walletId, exportBundle } = exportResponse;
    if (!walletId) {
      throw new Error("Expected a non-null wallet ID!");
    }

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
