import type {Turnkey as TurnkeySDKClient}  from "@turnkey/sdk-server";

type InitAuthRequest = {
  suborgID: string;
  otpType: string;
  contact: string;
};

type InitAuthResponse = {
  otpId: string;
};


export async function initAuth(
  request: InitAuthRequest,
  turnkeyClient: TurnkeySDKClient
): Promise<InitAuthResponse | undefined> {
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
