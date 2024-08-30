import { TurnkeyActivityError } from "@turnkey/http";
import type { TurnkeyApiClient } from "@turnkey/sdk-server";
import * as crypto from "crypto";

export async function createNewSuiWallet(client: TurnkeyApiClient) {
  console.log("creating a new Sui wallet in your Turnkey organization...\n");

  const walletName = `Sui Wallet ${crypto.randomBytes(2).toString("hex")}`;

  try {
    const response = await client.createWallet({
      walletName,
      accounts: [
        {
          pathFormat: "PATH_FORMAT_BIP32",
          // https://github.com/satoshilabs/slips/blob/master/slip-0044.md
          path: "m/44'/784'/0'/0'/0'",
          curve: "CURVE_ED25519",
          addressFormat: "ADDRESS_FORMAT_COMPRESSED",
        },
      ],
    });

    const walletId = response.walletId;
    if (!walletId) {
      console.error("response doesn't contain a valid wallet ID");
      process.exit(1);
    }

    const address = response.addresses[0];
    if (!address) {
      console.error("response doesn't contain a valid address");
      process.exit(1);
    }

    console.log(
      [
        `New Sui wallet created!`,
        `- Name: ${walletName}`,
        `- Wallet ID: ${walletId}`,
        `- Sui public key: ${address}`,
      ].join("\n")
    );
    return address;
  } catch (error) {
    // If needed, you can read from `TurnkeyActivityError` to find out why the activity didn't succeed
    if (error instanceof TurnkeyActivityError) {
      throw error;
    }

    throw new TurnkeyActivityError({
      message: `Failed to create a new Sui wallet: ${
        (error as Error).message
      }`,
      cause: error as Error,
    });
  }
}
