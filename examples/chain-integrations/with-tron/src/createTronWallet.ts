import { Turnkey } from "@turnkey/sdk-server";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  // Initialize Turnkey client
  const turnkeyClient = new Turnkey({
    apiBaseUrl: "https://api.turnkey.com",
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const createTronWalletResult = await turnkeyClient.apiClient().createWallet({
    walletName: "Tron wallet",
    accounts: [
      {
        curve: "CURVE_SECP256K1",
        pathFormat: "PATH_FORMAT_BIP32",
        path: "m/44'/195'/0'",
        addressFormat: "ADDRESS_FORMAT_TRON",
      },
    ],
  });

  console.log("Tron wallet created 🥳");
  console.log("Tron wallet address: ", createTronWalletResult.addresses[0]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
