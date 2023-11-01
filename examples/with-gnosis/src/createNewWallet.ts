import {
  TurnkeyClient,
  createActivityPoller,
  TurnkeyActivityError,
} from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import * as crypto from "crypto";
import { refineNonNull } from "./util";

export async function createNewWallet() {
  console.log("creating a new wallet on Turnkey...\n");

  const walletName = `ETH Wallet ${crypto.randomBytes(2).toString("hex")}`;

  try {
    const turnkeyClient = new TurnkeyClient(
      { baseUrl: process.env.BASE_URL! },
      new ApiKeyStamper({
        apiPublicKey: process.env.API_PUBLIC_KEY!,
        apiPrivateKey: process.env.API_PRIVATE_KEY!,
      })
    );

    const activityPoller = createActivityPoller({
      client: turnkeyClient,
      requestFn: turnkeyClient.createWallet,
    });

    const completedActivity = await activityPoller({
      type: "ACTIVITY_TYPE_CREATE_WALLET",
      timestampMs: String(Date.now()),
      organizationId: process.env.ORGANIZATION_ID!,
      parameters: {
        walletName,
        accounts: [
          {
            curve: "CURVE_SECP256K1",
            pathFormat: "PATH_FORMAT_BIP32",
            path: "m/44'/60'/0'/0/0",
            addressFormat: "ADDRESS_FORMAT_ETHEREUM",
          },
          {
            curve: "CURVE_SECP256K1",
            pathFormat: "PATH_FORMAT_BIP32",
            path: "m/44'/60'/1'/0/0",
            addressFormat: "ADDRESS_FORMAT_ETHEREUM",
          },
          {
            curve: "CURVE_SECP256K1",
            pathFormat: "PATH_FORMAT_BIP32",
            path: "m/44'/60'/2'/0/0",
            addressFormat: "ADDRESS_FORMAT_ETHEREUM",
          },
        ],
      },
    });

    const wallet = refineNonNull(completedActivity.result.createWalletResult);
    const walletId = refineNonNull(wallet.walletId);
    const addresses = refineNonNull(wallet.addresses);

    // Success!
    console.log(
      [
        `New Ethereum wallet created!`,
        `- Name: ${walletName}`,
        `- Wallet ID: ${walletId}`,
        `- Address: ${addresses}`,
        ``,
        "Now you can take the addresses, put them in `.env.local`, then re-run the script.",
      ].join("\n")
    );
  } catch (error) {
    // If needed, you can read from `TurnkeyActivityError` to find out why the activity didn't succeed
    if (error instanceof TurnkeyActivityError) {
      throw error;
    }

    throw new TurnkeyActivityError({
      message: "Failed to create a new Ethereum wallet",
      cause: error as Error,
    });
  }
}
