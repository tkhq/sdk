import type { definitions } from "./__generated__/services/coordinator/public/v1/public_api.types";
import { base64StringToBase64UrlEncodedString } from "./encoding";
import type { PublicKeyCredentialWithAttestationJSON } from "@github/webauthn-json";

type TWebAuthnStamp = definitions["v1WebAuthnStamp"];
type TAttestation = definitions["v1Attestation"];
/* hybrid added to spec, but not in polyfill enum for some reason: https://github.com/github/webauthn-json/issues/67 */
// eslint-disable-next-line no-undef -- false negative
type ExternalAuthenticatorTransports = AuthenticatorTransport | "hybrid";
type InternalAuthenticatorTransports =
  definitions["externaldatav1AuthenticatorTransport"];

const defaultTimeout = 5 * 60 * 1000; // five minutes
const defaultUserVerification = "preferred";

// We generate challenge, so user supplies everything else
export type TurnkeyPublicKeyCredentialRequestOptions = {
  /* (challenge: string) is required in CredentialRequestOptions */
  timeout?: number;
  rpId?: string;
  allowCredentials?: PublicKeyCredentialDescriptor[];
  userVerification?: UserVerificationRequirement;
  extensions?: AuthenticationExtensionsClientInputs;
};

export type TurnkeyCredentialRequestOptions = {
  mediation?: CredentialMediationRequirement;
  publicKey: TurnkeyPublicKeyCredentialRequestOptions;
  signal?: AbortSignal;
  password?: boolean;
  unmediated?: boolean;
};

type TurnkeyCredentialCreationOptions = CredentialCreationOptions;

export type { TurnkeyCredentialCreationOptions };

const defaultSigningOptions: TurnkeyCredentialRequestOptions = {
  publicKey: {
    timeout: defaultTimeout,
    userVerification: defaultUserVerification,
  },
};

async function getCredentialRequestOptions(
  payload: string,
  tkSigningOptions: TurnkeyCredentialRequestOptions = defaultSigningOptions
): Promise<CredentialRequestOptions> {
  const stringChallenge = await getChallengeFromPayload(payload);
  const challenge = await new TextEncoder().encode(stringChallenge);

  const signingOptions: CredentialRequestOptions = {
    ...tkSigningOptions,
    publicKey: {
      ...defaultSigningOptions.publicKey,
      ...tkSigningOptions.publicKey,
      challenge,
    },
  };

  return signingOptions;
}

async function getChallengeFromPayload(payload: string): Promise<string> {
  const messageBuffer = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", messageBuffer);
  const base64String = Buffer.from(hashBuffer).toString("base64");
  return base64StringToBase64UrlEncodedString(base64String);
}

/* Pulled from https://www.w3.org/TR/webauthn-2/#enum-transport */
export function protocolTransportEnumToInternalEnum(
  protocolEnum: ExternalAuthenticatorTransports
): InternalAuthenticatorTransports {
  switch (protocolEnum) {
    case "internal": {
      return "AUTHENTICATOR_TRANSPORT_INTERNAL";
    }
    case "usb": {
      return "AUTHENTICATOR_TRANSPORT_USB";
    }
    case "nfc": {
      return "AUTHENTICATOR_TRANSPORT_NFC";
    }
    case "ble": {
      return "AUTHENTICATOR_TRANSPORT_BLE";
    }
    case "hybrid": {
      return "AUTHENTICATOR_TRANSPORT_HYBRID";
    }
    default: {
      throw new Error("unsupported transport format");
    }
  }
}

function toInternalAttestation(
  attestation: PublicKeyCredentialWithAttestationJSON
): TAttestation {
  return {
    credentialId: attestation.rawId,
    attestationObject: attestation.response.attestationObject,
    clientDataJson: attestation.response.clientDataJSON,
    transports: attestation.response.transports.map(
      protocolTransportEnumToInternalEnum
    ),
  };
}

export async function getWebAuthnAssertion(
  payload: string,
  options?: TurnkeyCredentialRequestOptions
): Promise<string> {
  // webauthn-json is an ES module. Nasty!
  const { get: webauthnCredentialGet } = await import(
    "@github/webauthn-json/browser-ponyfill"
  );

  const signingOptions = await getCredentialRequestOptions(payload, options);
  const clientGetResult = await webauthnCredentialGet(signingOptions);
  const assertion = clientGetResult.toJSON();

  const stamp: TWebAuthnStamp = {
    authenticatorData: assertion.response.authenticatorData,
    clientDataJson: assertion.response.clientDataJSON,
    credentialId: assertion.id,
    signature: assertion.response.signature,
  };

  return JSON.stringify(stamp);
}

export async function getWebAuthnAttestation(
  options: TurnkeyCredentialCreationOptions
): Promise<TAttestation> {
  // webauthn-json is an ES module. Nasty!
  const { create: webauthnCredentialCreate } = await import(
    "@github/webauthn-json/browser-ponyfill"
  );

  const res = await webauthnCredentialCreate(options);

  return toInternalAttestation(res.toJSON());
}
