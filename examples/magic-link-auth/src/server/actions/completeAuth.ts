"use server";

import { Turnkey, TurnkeyApiClient } from "@turnkey/sdk-server";

type CompleteAuthParams = {
  otpId: string;
  otpCode: string;
  publicKey: string;
};

export async function completeAuth({
  otpId,
  otpCode,
  publicKey,
}: CompleteAuthParams) {
  const turnkeyClient = new Turnkey({
    apiBaseUrl: "https://api.turnkey.com",
    apiPrivateKey: process.env.TURNKEY_DA_PRIVATE_KEY!,
    apiPublicKey: process.env.TURNKEY_DA_PUBLIC_KEY!,
    defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
  }).apiClient();

  // we cerify the OTP code to get a verification token
  const { verificationToken } = await turnkeyClient.verifyOtp({
    otpId,
    otpCode,
  });
  if (!verificationToken) {
    throw new Error("Verification token not found after OTP verification.");
  }

  // we extract the email from the verificationToken
  const email = extractEmailFromVerificationToken(verificationToken);

  // we either get or create the sub-organization for this email
  const subOrgId = await getOrCreateSuborgForEmail(turnkeyClient, email);

  // create a session
  const { session } = await turnkeyClient.otpLogin({
    organizationId: subOrgId,
    verificationToken,
    publicKey,
  });

  if (!session) {
    throw new Error("Failed to create session from OTP login.");
  }

  return session;
}

// helper to decode the verification token and extract the email
function extractEmailFromVerificationToken(token: string): string {
  try {
    const [, payloadBase64] = token.split(".");
    const payloadJson = Buffer.from(payloadBase64, "base64url").toString();
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

// helper to get or create a sub-organization for the given email
async function getOrCreateSuborgForEmail(
  turnkeyClient: TurnkeyApiClient,
  email: string,
): Promise<string> {
  // we try to find an existing sub-org
  const { organizationIds } = await turnkeyClient.getVerifiedSubOrgIds({
    filterType: "EMAIL",
    filterValue: email,
  });

  const existingSubOrgId = organizationIds?.[0];
  if (existingSubOrgId) return existingSubOrgId;

  // no subOrg exists, so we create one
  const { subOrganizationId } = await turnkeyClient.createSubOrganization({
    subOrganizationName: `suborg-${Date.now()}`,
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
