import { Turnkey } from "@turnkey/sdk-server";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

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
  
  const apiKeyName = "Delegated - API Key";
  const publicKey = process.env.DELEGATED_API_PUBLIC_KEY!;
  const curveType = "API_KEY_CURVE_P256";
  

  const subOrg = await turnkeyClient.createSubOrganization({
    organizationId: process.env.TURNKEY_ORGANIZATION_ID!,
    subOrganizationName: `Sub Org - With Delegated`,
    rootUsers: [
      {
        userName: "Delegated User",
        apiKeys: [
          {
            apiKeyName,
            publicKey,
            curveType,
          },
        ],
        authenticators: [],
        oauthProviders: []
      },
      {
          userName: "End User",
          userEmail: "<email_address>",
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

  console.log("Sub-organization id:", subOrg.subOrganizationId);

  // Initializing the Turkey client used by the Delegated account activities
  // Notice the subOrganizationId created above 
  const turnkeyDelegated = new Turnkey({
    apiBaseUrl: "https://api.turnkey.com",
    apiPrivateKey: process.env.DELEGATED_API_PRIVATE_KEY!,
    apiPublicKey: process.env.DELEGATED_API_PUBLIC_KEY!,
    defaultOrganizationId: subOrg.subOrganizationId,
  }).apiClient();

  // Creating a policy for the Delegated account 
  const delegated_userid = subOrg.rootUserIds[0];
  const policyName = "Allow Delegated Account to sign transactions to specific address";
  const effect = "EFFECT_ALLOW";
  const consensus = `approvers.any(user, user.id == '${delegated_userid}')`;
  const condition = `eth.tx.to == '${process.env.RECIPIENT_ADDRESS}'`;
  const notes = "";

  const { policyId } = await turnkeyDelegated.createPolicy({
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
  const RootQuorum = await turnkeyDelegated.updateRootQuorum({
    threshold: 1,
    userIds: [subOrg.rootUserIds[1]], // retain the end user
  });

  console.log("Root Quorum updated! :", RootQuorum);

}
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
