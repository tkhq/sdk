import type { definitions } from "./__generated__/services/coordinator/public/v1/public_api.types";
import { base64StringToBase64UrlEncodedString } from "./encoding";

type TWebAuthnStamp = definitions["v1WebAuthnStamp"];

const timeout = 5 * 60 * 1000;

async function getCredentialRequestOptions(
  payload: string
): Promise<CredentialRequestOptions> {
  const challenge = await getChallengeFromPayload(payload);

  return {
    publicKey: {
      challenge: await new TextEncoder().encode(challenge),
      timeout,
      userVerification: "discouraged",
    },
  };
}

async function getChallengeFromPayload(payload: string): Promise<string> {
  const messageBuffer = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", messageBuffer);
  const base64String = Buffer.from(hashBuffer).toString("base64");
  return base64StringToBase64UrlEncodedString(base64String);
}

export async function getWebAuthnAssertion(payload: string): Promise<string> {
  const { get } = await import("@github/webauthn-json/browser-ponyfill");

  const signingOptions = await getCredentialRequestOptions(payload);
  const clientGetResult = await get(signingOptions);
  const assertion = clientGetResult.toJSON();

  const stamp: TWebAuthnStamp = {
    authenticatorData: assertion.response.authenticatorData,
    clientDataJson: assertion.response.clientDataJSON,
    credentialId: assertion.id,
    signature: assertion.response.signature,
  };

  return JSON.stringify(stamp);
}
