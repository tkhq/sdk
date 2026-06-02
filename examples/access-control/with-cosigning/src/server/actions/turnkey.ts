"use server";

import {
  Turnkey as TurnkeyServerSDK,
  DEFAULT_ETHEREUM_ACCOUNTS,
} from "@turnkey/sdk-server";
import type { v1ClientSignature } from "@turnkey/sdk-types";

const turnkey = new TurnkeyServerSDK({
  apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
  apiPublicKey: process.env.API_PUBLIC_KEY!,
  apiPrivateKey: process.env.API_PRIVATE_KEY!,
  defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
});

export async function getSuborgsAction(params: { filterValue: string }) {
  return await turnkey.apiClient().getSubOrgIds({
    organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    filterType: "EMAIL",
    filterValue: params.filterValue,
  });
}

/**
 * Creates a sub-org with a 2-of-2 root quorum:
 *  - Root user 1: the end user (authenticated via OTP session key)
 *  - Root user 2: the backend cosigner (authenticated via the server API key)
 *
 * Both must approve any root-level activity (e.g. signing transactions).
 */
export async function createSuborgAction(params: { email: string }) {
  return await turnkey.apiClient().createSubOrganization({
    subOrganizationName: `cosigning-suborg-${Date.now()}`,
    rootQuorumThreshold: 2,
    rootUsers: [
      {
        userName: "end-user",
        userEmail: params.email,
        apiKeys: [],
        authenticators: [],
        oauthProviders: [],
      },
      {
        userName: "backend-cosigner",
        // No email — this is a service account identified solely by its API key.
        // Uses a dedicated cosigner key, separate from the admin key, so a
        // compromised admin key cannot approve activities.
        apiKeys: [
          {
            apiKeyName: "backend-cosigner-key",
            publicKey: process.env.COSIGNER_API_PUBLIC_KEY!,
            curveType: "API_KEY_CURVE_P256",
          },
        ],
        authenticators: [],
        oauthProviders: [],
      },
    ],
    wallet: {
      walletName: "Default Wallet",
      accounts: [...DEFAULT_ETHEREUM_ACCOUNTS],
    },
  });
}

// --- OTP flow ---

export async function initOtpAction(params: {
  email: string;
  publicKey: string;
}) {
  const res = await turnkey.apiClient().initOtp({
    appName: "Turnkey Co-Signing Demo",
    otpType: "OTP_TYPE_EMAIL",
    contact: params.email,
    userIdentifier: params.publicKey,
  });
  if (!res.otpId) throw new Error("Expected non-null otpId from initOtp");
  return {
    otpId: res.otpId,
    otpEncryptionTargetBundle: res.otpEncryptionTargetBundle,
  };
}

export async function verifyOtpAction(params: {
  otpId: string;
  encryptedOtpBundle: string;
}) {
  const res = await turnkey.apiClient().verifyOtp({
    otpId: params.otpId,
    encryptedOtpBundle: params.encryptedOtpBundle,
  });
  if (!res.verificationToken) {
    throw new Error("Missing verificationToken from verifyOtp");
  }
  return { verificationToken: res.verificationToken };
}

export async function otpLoginAction(params: {
  suborgID: string;
  verificationToken: string;
  publicKey: string;
  clientSignature: v1ClientSignature;
}) {
  const res = await turnkey.apiClient().otpLogin({
    organizationId: params.suborgID,
    verificationToken: params.verificationToken,
    publicKey: params.publicKey,
    clientSignature: params.clientSignature,
  });
  if (!res.session) throw new Error("No session returned from otpLogin");
  return { session: res.session };
}

export async function getActivityAction(params: {
  organizationId: string;
  activityId: string;
}) {
  const cosignerClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: params.organizationId,
  });
  const res = await cosignerClient.apiClient().getActivity({
    organizationId: params.organizationId,
    activityId: params.activityId,
  });
  return res.activity;
}
