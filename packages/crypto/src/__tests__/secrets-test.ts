import { test, expect } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import { p256 } from "@noble/curves/p256";
import { sha256 } from "@noble/hashes/sha256";
import {
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
} from "@turnkey/encoding";

import { decryptSecretBundle, encryptSecretToBundle } from "../turnkey";
import { generateP256KeyPair } from "../crypto";

// Captured from a real `export_secrets` activity against api.turnkey.com. The
// embedded private key was single-use and the plaintext is demo data, so the
// fixture carries no live credentials.
const fixture = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../__fixtures__/secret-payload.json"),
    "utf8",
  ),
);

test("decryptSecretBundle verifies the enclave signature and returns the plaintext", async () => {
  const plaintext = await decryptSecretBundle({
    secretPayload: fixture.secretPayload,
    embeddedPrivateKey: fixture.embeddedPrivateKey,
    organizationId: fixture.organizationId,
  });

  expect(plaintext).toBe(fixture.plaintext);
});

// Synthetic signed-bundle coverage: an in-test P-256 "signer enclave quorum
// key" signs bundles the same way the real signer enclave does (ECDSA P-256
// over sha256 of the hex-decoded `data` bytes, DER-encoded signature), and
// tests verify against it via `dangerouslyOverrideSignerPublicKey`.

const ORGANIZATION_ID = "8b12ef17-3599-4d18-8135-33fa50ba1b28";

const signer = generateP256KeyPair();

/** Builds a signed bundle envelope ({data, dataSignature, enclaveQuorumPublic}). */
const signBundle = (
  signedFields: Record<string, string>,
  signingKey: ReturnType<typeof generateP256KeyPair> = signer,
): string => {
  const dataBytes = new TextEncoder().encode(JSON.stringify(signedFields));
  const dataSignature = p256
    .sign(sha256(dataBytes), uint8ArrayFromHexString(signingKey.privateKey))
    .toDERHex();
  return JSON.stringify({
    data: uint8ArrayToHexString(dataBytes),
    dataSignature,
    enclaveQuorumPublic: signingKey.publicKeyUncompressed,
  });
};

test("encryptSecretToBundle and decryptSecretBundle round-trip a secret", async () => {
  // Ingress: encrypt a secret to a signed target key, as importSecret does.
  const target = generateP256KeyPair();
  const { secretPayload, targetPublicKey } = await encryptSecretToBundle({
    plaintext: "synthetic-secret-plaintext",
    ingressTargetBundle: signBundle({
      organizationId: ORGANIZATION_ID,
      targetPublic: target.publicKeyUncompressed,
    }),
    organizationId: ORGANIZATION_ID,
    dangerouslyOverrideSignerPublicKey: signer.publicKeyUncompressed,
  });
  expect(targetPublicKey).toBe(target.publicKeyUncompressed);

  // Egress: wrap the encryption-suite fields in a signed payload, as the
  // enclave does for export_secrets, and decrypt with the target private key.
  const { encappedPublic, ciphertext } = JSON.parse(secretPayload);
  const plaintext = await decryptSecretBundle({
    secretPayload: signBundle({
      organizationId: ORGANIZATION_ID,
      encappedPublic,
      ciphertext,
    }),
    embeddedPrivateKey: target.privateKey,
    organizationId: ORGANIZATION_ID,
    dangerouslyOverrideSignerPublicKey: signer.publicKeyUncompressed,
  });
  expect(plaintext).toBe("synthetic-secret-plaintext");
});

test("encryptSecretToBundle rejects bundles that fail signature verification", async () => {
  const rogue = generateP256KeyPair();
  const signedFields = {
    organizationId: ORGANIZATION_ID,
    targetPublic: rogue.publicKeyUncompressed,
  };

  // A quorum key other than the expected signer key is rejected outright.
  await expect(
    encryptSecretToBundle({
      plaintext: "secret",
      ingressTargetBundle: signBundle(signedFields, rogue),
      organizationId: ORGANIZATION_ID,
      dangerouslyOverrideSignerPublicKey: signer.publicKeyUncompressed,
    }),
  ).rejects.toThrow("does not match signer key from bundle");

  // A bundle claiming the trusted quorum key but signed by another key fails
  // signature verification.
  const forged = JSON.parse(signBundle(signedFields, rogue));
  forged.enclaveQuorumPublic = signer.publicKeyUncompressed;
  await expect(
    encryptSecretToBundle({
      plaintext: "secret",
      ingressTargetBundle: JSON.stringify(forged),
      organizationId: ORGANIZATION_ID,
      dangerouslyOverrideSignerPublicKey: signer.publicKeyUncompressed,
    }),
  ).rejects.toThrow("failed to verify enclave signature");
});

test("decryptSecretBundle rejects a payload signed for a different organization", async () => {
  const target = generateP256KeyPair();
  await expect(
    decryptSecretBundle({
      secretPayload: signBundle({
        organizationId: "0ed40611-c0d4-4e27-b1c4-4770eb2e15bf",
        encappedPublic: target.publicKeyUncompressed,
        ciphertext: "abab",
      }),
      embeddedPrivateKey: target.privateKey,
      organizationId: ORGANIZATION_ID,
      dangerouslyOverrideSignerPublicKey: signer.publicKeyUncompressed,
    }),
  ).rejects.toThrow("organization id does not match expected value");
});

test("signed bundles missing key material are rejected", async () => {
  const target = generateP256KeyPair();
  await expect(
    encryptSecretToBundle({
      plaintext: "secret",
      ingressTargetBundle: signBundle({ organizationId: ORGANIZATION_ID }),
      organizationId: ORGANIZATION_ID,
      dangerouslyOverrideSignerPublicKey: signer.publicKeyUncompressed,
    }),
  ).rejects.toThrow('missing "targetPublic" in bundle signed data');

  await expect(
    decryptSecretBundle({
      secretPayload: signBundle({
        organizationId: ORGANIZATION_ID,
        ciphertext: "abab",
      }),
      embeddedPrivateKey: target.privateKey,
      organizationId: ORGANIZATION_ID,
      dangerouslyOverrideSignerPublicKey: signer.publicKeyUncompressed,
    }),
  ).rejects.toThrow('missing "encappedPublic" in payload signed data');
});

test("decryptSecretBundle fails when the ciphertext does not authenticate", async () => {
  const target = generateP256KeyPair();
  const { secretPayload } = await encryptSecretToBundle({
    plaintext: "synthetic-secret-plaintext",
    ingressTargetBundle: signBundle({
      organizationId: ORGANIZATION_ID,
      targetPublic: target.publicKeyUncompressed,
    }),
    organizationId: ORGANIZATION_ID,
    dangerouslyOverrideSignerPublicKey: signer.publicKeyUncompressed,
  });

  // Flip one ciphertext byte and re-sign so the envelope still verifies:
  // decryption itself must reject the tampered data (AES-GCM auth failure).
  const { encappedPublic, ciphertext } = JSON.parse(secretPayload);
  const lastByte = parseInt(ciphertext.slice(-2), 16) ^ 0xff;
  const tampered =
    ciphertext.slice(0, -2) + lastByte.toString(16).padStart(2, "0");
  await expect(
    decryptSecretBundle({
      secretPayload: signBundle({
        organizationId: ORGANIZATION_ID,
        encappedPublic,
        ciphertext: tampered,
      }),
      embeddedPrivateKey: target.privateKey,
      organizationId: ORGANIZATION_ID,
      dangerouslyOverrideSignerPublicKey: signer.publicKeyUncompressed,
    }),
  ).rejects.toThrow("Unable to perform hpkeDecrypt");
});
