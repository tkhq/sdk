import { TurnkeyClient, createActivityPoller } from "@turnkey/http";
import { ALG_ES256, PUBKEY_CRED_TYPE } from "./constants";

import { TWebauthnStamperConfig } from "@turnkey/webauthn-stamper";
import { base64UrlEncode, generateRandomBuffer } from "./utils";
import { PasskeyRegistrationResult } from "./types";
import { env } from "@/env.mjs";

const { NEXT_PUBLIC_TURNKEY_RPID } = env;

export type Email = `${string}@${string}.${string}`;

export const createWebauthnStamper = async (
  options?: TWebauthnStamperConfig
) => {
  const { WebauthnStamper } = await import("@turnkey/webauthn-stamper");
  const rpId = options?.rpId || NEXT_PUBLIC_TURNKEY_RPID;
  if (!rpId) {
    throw "Error must provide rpId or define TURNKEY_RPID in your .env file";
  }

  return new WebauthnStamper({
    ...options,
    rpId,
  });
};

export const registerPassKey = async (
  email: Email
): Promise<PasskeyRegistrationResult> => {
  const { getWebAuthnAttestation } = await import("@turnkey/http");
  const challenge = generateRandomBuffer();
  const authenticatorUserId = generateRandomBuffer();

  // An example of possible options can be found here:
  // https://www.w3.org/TR/webauthn-2/#sctn-sample-registration
  const attestation = await getWebAuthnAttestation({
    publicKey: {
      rp: {
        id: NEXT_PUBLIC_TURNKEY_RPID,
        name: "Tunkey Demo Wallet",
      },
      challenge,
      pubKeyCredParams: [
        {
          type: PUBKEY_CRED_TYPE,
          alg: ALG_ES256,
        },
      ],
      user: {
        id: authenticatorUserId,
        name: email.split("@")[0],
        displayName: email.split("@")[0],
      },
      authenticatorSelection: {
        requireResidentKey: true,
        residentKey: "required",
        userVerification: "preferred",
      },
    },
  });

  return { challenge: base64UrlEncode(challenge), attestation };
};
