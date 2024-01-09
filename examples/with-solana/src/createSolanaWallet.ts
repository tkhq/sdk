import {
  TurnkeyActivityError,
  TurnkeyClient,
  createActivityPoller,
} from "@turnkey/http";
import * as crypto from "crypto";

export async function createNewSolanaWallet(
  client: TurnkeyClient,
  turnkeyOrganizationId: string
) {
  console.log(
    "creating a new Solana wallet in your Turnkey organization...\n"
  );

  const walletName = `Solana Wallet ${crypto.randomBytes(2).toString("hex")}`;

  try {
    const activityPoller = createActivityPoller({
      client: client,
      requestFn: client.createWallet,
    });

    const completedActivity = await activityPoller({
      type: "ACTIVITY_TYPE_CREATE_WALLET",
      organizationId: turnkeyOrganizationId,
      parameters: {
        walletName,
        accounts: [
          {
            pathFormat: "PATH_FORMAT_BIP32",
            // https://github.com/satoshilabs/slips/blob/master/slip-0044.md
            path: "m/44'/501'/0'/0'",
            curve: "CURVE_ED25519",
            addressFormat: "ADDRESS_FORMAT_SOLANA",
          },
        ],
      },
      timestampMs: String(Date.now()), // millisecond timestamp
    });

    const walletId = completedActivity.result.createWalletResult?.walletId;
    if (!walletId) {
      console.error("activity doesn't contain a valid wallet ID", completedActivity);
      process.exit(1);
    }

    const address = completedActivity.result.createWalletResult?.addresses[0];
    if (!address) {
      console.error("activity result doesn't contain a valid address", completedActivity);
      process.exit(1);
    }

    console.log(
      [
        `New Solana wallet created!`,
        `- Name: ${walletName}`,
        `- Wallet ID: ${walletId}`,
        `- Solana address: ${address}`,
      ].join("\n")
    );
    return address;
  } catch (error) {
    // If needed, you can read from `TurnkeyActivityError` to find out why the activity didn't succeed
    if (error instanceof TurnkeyActivityError) {
      throw error;
    }

    throw new TurnkeyActivityError({
      message: `Failed to create a new Solana wallet: ${
        (error as Error).message
      }`,
      cause: error as Error,
    });
  }
}
