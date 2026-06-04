"use server";

import {
  Turnkey as TurnkeyServerSDK,
  DEFAULT_ETHEREUM_ACCOUNTS,
  DEFAULT_SOLANA_ACCOUNTS,
} from "@turnkey/sdk-server";
import { buildSecondaryOauthProviders } from "@turnkey/core";

const turnkey = new TurnkeyServerSDK({
  apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
  apiPublicKey: process.env.API_PUBLIC_KEY!,
  apiPrivateKey: process.env.API_PRIVATE_KEY!,
  defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
});

export async function getSuborgsAction(params: { oidcToken: string }) {
  return await turnkey.apiClient().getSubOrgIds({
    organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    filterType: "OIDC_TOKEN",
    filterValue: params.oidcToken,
  });
}

export async function createSuborgAction(params: {
  oidcToken: string;
  secondaryClientIds: string[];
}) {
  const secondaryProviders = buildSecondaryOauthProviders(
    params.oidcToken,
    "Google",
    params.secondaryClientIds,
  );

  return await turnkey.apiClient().createSubOrganization({
    subOrganizationName: `oauth-xplat-${Date.now()}`,
    rootQuorumThreshold: 1,
    rootUsers: [
      {
        userName: `user-${Date.now()}`,
        apiKeys: [],
        authenticators: [],
        oauthProviders: [
          { providerName: "Google Web", oidcToken: params.oidcToken },
          ...secondaryProviders,
        ],
      },
    ],
    wallet: {
      walletName: "Default Wallet",
      accounts: [...DEFAULT_ETHEREUM_ACCOUNTS, ...DEFAULT_SOLANA_ACCOUNTS],
    },
  });
}

export async function authAction(params: {
  suborgId: string;
  oidcToken: string;
  publicKey: string;
}) {
  const result = await turnkey.apiClient().oauthLogin({
    oidcToken: params.oidcToken,
    publicKey: params.publicKey,
    organizationId: params.suborgId,
  });
  if (!result.session) throw new Error("No session returned");
  return { session: result.session };
}

export async function verifyPlatformAction(params: {
  iss: string;
  sub: string;
  aud: string;
}) {
  return await turnkey.apiClient().getSubOrgIds({
    organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    filterType: "OAUTH_CLAIM",
    filterValue: JSON.stringify({
      issuer: params.iss,
      subject: params.sub,
      audience: params.aud,
    }),
  });
}
