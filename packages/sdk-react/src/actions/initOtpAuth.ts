import type { Turnkey as TurnkeySDKClient } from "@turnkey/sdk-server";

type InitOtpAuthRequest = {
  suborgID: string;
  otpType: string;
  contact: string;
};

type InitOtpAuthResponse = {
  otpId: string;
};


export async function initOtpAuth(
  request: InitOtpAuthRequest,
  turnkeyClient: TurnkeySDKClient
): Promise<InitOtpAuthResponse | undefined> {
  try {
    const initOtpAuthResponse = await turnkeyClient.apiClient().initOtpAuth({
      contact: request.contact,
      otpType: request.otpType,
      organizationId: request.suborgID
    });
    const { otpId } = initOtpAuthResponse;

    if (!otpId) {
      throw new Error("Expected a non-null otpId.");
    }

    return { otpId };
  } catch (e) {
    return
  }
}
