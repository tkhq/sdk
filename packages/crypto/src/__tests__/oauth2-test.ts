import { test, expect } from "@jest/globals";
import { p256 } from "@noble/curves/p256";
import { sha256 } from "@noble/hashes/sha256";
import {
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
} from "@turnkey/encoding";

import { generateP256KeyPair, hpkeDecrypt } from "../crypto";
import {
  encryptOauth2ToBundle,
  oauth2AuthenticatePurposeBinding,
  type Oauth2AuthenticationBundle,
} from "../turnkey";

const ORGANIZATION_ID = "8a1e6f5c-0000-4000-8000-000000000001";

const bundle: Oauth2AuthenticationBundle = {
  organizationId: ORGANIZATION_ID,
  oauth2CredentialId: "10000000-0000-4000-8000-000000000001",
  clientId: "client-id",
  provider: "OAUTH2_PROVIDER_X",
  authCode: "auth-code",
  codeVerifier: "v".repeat(43),
  redirectUri: "https://example.com/callback",
  nonce: "a".repeat(64),
};

const expectedPayload = {
  organization_id: bundle.organizationId,
  oauth2_credential_id: bundle.oauth2CredentialId,
  client_id: bundle.clientId,
  provider: bundle.provider,
  auth_code: bundle.authCode,
  code_verifier: bundle.codeVerifier,
  redirect_uri: bundle.redirectUri,
  nonce: bundle.nonce,
};

// Returns a target signed by a fresh quorum key, the quorum public key, and the target's private key.
const signedTarget = (signedData: Record<string, string>) => {
  const quorum = generateP256KeyPair();
  const target = generateP256KeyPair();
  const data = new TextEncoder().encode(
    JSON.stringify({
      targetPublic: target.publicKeyUncompressed,
      ...signedData,
    }),
  );
  const dataSignature = p256
    .sign(sha256(data), uint8ArrayFromHexString(quorum.privateKey))
    .toDERHex();

  return {
    enclaveTargetMessage: JSON.stringify({
      version: "v1.0.0",
      data: uint8ArrayToHexString(data),
      dataSignature,
      enclaveQuorumPublic: quorum.publicKeyUncompressed,
    }),
    quorumPublicKey: quorum.publicKeyUncompressed,
    target,
  };
};

const decrypt = (
  encryptedMessage: string,
  receiverPriv: string,
  purposeBinding: Uint8Array,
) => {
  const { encappedPublic, ciphertext } = JSON.parse(encryptedMessage);
  return JSON.parse(
    new TextDecoder().decode(
      hpkeDecrypt({
        ciphertextBuf: uint8ArrayFromHexString(ciphertext),
        encappedKeyBuf: uint8ArrayFromHexString(encappedPublic),
        receiverPriv,
        purposeBinding,
      }),
    ),
  );
};

test("encryptOauth2ToBundle encrypts the inputs bound to the credential ID", async () => {
  const { enclaveTargetMessage, quorumPublicKey, target } = signedTarget({
    organizationId: ORGANIZATION_ID,
    userId: "",
  });

  for (const bearerTokenTargetPublicKey of [undefined, "04abcd"]) {
    const { encryptedMessage, targetPublicKey } = await encryptOauth2ToBundle({
      bundle: { ...bundle, bearerTokenTargetPublicKey },
      enclaveTargetMessage,
      dangerouslyOverrideSignerPublicKey: quorumPublicKey,
    });

    expect(targetPublicKey).toBe(target.publicKeyUncompressed);
    expect(
      decrypt(
        encryptedMessage,
        target.privateKey,
        oauth2AuthenticatePurposeBinding(bundle.oauth2CredentialId),
      ),
    ).toEqual(
      bearerTokenTargetPublicKey
        ? {
            ...expectedPayload,
            bearer_token_target_public_key: bearerTokenTargetPublicKey,
          }
        : expectedPayload,
    );

    for (const binding of [
      new Uint8Array(),
      oauth2AuthenticatePurposeBinding("10000000-0000-4000-8000-000000000002"),
    ]) {
      expect(() =>
        decrypt(encryptedMessage, target.privateKey, binding),
      ).toThrow();
    }
  }
});

test("encryptOauth2ToBundle verifies the target against the TLS Fetcher key by default", async () => {
  const { enclaveTargetMessage, quorumPublicKey } = signedTarget({
    organizationId: ORGANIZATION_ID,
  });

  await expect(
    encryptOauth2ToBundle({ bundle, enclaveTargetMessage }),
  ).rejects.toThrow(
    `does not match signer key from bundle: ${quorumPublicKey}`,
  );
});

test("encryptOauth2ToBundle rejects a target signed for another organization or a user", async () => {
  for (const [signedData, message] of [
    [
      { organizationId: "0e51e13c-0000-4000-8000-000000000002" },
      `organization id does not match expected value. Expected: ${ORGANIZATION_ID}. Found: 0e51e13c-0000-4000-8000-000000000002.`,
    ],
    [
      { organizationId: ORGANIZATION_ID, userId: "user-1" },
      "OAuth 2.0 target user id must be empty. Found: user-1.",
    ],
  ] as const) {
    const { enclaveTargetMessage, quorumPublicKey } = signedTarget(signedData);

    await expect(
      encryptOauth2ToBundle({
        bundle,
        enclaveTargetMessage,
        dangerouslyOverrideSignerPublicKey: quorumPublicKey,
      }),
    ).rejects.toThrow(message);
  }
});
