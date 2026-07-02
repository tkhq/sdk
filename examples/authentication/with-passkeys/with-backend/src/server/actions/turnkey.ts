"use server";

import {
  Turnkey as TurnkeyServerSDK,
  DEFAULT_ETHEREUM_ACCOUNTS,
  DEFAULT_SOLANA_ACCOUNTS,
} from "@turnkey/sdk-server";
import type { v1Attestation } from "@turnkey/sdk-types";

const turnkey = new TurnkeyServerSDK({
  apiBaseUrl: process.env.BASE_URL!,
  apiPublicKey: process.env.API_PUBLIC_KEY!,
  apiPrivateKey: process.env.API_PRIVATE_KEY!,
  defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
});

export async function createSuborgAction(params: {
  email: string;
  challenge: string;
  attestation: v1Attestation;
  // Temporary P256 public key generated on the client. Registered with a 60s
  // expiry so the client can call stampLogin immediately after sub-org creation
  // without requiring a second passkey tap.
  tempPublicKey: string;
}) {
  const res = await turnkey.apiClient().createSubOrganization({
    subOrganizationName: `suborg-passkey-demo-${Date.now()}`,
    rootQuorumThreshold: 1,
    rootUsers: [
      {
        userName: params.email,
        userEmail: params.email,
        oauthProviders: [],
        authenticators: [
          {
            authenticatorName: "Passkey",
            challenge: params.challenge,
            attestation: params.attestation,
          },
        ],
        apiKeys: [
          {
            apiKeyName: "session-bootstrap",
            publicKey: params.tempPublicKey,
            curveType: "API_KEY_CURVE_P256",
            expirationSeconds: "60",
          },
        ],
      },
    ],
    wallet: {
      walletName: "Default Wallet",
      accounts: [...DEFAULT_ETHEREUM_ACCOUNTS, ...DEFAULT_SOLANA_ACCOUNTS],
    },
  });

  // subOrganizationId is only populated when the activity COMPLETES; if the parent
  // org's root quorum is >1 it stays PENDING and no sub-org exists. Fail loudly here
  // rather than letting stampLogin fall back to the parent org (PUBLIC_KEY_NOT_FOUND).
  if (
    res.activity?.status !== "ACTIVITY_STATUS_COMPLETED" ||
    !res.subOrganizationId
  ) {
    throw new Error(
      `Sub-org was not created (activity status: ${res.activity?.status}). ` +
        `Ensure the parent org API key can self-approve CREATE_SUB_ORGANIZATION (root quorum = 1).`,
    );
  }

  return res;
}

export async function getSuborgsByEmailAction(params: { email: string }) {
  return await turnkey.apiClient().getSubOrgIds({
    organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    filterType: "EMAIL",
    filterValue: params.email,
  });
}
