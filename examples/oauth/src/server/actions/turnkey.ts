"use server";

import {
  Turnkey as TurnkeyServerSDK,
  DEFAULT_ETHEREUM_ACCOUNTS,
} from "@turnkey/sdk-server";

const turnkey = new TurnkeyServerSDK({
  apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!, // or BASE_URL (non-public) if you prefer
  apiPublicKey: process.env.API_PUBLIC_KEY!,
  apiPrivateKey: process.env.API_PRIVATE_KEY!,
  defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
});

export async function getSuborgsAction(params: { filterValue: string }) {
  return await turnkey.apiClient().getSubOrgIds({
    organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    filterType: "OIDC_TOKEN",
    filterValue: params.filterValue,
  });
}

export async function createSuborgAction(params: {
  oauthProviders: Array<{ providerName: string; oidcToken: string }>;
}) {
  return await turnkey.apiClient().createSubOrganization({
    subOrganizationName: `example-suborg-${Date.now()}`,
    rootQuorumThreshold: 1,
    rootUsers: [
      {
        userName: `example-user-${Date.now()}`,
        apiKeys: [],
        authenticators: [],
        oauthProviders: params.oauthProviders,
      },
    ],
    wallet: {
      walletName: "Default ETH Wallet",
      accounts: DEFAULT_ETHEREUM_ACCOUNTS,
    },
  });
}

export async function authAction(params: {
  suborgID: string;
  oidcToken: string;
  publicKey: string;
}) {
  const oauth = await turnkey.apiClient().oauthLogin({
    oidcToken: params.oidcToken,
    publicKey: params.publicKey,
    organizationId: params.suborgID,
  });
  const { session } = oauth;
  if (!session) throw new Error("No session returned");
  return { session };
}
