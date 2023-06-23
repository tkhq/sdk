import type { definitions } from "./__generated__/services/coordinator/public/v1/public_api.types";
import { base64StringToBase64UrlEncodedString } from "./encoding";

type TWebAuthnStamp = definitions["v1WebAuthnStamp"];

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
