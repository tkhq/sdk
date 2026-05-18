"use server";

import { Turnkey } from "@turnkey/sdk-server";

type SendMagicLinkParams = {
  email: string;
};

export async function sendMagicLink({ email }: SendMagicLinkParams) {
  const turnkeyClient = new Turnkey({
    apiBaseUrl: "https://api.turnkey.com",
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
  }).apiClient();

  // we send a magic link to the user’s email
  const { otpId, otpEncryptionTargetBundle } = await turnkeyClient.initOtp({
    contact: email,
    appName: "Magic Link Demo",
    otpType: "OTP_TYPE_EMAIL",
    emailCustomization: {
      // %s is replaced with the OTP code when the email is sent
      magicLinkTemplate: "http://localhost:3000?otpCode=%s",
    },
  });

  if (!otpId) {
    throw new Error("Failed to initialize OTP: missing otpId in response.");
  }

  return { otpId, otpEncryptionTargetBundle };
}
