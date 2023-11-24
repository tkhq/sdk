import type { NextApiRequest, NextApiResponse } from "next";
import { TurnkeyApiTypes, TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
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

  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.NEXT_PUBLIC_BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    })
  );

  const organizationId = getWalletRequest.organizationId;

  try {
    const walletsResponse = await turnkeyClient.getWallets({
      organizationId,
    });
    const accountsResponse = await turnkeyClient.getWalletAccounts({
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
