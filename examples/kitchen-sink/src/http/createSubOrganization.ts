import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { refineNonNull } from "../utils";

async function main() {
  console.log("creating a new sub-organization on Turnkey...\n");

  const apiKeyName = "<API key name>";
  const publicKey = "<API public key>";
  const curveType = "API_KEY_CURVE_P256";

  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    }),
  );

  const { activity } = await turnkeyClient.createSubOrganization({
    type: "ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V7",
    timestampMs: String(Date.now()),
    organizationId: process.env.ORGANIZATION_ID!,
    parameters: {
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
        accounts: [
          {
            curve: "CURVE_SECP256K1",
            pathFormat: "PATH_FORMAT_BIP32",
            path: "m/44'/60'/0'/0/0",
            addressFormat: "ADDRESS_FORMAT_ETHEREUM",
          },
        ],
      },
    },
  });

  const subOrgId = refineNonNull(
    activity.result.createSubOrganizationResultV7?.subOrganizationId,
  );

  // Success!
  console.log("Sub-organization id:", subOrgId);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
