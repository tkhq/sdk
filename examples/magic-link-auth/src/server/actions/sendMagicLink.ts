"use server";

import { OtpType } from "@turnkey/react-wallet-kit";
import { Turnkey } from "@turnkey/sdk-server";

type SendMagicLinkParams = {
  email: string;
};

export async function sendMagicLink({ email }: SendMagicLinkParams) {
  const turnkeyClient = new Turnkey({
    apiBaseUrl: "https://api.turnkey.com",
    apiPrivateKey: process.env.TURNKEY_DA_PRIVATE_KEY!,
    apiPublicKey: process.env.TURNKEY_DA_PUBLIC_KEY!,
    defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
  }).apiClient();

  // we send a magic link to the user’s email
  const { otpId } = await turnkeyClient.initOtp({
    contact: email,
    otpType: OtpType.Email,
    emailCustomization: {
      // %s will be replaced with the otpCode when sending the email
      magicLinkTemplate: "http://localhost:3000?otpCode=%s",
    },
  });

  if (!otpId) {
    throw new Error("Failed to initialize OTP: missing otpId in response.");
  }

  return otpId;
}
