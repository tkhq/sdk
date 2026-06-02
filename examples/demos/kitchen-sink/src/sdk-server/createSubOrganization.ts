import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  Turnkey as TurnkeySDKServer,
  DEFAULT_ETHEREUM_ACCOUNTS,
} from "@turnkey/sdk-server";

import { refineNonNull } from "../utils";

async function main() {
  const turnkeyClient = new TurnkeySDKServer({
    apiBaseUrl: "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const apiKeyName = "<API key name>";
  const publicKey = "<API public key>";
  const curveType = "API_KEY_CURVE_P256";

  const subOrg = await turnkeyClient.apiClient().createSubOrganization({
    subOrganizationName: `Test Sub-Organization`,
    rootUsers: [
      {
        userName: "API Key User",
        apiKeys: [
          {
            apiKeyName,
            publicKey,
            curveType,
          },
        ],
        authenticators: [],
        oauthProviders: [],
      },
    ],
    rootQuorumThreshold: 1,
    wallet: {
      walletName: "Default ETH Wallet",
      accounts: DEFAULT_ETHEREUM_ACCOUNTS,
    },
  });

  const subOrgId = refineNonNull(subOrg.subOrganizationId);

  // Success!
  console.log("Sub-organization id:", subOrgId);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
