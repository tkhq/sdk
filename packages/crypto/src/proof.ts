import {
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
} from "@turnkey/encoding";
import type { v1AppProof, v1BootProof } from "@turnkey/sdk-types";
import { p256 } from "@noble/curves/p256";
import { sha256, sha384 } from "@noble/hashes/sha2";
import CBOR from "cbor-js";
import * as x509 from "@peculiar/x509";
import { AWS_ROOT_CERT_PEM, AWS_ROOT_CERT_SHA256 } from "./constants";

const QOS_ATTESTABLE_PCR_COUNT = 32;
const SHA256_LENGTH = 32;
const SHA384_LENGTH = 48;
const QOS_EPHEMERAL_PUBLIC_KEY_LENGTH = 130;

export type QosIdentityPcrIndex = 0 | 1 | 2 | 3;
const QOS_IDENTITY_PCR_INDICES: readonly QosIdentityPcrIndex[] = [0, 1, 2, 3];

export type QosVerificationPolicy = {
  allowedManifestSha256: readonly string[];
  expectedPcrs: Readonly<Record<QosIdentityPcrIndex, string>>;
};

type AwsNitroAttestationDocument = {
  cabundle: Uint8Array[];
  certificate: Uint8Array;
  digest: string;
  nonce?: Uint8Array | null;
  pcrs: Record<string, Uint8Array>;
  public_key: Uint8Array;
  user_data: Uint8Array;
};

export const getCryptoInstance = async () => {
  let cryptoInstance: Crypto;
  // Use globalThis.crypto.subtle if available
  if (typeof globalThis !== "undefined" && globalThis.crypto?.subtle) {
    cryptoInstance = globalThis.crypto as Crypto;
    x509.cryptoProvider.set(cryptoInstance);

    return cryptoInstance;
  } else {
    throw new Error(
      "Web Crypto API is not available in this environment. You may need to polyfill it.",
    );
  }
};

/**
 * Utility: SHA-256 digest → hex (uppercase)
 */
async function sha256Hex(data: Uint8Array): Promise<string> {
  const cryptoInstance = await getCryptoInstance();
  const digest = await cryptoInstance.subtle.digest("SHA-256", data);
  return uint8ArrayToHexString(new Uint8Array(digest)).toUpperCase();
}

/**
 * Utility: Import SPKI public key for ECDSA verify
 */
async function importEcdsaPublicKey(spki: ArrayBuffer): Promise<CryptoKey> {
  const cryptoInstance = await getCryptoInstance();
  return cryptoInstance.subtle.importKey(
    "spki",
    spki,
    { name: "ECDSA", namedCurve: "P-384" }, // AWS Nitro uses ES384
    false,
    ["verify"],
  );
}

/**
 * Verifies an app proof and boot proof pair as an example/reference-grade
 * remote-attestation check.
 *
 * This verifies that the app proof signature is valid, the attestation document
 * is signed by the AWS Nitro attestation PKI, the attestation document's
 * `user_data` is the hash of the QOS manifest, and the app proof, boot proof,
 * and attestation document all use the same ephemeral public key.
 *
 * @remarks
 * WARNING: This is not full verification of a Turnkey enclave. It does not
 * verify the enclave identity or image measurements: it does not inspect
 * `attestationDoc.pcrs` (PCR0-3 image measurements), and it does not compare
 * the QOS manifest content against a known-good or pinned Turnkey manifest.
 * Any party with an AWS account can run their own Nitro enclave and produce
 * attestations that pass this check.
 *
 * For full verification, callers must additionally pin and verify the expected
 * PCR measurements and manifest content. See the QOS repository for the
 * reference implementation: https://github.com/tkhq/qos
 *
 * For more information, check out https://whitepaper.turnkey.com/foundations
 */
export async function verify(
  appProof: v1AppProof,
  bootProof: v1BootProof,
): Promise<void> {
  const { manifestDigest } = await verifyPair(appProof, bootProof);
  const decodedBootProofManifest = decodeBase64(bootProof.qosManifestB64);
  const serializedManifestDigest = sha256(decodedBootProofManifest);
  if (!bytesEq(serializedManifestDigest, manifestDigest)) {
    throw new Error(
      `attestationDoc's user_data doesn't match the hash of the manifest. attestationDoc.user_data: ${manifestDigest} , manifest digest: ${serializedManifestDigest}`,
    );
  }
}

/** Verifies a proof pair against trusted QOS PCRs, manifest hashes, and PCR17. */
export async function verifyWithQosPolicy(
  appProof: v1AppProof,
  bootProof: v1BootProof,
  policy: QosVerificationPolicy,
): Promise<void> {
  if (
    !Array.isArray(policy?.allowedManifestSha256) ||
    !policy.allowedManifestSha256.length
  ) {
    throw new Error("QOS policy requires an allowed manifest hash");
  }
  const allowedManifestDigests = policy.allowedManifestSha256.map(
    (digest, index) =>
      decodeFixedHex(digest, SHA256_LENGTH, `allowedManifestSha256[${index}]`),
  );
  const expectedPcrs = QOS_IDENTITY_PCR_INDICES.map((index) =>
    decodeFixedHex(
      policy.expectedPcrs?.[index],
      SHA384_LENGTH,
      `expectedPcrs[${index}]`,
    ),
  );

  const { attestationDoc, manifestDigest } = await verifyPair(
    appProof,
    bootProof,
  );

  if (attestationDoc.digest !== "SHA384") {
    throw new Error(
      `AWS Nitro attestation document must use SHA384, got ${String(attestationDoc.digest)}`,
    );
  }
  if (attestationDoc.nonce !== null && attestationDoc.nonce !== undefined) {
    throw new Error("QOS attestation document must not contain a nonce");
  }
  expectedPcrs.forEach((expected, index) => {
    const actual = getAttestationPcr(attestationDoc, index);
    if (!bytesEq(actual, expected)) {
      throw new Error(
        `QOS PCR${index} does not match policy: expected=${bytesToHex(expected)} actual=${bytesToHex(actual)}`,
      );
    }
  });

  if (
    !allowedManifestDigests.some((allowed) => bytesEq(allowed, manifestDigest))
  ) {
    throw new Error(
      `QOS manifest digest is not allowed by policy: ${bytesToHex(manifestDigest)}`,
    );
  }

  if (
    Object.keys(attestationDoc.pcrs ?? {}).length !== QOS_ATTESTABLE_PCR_COUNT
  ) {
    throw new Error(
      `QOS attestation document must contain exactly ${QOS_ATTESTABLE_PCR_COUNT} PCRs`,
    );
  }
  for (let index = 0; index < QOS_ATTESTABLE_PCR_COUNT; index++) {
    getAttestationPcr(attestationDoc, index);
  }

  const expectedLivePcr = computeQosLiveManifestCommitmentPcr(
    manifestDigest,
    asBytes(attestationDoc.public_key, "attestation document public_key"),
  );
  const actualLivePcr = getAttestationPcr(attestationDoc, 17);
  if (!bytesEq(actualLivePcr, expectedLivePcr)) {
    throw new Error(
      `QOS PCR17 live manifest commitment mismatch: expected=${bytesToHex(expectedLivePcr)} actual=${bytesToHex(actualLivePcr)}`,
    );
  }
}

/** Computes the QOS setup manifest/Ephemeral Key commitment PCR16 value. */
export function computeQosSetupManifestCommitmentPcr(
  manifestDigest: Uint8Array,
  ephemeralPublicKey: Uint8Array,
): Uint8Array {
  return computeQosManifestCommitmentPcr(
    "qos-setup-manifest-pcr-commitment-v1",
    manifestDigest,
    ephemeralPublicKey,
  );
}

/** Computes the QOS live manifest/Ephemeral Key commitment PCR17 value. */
export function computeQosLiveManifestCommitmentPcr(
  manifestDigest: Uint8Array,
  ephemeralPublicKey: Uint8Array,
): Uint8Array {
  return computeQosManifestCommitmentPcr(
    "qos-live-manifest-pcr-commitment-v1",
    manifestDigest,
    ephemeralPublicKey,
  );
}

function computeQosManifestCommitmentPcr(
  domain: string,
  manifestDigest: Uint8Array,
  ephemeralPublicKey: Uint8Array,
): Uint8Array {
  if (manifestDigest.length !== SHA256_LENGTH) {
    throw new Error(
      `QOS manifest digest must be ${SHA256_LENGTH} bytes, got ${manifestDigest.length}`,
    );
  }
  if (ephemeralPublicKey.length !== QOS_EPHEMERAL_PUBLIC_KEY_LENGTH) {
    throw new Error(
      `QOS Ephemeral Public Key must be ${QOS_EPHEMERAL_PUBLIC_KEY_LENGTH} bytes, got ${ephemeralPublicKey.length}`,
    );
  }

  const preimage = new TextEncoder().encode(
    `{"domain":"${domain}","ephemeralPublicKey":"${bytesToHex(ephemeralPublicKey)}","manifestHash":"${bytesToHex(manifestDigest)}"}`,
  );
  const commitment = sha384(preimage);
  const extensionInput = new Uint8Array(SHA384_LENGTH + commitment.length);
  extensionInput.set(commitment, SHA384_LENGTH);
  return sha384(extensionInput);
}

async function verifyPair(appProof: v1AppProof, bootProof: v1BootProof) {
  // 1. Verify App Proof
  verifyAppProofSignature(appProof);

  // 2. Verify Boot Proof
  // Parse attestation
  const coseSign1Der = decodeBase64(bootProof.awsAttestationDocB64);
  const coseSign1 = CBOR.decode(coseSign1Der.buffer);
  const [, , payload] = coseSign1;
  const attestationDoc = CBOR.decode(
    new Uint8Array(payload).buffer,
  ) as AwsNitroAttestationDocument;

  // Verify cose sign1 signature
  await verifyCoseSign1Sig(coseSign1, attestationDoc.certificate);

  // Verify certificate chain
  const appProofTimestampMs = parseInt(
    JSON.parse(appProof.proofPayload).timestampMs,
  );
  await verifyCertificateChain(
    attestationDoc.cabundle,
    AWS_ROOT_CERT_PEM,
    attestationDoc.certificate,
    appProofTimestampMs,
  );

  // Verify manifest digest
  const manifestDigest = asBytes(
    attestationDoc.user_data,
    "attestation document user_data manifest hash",
  );
  if (manifestDigest.length !== SHA256_LENGTH) {
    throw new Error(
      `QOS attestation user_data manifest hash must be ${SHA256_LENGTH} bytes, got ${manifestDigest.length}`,
    );
  }

  // 3. Verify that all the ephemeral public keys match: app proof, boot proof structure, actual attestation doc
  const publicKeyBytes = new Uint8Array(attestationDoc.public_key);
  const attestationPubKey = uint8ArrayToHexString(publicKeyBytes);
  if (
    appProof.publicKey !== attestationPubKey ||
    attestationPubKey !== bootProof.ephemeralPublicKeyHex
  ) {
    throw new Error(
      `Ephemeral pub keys from app proof: ${appProof.publicKey}, boot proof structure ${bootProof.ephemeralPublicKeyHex}, and attestation doc ${attestationPubKey} should all match`,
    );
  }

  return { attestationDoc, manifestDigest };
}

/**
 * Verify app proof signature with @noble/curves
 */
export function verifyAppProofSignature(appProof: v1AppProof): void {
  if (appProof.scheme !== "SIGNATURE_SCHEME_EPHEMERAL_KEY_P256") {
    throw new Error("Unsupported signature scheme");
  }

  // Decode public key
  let publicKeyBytes: Uint8Array;
  try {
    publicKeyBytes = uint8ArrayFromHexString(appProof.publicKey);
  } catch {
    throw new Error("Failed to decode public key");
  }

  if (publicKeyBytes.length !== 130) {
    throw new Error(
      `Expected 130 bytes (encryption + signing pub keys), got ${publicKeyBytes.length} bytes`,
    );
  }

  // Extract signing key (last 65 bytes, uncompressed P-256 point)
  const signingKeyBytes = publicKeyBytes.slice(65);
  if (signingKeyBytes.length !== 65 || signingKeyBytes[0] !== 0x04) {
    throw new Error(
      "Invalid signing key format: expected 65-byte uncompressed P-256 point (0x04||X||Y)",
    );
  }

  // Validate it's a valid P-256 public key by attempting to create a point
  try {
    p256.ProjectivePoint.fromHex(signingKeyBytes);
  } catch (error) {
    throw new Error(`Invalid P-256 public key: ${error}`);
  }

  // Decode signature (64 bytes = 32 bytes r + 32 bytes s)
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = uint8ArrayFromHexString(appProof.signature);
  } catch {
    throw new Error("Failed to decode signature");
  }
  if (signatureBytes.length !== 64) {
    throw new Error(
      `Expected 64 bytes signature (r||s), got ${signatureBytes.length} bytes`,
    );
  }

  // Hash the proof payload
  const payloadBytes = new TextEncoder().encode(appProof.proofPayload);
  const payloadDigest = sha256(payloadBytes);

  // Verify ECDSA signature
  const isValid = p256.verify(signatureBytes, payloadDigest, signingKeyBytes);
  if (!isValid) {
    throw new Error("Signature verification failed");
  }
}

export async function verifyCertificateChain(
  cabundle: Uint8Array[],
  rootCertPem: string,
  leafCert: Uint8Array,
  timestampMs: number,
): Promise<void> {
  try {
    // Check root and assert fingerprint
    const rootX509 = new x509.X509Certificate(rootCertPem);
    const rootDer = new Uint8Array(rootX509.rawData);
    const rootSha = await sha256Hex(rootDer);
    if (rootSha !== AWS_ROOT_CERT_SHA256) {
      throw new Error(
        `Pinned AWS root fingerprint mismatch: expected=${AWS_ROOT_CERT_SHA256} actual=${rootSha}`,
      );
    }

    // Bundle starts with root certificate. We're replacing the root with our hardcoded known certificate, so remove first element
    const bundleWithoutRoot = cabundle.slice(1);
    const intermediatesX509 = bundleWithoutRoot.map((c) => {
      if (!c) throw new Error("Invalid certificate data in cabundle");
      return new x509.X509Certificate(c);
    });
    const leaf = new x509.X509Certificate(leafCert);

    // Build path leaf → intermediates → root, with our hardcoded known root certificate
    const builder = new x509.X509ChainBuilder({
      certificates: [rootX509, ...intermediatesX509],
    });
    const chain = await builder.build(leaf);
    if (chain.length !== intermediatesX509.length + 2) {
      throw new Error(
        `Incorrect number of certs in X509 Chain. Expected ${intermediatesX509.length + 2}, got ${chain.length}`,
      );
    }

    const appProofDate = new Date(timestampMs);
    for (let i = 0; i < chain.length; i++) {
      const cert = chain[i];
      if (!cert) throw new Error("Invalid certificate in chain");

      if (i === chain.length - 1) {
        // is root
        // Self-signature verification for root certificate
        const ok = await cert.verify({
          publicKey: cert.publicKey,
          date: appProofDate,
        });
        if (!ok)
          throw new Error("Pinned root failed self-signature verification");
      } else {
        // Verify signature against issuer
        const issuer = chain[i + 1];
        if (!issuer) throw new Error("Issuer can't be null");

        // Attestation docs technically expire after 3 hours, so an app proof generated 3+ hours after an enclave
        // boots up will fail verification due to certificate expiration. This is okay because enclaves are immutable;
        // even if the cert is technically invalid, the code contained within it cannot change. To prevent the cert
        // expiration failure, we set `signatureOnly: true`.
        const ok = await cert.verify({
          publicKey: issuer.publicKey,
          signatureOnly: true,
          date: appProofDate,
        });
        if (!ok) {
          throw new Error(
            `Signature check failed: ${cert.subject} not signed by ${issuer?.subject}`,
          );
        }
      }
    }
  } catch (error) {
    throw new Error(
      `Certificate chain verification failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function verifyCoseSign1Sig(
  coseSign1: any,
  leaf: Uint8Array,
): Promise<void> {
  const [protectedHeaders, , payload, signature] = coseSign1;
  const tbs = new Uint8Array(
    CBOR.encode([
      "Signature1",
      new Uint8Array(protectedHeaders),
      new Uint8Array(0),
      new Uint8Array(payload),
    ]),
  );

  const leafCert = new x509.X509Certificate(leaf);
  const pubKey = await importEcdsaPublicKey(leafCert.publicKey.rawData);

  const cryptoInstance = await getCryptoInstance();
  const ok = await cryptoInstance.subtle.verify(
    { name: "ECDSA", hash: { name: "SHA-384" } },
    pubKey,
    new Uint8Array(signature),
    tbs,
  );
  if (!ok) throw new Error("COSE_Sign1 ES384 verification failed");
}

function getAttestationPcr(
  attestationDoc: AwsNitroAttestationDocument,
  index: number,
): Uint8Array {
  const value = attestationDoc.pcrs?.[index];
  if (value === undefined) {
    throw new Error(`AWS Nitro attestation document is missing PCR${index}`);
  }
  const pcr = asBytes(value, `attestation document PCR${index}`);
  if (pcr.length !== SHA384_LENGTH) {
    throw new Error(
      `AWS Nitro attestation document PCR${index} must be ${SHA384_LENGTH} bytes, got ${pcr.length}`,
    );
  }
  return pcr;
}

function decodeFixedHex(
  value: unknown,
  expectedBytes: number,
  label: string,
): Uint8Array {
  if (
    typeof value !== "string" ||
    !new RegExp(`^[0-9a-fA-F]{${expectedBytes * 2}}$`).test(value)
  ) {
    throw new Error(`${label} must be a ${expectedBytes}-byte hex string`);
  }
  return uint8ArrayFromHexString(value.toLowerCase());
}

function asBytes(value: unknown, label: string): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new Error(`${label} must be a byte string`);
}

function bytesToHex(bytes: Uint8Array): string {
  return uint8ArrayToHexString(bytes).toLowerCase();
}

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

function bytesEq(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
