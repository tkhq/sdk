import type { NextApiRequest, NextApiResponse } from "next";
import { Turnkey } from "@turnkey/sdk-server";

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
    const turnkeyClient = new Turnkey({
      apiBaseUrl: "https://api.turnkey.com",
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
      defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    const importWalletResponse = await turnkeyClient.apiClient().importWallet({
      userId: request.userId,
      walletName: request.walletName,
      encryptedBundle: request.encryptedBundle,
      accounts: [],
    });

    const { walletId } = importWalletResponse;
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
