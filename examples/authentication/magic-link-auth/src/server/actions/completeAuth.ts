"use server";

import { Turnkey, TurnkeyApiClient } from "@turnkey/sdk-server";
import type { v1ClientSignature } from "@turnkey/sdk-types";

const turnkey = new Turnkey({
  apiBaseUrl: "https://api.turnkey.com",
  apiPrivateKey: process.env.API_PRIVATE_KEY!,
  apiPublicKey: process.env.API_PUBLIC_KEY!,
  defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
});

// Step 1: verify the encrypted OTP bundle → returns a verificationToken and
// the sub-org ID. Sub-org lookup/creation is done here, after Turnkey has
// validated the OTP
export async function verifyOtpAction(params: {
  otpId: string;
  encryptedOtpBundle: string;
}) {
  const client = turnkey.apiClient();

  const { verificationToken } = await client.verifyOtp({
    otpId: params.otpId,
    encryptedOtpBundle: params.encryptedOtpBundle,
  });
  if (!verificationToken) {
    throw new Error("Verification token not found after OTP verification.");
  }

  const email = extractEmailFromVerificationToken(verificationToken);
  const subOrgId = await getOrCreateSuborgForEmail(client, email);

  return { verificationToken, subOrgId };
}

// Step 2: issue a session. subOrgId comes from verifyOtpAction
export async function completeAuth(params: {
  verificationToken: string;
  subOrgId: string;
  publicKey: string;
  clientSignature: v1ClientSignature;
}) {
  const { session } = await turnkey.apiClient().otpLogin({
    organizationId: params.subOrgId,
    verificationToken: params.verificationToken,
    publicKey: params.publicKey,
    clientSignature: params.clientSignature,
  });

  if (!session) {
    throw new Error("Failed to create session from OTP login.");
  }

  return session;
}

function extractEmailFromVerificationToken(token: string): string {
  try {
    const [, payloadBase64] = token.split(".");
    const payloadJson = Buffer.from(payloadBase64!, "base64url").toString();
    const payload = JSON.parse(payloadJson);
    const email = payload.contact;
    if (!email)
      throw new Error("Email not found in verification token payload.");
    return email;
  } catch (error) {
    console.error("Failed to decode verification token:", error);
    throw new Error("Invalid verification token format.");
  }
}

async function getOrCreateSuborgForEmail(
  client: TurnkeyApiClient,
  email: string,
): Promise<string> {
  const { organizationIds } = await client.getVerifiedSubOrgIds({
    filterType: "EMAIL",
    filterValue: email,
  });

  const existingSubOrgId = organizationIds?.[0];
  if (existingSubOrgId) return existingSubOrgId;

  const { subOrganizationId } = await client.createSubOrganization({
    subOrganizationName: `suborg-magic-link-${Date.now()}`,
    rootQuorumThreshold: 1,
    rootUsers: [
      {
        userName: "Magic Link User",
        userEmail: email,
        apiKeys: [],
        authenticators: [],
        oauthProviders: [],
      },
    ],
  });

  if (!subOrganizationId) {
    throw new Error("Expected a non-null subOrganizationId after creation.");
  }

  return subOrganizationId;
}
