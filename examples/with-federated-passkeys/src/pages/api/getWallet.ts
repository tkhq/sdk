import type { NextApiRequest, NextApiResponse } from "next";
import {
  Turnkey as TurnkeyServerSDK,
  TurnkeyApiTypes,
} from "@turnkey/sdk-server";
import { GetWalletRequest, TFormattedWallet } from "@/app/types";

type TWalletAccount = TurnkeyApiTypes["v1WalletAccount"];

type ErrorMessage = {
  message: string;
};

// This can be performed by the parent org since parent orgs have read-only access to all their sub-orgs
export default async function getWallet(
  req: NextApiRequest,
  res: NextApiResponse<TFormattedWallet | ErrorMessage>
) {
  const getWalletRequest = req.body as GetWalletRequest;

  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
  });

  const organizationId = getWalletRequest.organizationId;

  try {
    const walletsResponse = await turnkeyClient.apiClient().getWallets({
      organizationId,
    });
    const accountsResponse = await turnkeyClient.apiClient().getWalletAccounts({
      organizationId: organizationId,
      walletId: walletsResponse.wallets[0].walletId,
    });

    const accounts = accountsResponse.accounts.map((acc: TWalletAccount) => {
      return {
        address: acc.address,
        path: acc.path,
      };
    });

    res.status(200).json({
      id: walletsResponse.wallets[0].walletId,
      name: walletsResponse.wallets[0].walletName,
      accounts: accounts,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: "Something went wrong.",
    });
  }

  res.json;
}
