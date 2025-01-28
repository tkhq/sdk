import { TurnkeyClient } from "@turnkey/http";
import { WebauthnStamper } from "@turnkey/webauthn-stamper";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { PUBKEY_CRED_TYPE, ALG_ES256 } from "./constants";
import { Email, PasskeyRegistrationResult } from "./types";
import type { Chain } from "viem";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const generateRandomBuffer = (): ArrayBuffer => {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return arr.buffer;
};

export const base64UrlEncode = (challenge: ArrayBuffer): string =>
  Buffer.from(challenge)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

const defaultLengths = {
  prefixLength: 8,
  suffixLength: 6,
};

export const truncate = (
  addr: string,
  {
    prefixLength = defaultLengths.prefixLength,
    suffixLength = defaultLengths.suffixLength,
  }: { prefixLength: number; suffixLength: number } = defaultLengths
) => {
  if (addr.length <= prefixLength + suffixLength) {
    return addr;
  }

  return `${addr.substring(0, prefixLength)}...${addr.substring(
    addr.length - suffixLength
  )}`;
};

export const getTurnkeyClient = () => {
  return new TurnkeyClient(
    { baseUrl: process.env.NEXT_PUBLIC_BASE_URL! },
    new WebauthnStamper({
      rpId: process.env.NEXT_PUBLIC_WEBAUTHN_RPID!,
    })
  );
};

export const registerPassKey = async (
  email: Email
): Promise<PasskeyRegistrationResult> => {
  if (!process.env.NEXT_PUBLIC_WEBAUTHN_RPID) {
    throw "Error must define NEXT_PUBLIC_WEBAUTHN_RPID in your .env file";
  }

  // @todo - Add error handling
  const { getWebAuthnAttestation } = await import("@turnkey/http");
  const challenge = generateRandomBuffer();
  const authenticatorUserId = generateRandomBuffer();
  const user = email.split("@")[0];
  // An example of possible options can be found here:
  // https://www.w3.org/TR/webauthn-2/#sctn-sample-registration
  const attestation = await getWebAuthnAttestation({
    publicKey: {
      rp: {
        id: process.env.NEXT_PUBLIC_WEBAUTHN_RPID,
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
        name: user,
        displayName: user,
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

export const estimateFees = async (chain: Chain) => {
  const { createPublicClient, http, numberToHex } = await import("viem");

  const publicClient = createPublicClient({
    chain,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL),
  });

  const { maxFeePerGas, maxPriorityFeePerGas } =
    await publicClient.estimateFeesPerGas();
  return maxFeePerGas && maxPriorityFeePerGas
    ? {
        maxFeePerGas: numberToHex(maxFeePerGas * BigInt(2)),
        maxPriorityFeePerGas: numberToHex(maxPriorityFeePerGas * BigInt(2)),
      }
    : {};
};
