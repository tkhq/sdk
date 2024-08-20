import { TurnkeyActivityError } from "@turnkey/http";
import { Turnkey } from "@turnkey/sdk-server";
import * as crypto from "crypto";
import { refineNonNull } from "./util";

export async function createNewWallet() {
  console.log("creating a new wallet on Turnkey...\n");

  const walletName = `BTC Wallet ${crypto.randomBytes(2).toString("hex")}`;

  try {
    const turnkeyClient = new Turnkey({
      apiBaseUrl: process.env.BASE_URL!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      defaultOrganizationId: process.env.ORGANIZATION_ID!,
    });

    const response = await turnkeyClient.apiClient().createWallet({
      walletName,
      accounts: [
        {
          curve: "CURVE_SECP256K1",
          pathFormat: "PATH_FORMAT_BIP32",
          path: "m/44'/60'/0'/0/0",
          addressFormat: "ADDRESS_FORMAT_COMPRESSED",
        },
      ],
    });

    const walletId = refineNonNull(response.walletId);
    const address = refineNonNull(response.addresses[0]);

    // Success!
    console.log(
      [
        `New Bitcoin wallet created!`,
        `- Name: ${walletName}`,
        `- Wallet ID: ${walletId}`,
        `- Address: ${address}`,
        ``,
        "Now you can take the address, put it in `.env.local` (`SIGN_WITH=<address>`), then re-run the script.",
      ].join("\n")
    );
  } catch (error) {
    // If needed, you can read from `TurnkeyActivityError` to find out why the activity didn't succeed
    if (error instanceof TurnkeyActivityError) {
      throw error;
    }

    throw new TurnkeyActivityError({
      message: "Failed to create a new Bitcoin wallet",
      cause: error as Error,
    });
  }
}
