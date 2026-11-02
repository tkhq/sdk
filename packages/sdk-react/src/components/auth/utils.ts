import parsePhoneNumberFromString from "libphonenumber-js";
import { VerificationToken } from "@turnkey/crypto";
import type { v1LoginUsage, v1TokenUsage } from "@turnkey/sdk-types";
import { TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";

export const formatPhoneNumber = (phone: string) => {
  const phoneNumber = parsePhoneNumberFromString(phone);
  return phoneNumber ? phoneNumber.formatInternational() : phone;
};

export function getClientSignatureMessageForLogin({
  verificationToken,
  sessionPublicKey = undefined,
}: {
  verificationToken: string;
  sessionPublicKey?: string;
}) {
  try {
    const token = VerificationToken.parse(verificationToken);
    const verificationPublicKey = token.ephemeralPublicKey;

    // if a session public key is provided, we use it instead
    const resolvedSessionPublicKey = sessionPublicKey || verificationPublicKey;

    const usage: v1LoginUsage = { publicKey: resolvedSessionPublicKey };
    const payload: v1TokenUsage = {
      login: usage,
      tokenId: token.jti,
      type: "USAGE_TYPE_LOGIN",
    };

    const json = JSON.stringify(payload);

    return { message: json, publicKey: verificationPublicKey };
  } catch (error) {
    throw new TurnkeyError(
      "Failed to create client signature bundle for login",
      TurnkeyErrorCodes.UNKNOWN,
      error,
    );
  }
}
