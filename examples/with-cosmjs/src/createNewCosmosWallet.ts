import { TurnkeyActivityError } from "@turnkey/http";
import { Turnkey } from "@turnkey/sdk-server";
import * as crypto from "crypto";
import { refineNonNull } from "./util";

export async function createNewCosmosWallet() {
  console.log("creating a new wallet on Turnkey...\n");

  const walletName = `Cosmos Wallet ${crypto.randomBytes(2).toString("hex")}`;

  try {
    const turnkeyClient = new Turnkey({
      apiBaseUrl: process.env.BASE_URL!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      defaultOrganizationId: process.env.ORGANIZATION_ID!,
    });

    const response = await turnkeyClient.apiClient().createWallet({
      walletName,
      // These accounts use the same path, but just different address formats.
      // `ADDRESS_FORMAT_UNCOMPRESSED` is the critical format as it's required for both
      // signing and to derive other Cosmos-SDK-based addresses.
      accounts: [
        {
          curve: "CURVE_SECP256K1",
          pathFormat: "PATH_FORMAT_BIP32",
          path: "m/44'/118'/0'/0/0",
          addressFormat: "ADDRESS_FORMAT_UNCOMPRESSED",
        },
        {
          curve: "CURVE_SECP256K1",
          pathFormat: "PATH_FORMAT_BIP32",
          path: "m/44'/118'/0'/0/0",
          addressFormat: "ADDRESS_FORMAT_COSMOS",
        },
      ],
    });

    const walletId = refineNonNull(response.walletId);
    const publicKeyUncompressed = refineNonNull(response.addresses[0]);
    const address = refineNonNull(response.addresses[1]);

    // Success!
    console.log(
      [
        `New Cosmos wallet created!`,
        `- Name: ${walletName}`,
        `- Wallet ID: ${walletId}`,
        `- Public key: ${publicKeyUncompressed}`,
        `- Address: ${address}`,
        ``,
        "Now you can take the public key, put it in `.env.local` (`SIGN_WITH=<public key>`), then re-run the script.",
      ].join("\n")
    );
  } catch (error) {
    // If needed, you can read from `TurnkeyActivityError` to find out why the activity didn't succeed
    if (error instanceof TurnkeyActivityError) {
      throw error;
    }

    throw new TurnkeyActivityError({
      message: "Failed to create a new Cosmos wallet",
      cause: error as Error,
    });
  }
}
