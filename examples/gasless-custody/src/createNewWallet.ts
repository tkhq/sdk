import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";

import * as crypto from "crypto";
import { refineNonNull } from "./util";

interface CreateWalletOptions {
  walletName?: string;
  isRecipient?: boolean;
  turnkeyClient?: TurnkeySDKServer;
}

export async function createNewWallet(options: CreateWalletOptions = {}) {
  const { walletName, isRecipient = false, turnkeyClient } = options;
  
  if (!isRecipient) {
    console.log("creating a new wallet on Turnkey...\n");
  }

  const finalWalletName = walletName || `ETH Wallet ${crypto.randomBytes(2).toString("hex")}`;

  const client = turnkeyClient || new TurnkeySDKServer({
    apiBaseUrl: "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const { walletId, addresses } = await client
    .apiClient()
    .createWallet({
      walletName: finalWalletName,
      accounts: [
        {
          curve: "CURVE_SECP256K1",
          pathFormat: "PATH_FORMAT_BIP32",
          path: "m/44'/60'/0'/0/0",
          addressFormat: "ADDRESS_FORMAT_ETHEREUM",
        },
      ],
    });

  const newWalletId = refineNonNull(walletId);
  const address = refineNonNull(addresses[0]);

  if (!isRecipient) {
    console.log(
      [
        `New Ethereum wallet created!`,
        `- Name: ${finalWalletName}`,
        `- Wallet ID: ${newWalletId}`,
        `- Address: ${address}`,
        ``,
        "Now you can take the address, put it in `.env.local` (`SIGN_WITH=<address>`), then re-run the script.",
      ].join("\n"),
    );
  }

  return {
    walletId: newWalletId,
    address,
    walletName: finalWalletName,
  };
}
