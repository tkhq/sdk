import * as dotenv from "dotenv";
import * as path from "path";
import { Crypto } from "@peculiar/webcrypto";
import { encryptWalletToBundle } from "@turnkey/crypto";
import { Turnkey, DEFAULT_ETHEREUM_ACCOUNTS } from "@turnkey/sdk-server";

if (typeof crypto === "undefined") {
  global.crypto = new Crypto();
}

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const organizationId = process.env.ORGANIZATION_ID;
  const apiPublicKey = process.env.API_PUBLIC_KEY;
  const apiPrivateKey = process.env.API_PRIVATE_KEY;
  const baseUrl = process.env.BASE_URL ?? "https://api.turnkey.com";
  const mnemonic = process.env.MNEMONIC;

  if (!organizationId || !apiPublicKey || !apiPrivateKey || !mnemonic) {
    throw new Error(
      "Missing required env vars: ORGANIZATION_ID, API_PUBLIC_KEY, API_PRIVATE_KEY, MNEMONIC",
    );
  }

  const turnkeyClient = new Turnkey({
    apiBaseUrl: baseUrl,
    apiPublicKey,
    apiPrivateKey,
    defaultOrganizationId: organizationId,
  });

  const apiClient = turnkeyClient.apiClient();

  let userId = process.env.USER_ID;
  if (!userId) {
    const whoami = await apiClient.getWhoami({ organizationId });
    userId = whoami.userId;
    console.log(`Resolved userId via whoami: ${userId}`);
  }

  const { importBundle } = await apiClient.initImportWallet({ userId });

  // Production defaults to PRODUCTION_SIGNER_SIGN_PUBLIC_KEY.
  // Non-prod (e.g. api.dev.turnkey.engineering) needs the env's enclave key.
  const encryptedBundle = await encryptWalletToBundle({
    mnemonic,
    importBundle,
    userId,
    organizationId,
    ...(process.env.SIGNER_PUBLIC_KEY && {
      dangerouslyOverrideSignerPublicKey: process.env.SIGNER_PUBLIC_KEY,
    }),
  });

  const result = await apiClient.importWallet({
    userId,
    walletName: `imported-wallet-${Date.now()}`,
    encryptedBundle,
    accounts: DEFAULT_ETHEREUM_ACCOUNTS,
  });

  console.log("Imported wallet successfully");
  console.log(`  walletId:  ${result.walletId}`);
  console.log(`  addresses: ${result.addresses.join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
