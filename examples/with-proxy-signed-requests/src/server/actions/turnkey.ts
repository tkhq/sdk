"use server";

import {
  Turnkey as TurnkeyServerSDK,
  DEFAULT_ETHEREUM_ACCOUNTS,
} from "@turnkey/sdk-server";

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
    subOrganizationName: `proxy-suborg-${Date.now()}`,
    rootQuorumThreshold: 1,
    rootUsers: [
      {
        userName: `proxy-user-${Date.now()}`,
        userEmail: params.email,
        apiKeys: [],
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

export async function initOtpAction(params: {
  email: string;
  publicKey: string;
}) {
  const res = await turnkey.apiClient().initOtp({
    appName: "Turnkey Proxy Example",
    otpType: "OTP_TYPE_EMAIL",
    contact: params.email,
    userIdentifier: params.publicKey,
  });
  if (!res.otpId) throw new Error("Expected non-null otpId from initOtp");
  return { otpId: res.otpId };
}

export async function verifyOtpAction(params: {
  otpId: string;
  otpCode: string;
}) {
  const res = await turnkey.apiClient().verifyOtp({
    otpId: params.otpId,
    otpCode: params.otpCode,
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
}) {
  const res = await turnkey.apiClient().otpLogin({
    organizationId: params.suborgID || process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    verificationToken: params.verificationToken,
    publicKey: params.publicKey,
  });
  if (!res.session) throw new Error("No session returned from otpLogin");
  return { session: res.session };
}
