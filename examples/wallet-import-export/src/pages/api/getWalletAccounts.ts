import type { NextApiRequest, NextApiResponse } from "next";
import { Turnkey, TurnkeyApiTypes } from "@turnkey/sdk-server";

type TWalletAccount = TurnkeyApiTypes["v1WalletAccount"];

type GetWalletAccountsRequest = {
  organizationId: string;
  walletId: string;
};

type GetWalletAccountsResponse = {
  accounts: TWalletAccount[];
};

type ErrorMessage = {
  message: string;
};

export default async function getWalletAccounts(
  req: NextApiRequest,
  res: NextApiResponse<GetWalletAccountsResponse | ErrorMessage>,
) {
  const getWalletAccountsRequest = req.body as GetWalletAccountsRequest;
  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL || "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
  });

  const { organizationId, walletId } = getWalletAccountsRequest;

  try {
    const walletAccountsResponse = await turnkeyClient.apiClient().getWalletAccounts({
      organizationId,
      walletId,
    });

    res.status(200).json({
      accounts: walletAccountsResponse.accounts,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: "Something went wrong.",
    });
  }
}
