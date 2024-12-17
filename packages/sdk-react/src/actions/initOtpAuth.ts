"use server";

import { Turnkey } from "@turnkey/sdk-server";

type InitOtpAuthRequest = {
  suborgID: string;
  otpType: string;
  contact: string;
  customSmsMessage?: string;
};

type InitOtpAuthResponse = {
  otpId: string;
};

export async function initOtpAuth(
  request: InitOtpAuthRequest
): Promise<InitOtpAuthResponse | undefined> {
  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
    defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!, // DO NOT EXPOSE THESE TO YOUR CLIENT SIDE CODE
    apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!, // DO NOT EXPOSE THESE TO YOUR CLIENT SIDE CODE
  });

  try {
    const initOtpAuthResponse = await turnkeyClient.apiClient().initOtpAuth({
      contact: request.contact,
      otpType: request.otpType,
      organizationId: request.suborgID,
      ...(request.customSmsMessage && {
        smsCustomization: {
          template: request.customSmsMessage,
        },
      }),
    });
    const { otpId } = initOtpAuthResponse;

    if (!otpId) {
      throw new Error("Expected a non-null otpId.");
    }

    return { otpId };
  } catch (e) {
    return;
  }
}
