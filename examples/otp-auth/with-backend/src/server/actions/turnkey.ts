// src/server/actions/turnkey.ts
"use server";

import {
  Turnkey as TurnkeyServerSDK,
  DEFAULT_ETHEREUM_ACCOUNTS,
  DEFAULT_SOLANA_ACCOUNTS,
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

export async function createSuborgAction(params: { email: string }) {
  return await turnkey.apiClient().createSubOrganization({
    subOrganizationName: `otp-suborg-${Date.now()}`,
    rootQuorumThreshold: 1,
    rootUsers: [
      {
        userName: `otp-user-${Date.now()}`,
        userEmail: params.email,
        apiKeys: [],
        authenticators: [],
        oauthProviders: [],
      },
    ],
    wallet: {
      walletName: "Default Wallet",
      accounts: [...DEFAULT_ETHEREUM_ACCOUNTS, ...DEFAULT_SOLANA_ACCOUNTS],
    },
  });
}

// --- OTP flow ---
/**
 * Step 1: Initiate OTP (sends email)
 * - userIdentifier is optional; we pass the session public key for rate limiting
 */
export async function initOtpAction(params: {
  email: string;
  publicKey: string;
}) {
  const res = await turnkey.apiClient().initOtp({
    appName: "Turnkey Wallet",
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

/**
 * Step 2: Verify OTP code → returns verificationToken
 * - The client encrypts the OTP code into a bundle using the target key from initOtp
 * - Do this before any suborg lookup/creation to prevent org spamming
 */
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

/**
 * Step 3: Login with verified token (creates session)
 * - Pass suborgID you resolved/created after verifyOtp
 * - publicKey must match the session key you created client-side for this OTP attempt
 */
export async function otpLoginAction(params: {
  suborgID: string;
  verificationToken: string;
  publicKey: string;
  clientSignature: v1ClientSignature;
}) {
  const res = await turnkey.apiClient().otpLogin({
    organizationId: params.suborgID || process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    verificationToken: params.verificationToken,
    publicKey: params.publicKey,
    clientSignature: params.clientSignature,
  });
  if (!res.session) throw new Error("No session returned from otpLogin");
  return { session: res.session };
}
