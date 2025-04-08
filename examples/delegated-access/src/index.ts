import { Turnkey } from "@turnkey/sdk-server";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
// Initialize a Turnkey client using the parent organization
// used to create the sub-organization with the two users in it
const turnkeyClient = new Turnkey({
    apiBaseUrl: "https://api.turnkey.com",
    apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
    apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!,
  }).apiClient();

// for extra clarity, using a separate API key than the one used by the parent org
// make sure to have both DELEGATOR_API_PUBLIC_KEY and DELEGATOR_API_PRIVATE_KEY added in .env
  const curveType = "API_KEY_CURVE_P256";
  const apiKeys = [
    {
      apiKeyName: "Delegated - API Key",
      publicKey: process.env.DELEGATOR_API_PUBLIC_KEY!,
      curveType,
    },
  ];

  const subOrg = await turnkeyClient.createSubOrganization({
    organizationId: process.env.TURNKEY_ORGANIZATION_ID!,
    subOrganizationName: `Sub Org - With Delegator`,
    rootUsers: [
      {
        userName: "Delegator User",
        apiKeys,
        authenticators: [],
        oauthProviders: []
      },
      {
          userName: "End User",
          userEmail: "<some-email>",
          apiKeys: [],
          authenticators: [],
          oauthProviders: []
      },
    ],
    rootQuorumThreshold: 1,
    wallet: {
      "walletName": "Default ETH Wallet",
      "accounts": [
        {
          "curve": "CURVE_SECP256K1",
          "pathFormat": "PATH_FORMAT_BIP32",
          "path": "m/44'/60'/0'/0/0",
          "addressFormat": "ADDRESS_FORMAT_ETHEREUM"
        }
      ]
    },
  });

  console.log("sub-org id:", subOrg.subOrganizationId);

  // Initializing the Turkey client used by the Delegator activities
  // Notice the subOrganizationId created above 
  const turnkeyDelegator = new Turnkey({
    apiBaseUrl: "https://api.turnkey.com",
    apiPrivateKey: process.env.DELEGATOR_API_PRIVATE_KEY!,
    apiPublicKey: process.env.DELEGATOR_API_PUBLIC_KEY!,
    defaultOrganizationId: subOrg.subOrganizationId,
  }).apiClient();

  // Creating a policy for the Delegated account 
  const delegator_userid = subOrg.rootUserIds[0];
  const policyName = "Allow Delegated Account to sign transactions to specific address";
  const effect = "EFFECT_ALLOW";
  const consensus = `approvers.any(user, user.id == '${delegator_userid}')`;
  const condition = `eth.tx.to == '${process.env.RECIPIENT_ADDRESS}'`;
  const notes = "";

  const { policyId } = await turnkeyDelegator.createPolicy({
    policyName,
    condition,
    consensus,
    effect,
    notes,
  });

  console.log(
    [
      `New policy created!`,
      `- Name: ${policyName}`,
      `- Policy ID: ${policyId}`,
      `- Effect: ${effect}`,
      `- Consensus: ${consensus}`,
      `- Condition: ${condition}`,
      ``,
    ].join("\n"),
  );

  // Remove the Delegated Account from the root quorum
  const RootQuorum = await turnkeyDelegator.updateRootQuorum({
    threshold: 1,
    userIds: [subOrg.rootUserIds[1]], // retain the end user
  });

  console.log("Root Quorum updated! :", RootQuorum);

}
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
