import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";

async function main() {
  const turnkeyClient = new TurnkeySDKServer({
    apiBaseUrl: process.env.BASE_URL || "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const { walletIds } = await turnkeyClient.apiClient().deleteWallets({
    deleteWithoutExport: true,
    walletIds: ["50990151-4aa8-53fb-88ad-7400a56cafcc", "23990864-5f5d-5d13-a355-aedd9c327367", "2f0ec19f-700d-50d6-9901-aa9090c1485c", "a10ffbad-8e97-5b92-95cd-f5c39d4ea55b", "5298e9f8-dbda-5e7c-af03-570b8f21fac6"]
  });

  // Success!
  console.log(
    [
      `Wallets deleted!`,
      `- Wallet IDs: ${walletIds}`,
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
