import parsePhoneNumberFromString from "libphonenumber-js";
import type {
  VerificationToken,
  v1ClientSignature,
  v1LoginUsage,
  v1LoginUsageV2,
  v1TokenUsage,
} from "@turnkey/sdk-types";
import { TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";

export const formatPhoneNumber = (phone: string) => {
  const phoneNumber = parsePhoneNumberFromString(phone);
  return phoneNumber ? phoneNumber.formatInternational() : phone;
};

export function decodeVerificationToken(
  verificationToken: string,
): VerificationToken {
  const [, payloadB64] = verificationToken.split(".");
  if (!payloadB64) {
    throw new Error("Invalid token: missing payload");
  }
  const json = atob(payloadB64);
  return JSON.parse(json) as VerificationToken;
}

export function getClientSignatureMessageForLogin({
  verificationToken,
  sessionPublicKey = undefined,
}: {
  verificationToken: string;
  sessionPublicKey?: string;
}) {
  try {
    const decoded = decodeVerificationToken(verificationToken);

    if (!decoded.public_key)
      throw new TurnkeyError(
        "Invalid verification token: missing publicKey",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );

    const verificationPublicKey = decoded.public_key;

    // if a session public key is provided, we use it instead
    const resolvedSessionPublicKey = sessionPublicKey || verificationPublicKey;

    const usage: v1LoginUsage = { publicKey: resolvedSessionPublicKey };
    const payload: v1TokenUsage = {
      login: usage,
      tokenId: decoded.id,
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

// Keep this local helper aligned with the canonical implementation in @turnkey/core.
export function getClientSignatureMessageForLoginV2({
  verificationToken,
  organizationId,
  publicKey,
  invalidateExisting,
  expirationSeconds,
  sessionProfileId,
}: {
  verificationToken: string;
  organizationId: string;
  publicKey: string;
  invalidateExisting?: boolean;
  expirationSeconds?: string;
  sessionProfileId?: string;
}) {
  try {
    const decoded = decodeVerificationToken(verificationToken);

    if (!decoded.public_key)
      throw new TurnkeyError(
        "Invalid verification token: missing publicKey",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );

    const usage: v1LoginUsageV2 = {
      organizationId,
      publicKey,
      ...(invalidateExisting !== undefined && { invalidateExisting }),
      ...(expirationSeconds !== undefined && { expirationSeconds }),
      ...(sessionProfileId !== undefined && { sessionProfileId }),
    };
    const payload: v1TokenUsage = {
      loginV2: usage,
      tokenId: decoded.id,
      type: "USAGE_TYPE_LOGIN",
    };

    return {
      message: JSON.stringify(payload),
      publicKey: decoded.public_key,
    };
  } catch (error) {
    throw new TurnkeyError(
      "Failed to create strict client signature bundle for login",
      TurnkeyErrorCodes.UNKNOWN,
      error,
    );
  }
}

export async function buildOtpLoginRequest({
  verificationToken,
  organizationId,
  publicKey,
  sessionLengthSeconds,
  sign,
}: {
  verificationToken: string;
  organizationId: string;
  publicKey: string;
  sessionLengthSeconds?: number;
  sign: (message: string) => Promise<string>;
}) {
  const { message, publicKey: signingPublicKey } =
    getClientSignatureMessageForLoginV2({
      verificationToken,
      organizationId,
      publicKey,
      ...(sessionLengthSeconds !== undefined && {
        expirationSeconds: sessionLengthSeconds.toString(),
      }),
    });
  const clientSignature: v1ClientSignature = {
    scheme: "CLIENT_SIGNATURE_SCHEME_API_P256",
    publicKey: signingPublicKey,
    message,
    signature: await sign(message),
  };

  return {
    suborgID: organizationId,
    verificationToken,
    publicKey,
    clientSignature,
    ...(sessionLengthSeconds !== undefined && { sessionLengthSeconds }),
  };
}
