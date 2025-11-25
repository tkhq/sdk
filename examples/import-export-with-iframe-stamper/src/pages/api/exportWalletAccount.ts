import type { NextApiRequest, NextApiResponse } from "next";
import { Turnkey } from "@turnkey/sdk-server";

type ExportWalletAccountRequest = {
  walletAccountAddress: string;
  targetPublicKey: string;
};

type ExportWalletAccountResponse = {
  address: string;
  exportBundle: string;
};

type ErrorMessage = {
  message: string;
};

export default async function exportWalletAccount(
  req: NextApiRequest,
  res: NextApiResponse<ExportWalletAccountResponse | ErrorMessage>,
) {
  try {
    const request = req.body as ExportWalletAccountRequest;
    const turnkeyClient = new Turnkey({
      apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL || "https://api.turnkey.com",
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
      defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    const exportResponse = await turnkeyClient.apiClient().exportWalletAccount({
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
      address: request.walletAccountAddress,
      targetPublicKey: request.targetPublicKey,
    });

    const { address, exportBundle } = exportResponse;
    if (!address) {
      throw new Error("Expected a non-null address!");
    }

    if (!exportBundle) {
      throw new Error("Expected a non-null export bundle!");
    }

    res.status(200).json({
      address,
      exportBundle,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: "Something went wrong.",
    });
  }
}
