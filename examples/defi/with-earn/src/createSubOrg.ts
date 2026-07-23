import { createActivityPoller } from "@turnkey/http";
import { newClient } from "./common";

// One-time setup, run from the PARENT org: create a sub-org holding the demo
// wallet. The root user is keyed with SUB_ORG_API_PUBLIC_KEY (defaults to the
// parent API key, so the same credentials work for both orgs). Paste the
// printed values into .env.local as TURNKEY_ORGANIZATION_ID and SIGN_WITH.
async function main() {
  const { client, organizationId } = newClient("PARENT");

  const publicKey =
    process.env.SUB_ORG_API_PUBLIC_KEY ?? process.env.PARENT_API_PUBLIC_KEY!;

  const rootUsers = [
    {
      userName: "Earn Demo Root User",
      apiKeys: [
        {
          apiKeyName: "earn-demo-key",
          publicKey,
          curveType: "API_KEY_CURVE_P256" as const,
        },
      ],
      authenticators: [],
      oauthProviders: [],
    },
  ];

  // Optional second root user with an email, so the sub-org's activities can
  // be viewed in the dashboard via email auth.
  if (process.env.SUB_ORG_EMAIL) {
    rootUsers.push({
      userName: "Dashboard User",
      userEmail: process.env.SUB_ORG_EMAIL,
      apiKeys: [],
      authenticators: [],
      oauthProviders: [],
    } as (typeof rootUsers)[number]);
  }

  const activityPoller = createActivityPoller({
    client,
    requestFn: client.createSubOrganization,
  });
  const activity = await activityPoller({
    type: "ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V8",
    timestampMs: String(Date.now()),
    organizationId,
    parameters: {
      subOrganizationName: process.env.SUB_ORG_NAME ?? "Earn Demo Sub-Org",
      rootQuorumThreshold: 1,
      rootUsers,
      wallet: {
        walletName: "Earn Demo Wallet",
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

  const result =
    activity.result.createSubOrganizationResultV8 ??
    activity.result.createSubOrganizationResultV7;
  if (!result) {
    throw new Error(`create sub-org activity ${activity.id} completed without a result`);
  }

  console.log(`✅ Sub-org created`);
  console.log(`\nPaste into .env.local:`);
  console.log(`  TURNKEY_ORGANIZATION_ID="${result.subOrganizationId}"`);
  console.log(`  SIGN_WITH="${result.wallet?.addresses[0]}"`);
  console.log(
    `\n(TURNKEY_API_PUBLIC_KEY/PRIVATE_KEY: the key pair for ${publicKey})`,
  );
  console.log(`\nRemember to fund SIGN_WITH on Base with USDC + ETH for gas.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
