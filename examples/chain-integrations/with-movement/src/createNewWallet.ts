import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";

import * as crypto from "crypto";

function refineNonNull<T>(
  input: T | null | undefined,
  errorMessage?: string,
): T {
  if (input == null) {
    throw new Error(errorMessage ?? `Unexpected ${JSON.stringify(input)}`);
  }

  return input;
}

export async function createNewWallet() {
  console.log("creating a new wallet on Turnkey...\n");

  const walletName = `Movement Wallet ${crypto.randomBytes(2).toString("hex")}`;

  try {
    const turnkeyClient = new TurnkeySDKServer({
      apiBaseUrl: "https://api.turnkey.com",
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
      defaultOrganizationId: process.env.ORGANIZATION_ID!,
    });

    const { walletId, addresses } = await turnkeyClient
      .apiClient()
      .createWallet({
        walletName,
        accounts: [
          {
            curve: "CURVE_ED25519",
            pathFormat: "PATH_FORMAT_BIP32",
            path: "m/44'/637'/0'/0'/0'",
            addressFormat: "ADDRESS_FORMAT_APTOS",
          },
        ],
      });

    const newWalletId = refineNonNull(walletId);
    const address = refineNonNull(addresses[0]);

    const { addresses: publicKeys } = await turnkeyClient
      .apiClient()
      .createWalletAccounts({
        walletId: newWalletId,
        accounts: [
          {
            curve: "CURVE_ED25519",
            pathFormat: "PATH_FORMAT_BIP32",
            path: "m/44'/637'/0'/0'/0'",
            addressFormat: "ADDRESS_FORMAT_COMPRESSED",
          },
        ],
      });

    const publicKey = refineNonNull(publicKeys[0]);

    // Success!
    console.log(
      [
        `New Movement wallet created!`,
        `- Name: ${walletName}`,
        `- Wallet ID: ${newWalletId}`,
        `- Address: ${address}`,
        `- PublicKey: ${publicKey}`,
        ``,
        "Now you can take the address and public key and put it in `.env.local` (`MOVEMENT_ADDRESS=<address>, MOVEMENT_PUBLIC_KEY=<publicKey>`), then re-run the script. Be sure to fund this address with some testnet $MOVE before proceeding. You can use https://faucet.movementnetwork.xyz/?network=bardock",
      ].join("\n"),
    );
  } catch (error) {
    throw new Error("Failed to create a new Movement wallet: " + error);
  }
}
