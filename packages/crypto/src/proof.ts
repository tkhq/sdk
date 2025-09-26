import {
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
} from "@turnkey/encoding";
import type { v1AppProof, v1BootProof } from "@turnkey/sdk-types";
import { p256 } from "@noble/curves/p256";
import { sha256 } from "@noble/hashes/sha2";
import * as CBOR from "cbor-js";
import * as x509 from "@peculiar/x509";
import { Crypto as PeculiarCrypto } from "@peculiar/webcrypto";
import { createHash, createPublicKey, createVerify } from "node:crypto";
import { AWS_ROOT_CERT_PEM, AWS_ROOT_CERT_SHA256 } from "./constants";

x509.cryptoProvider.set(new PeculiarCrypto());

/**
 * verify goes through the following verification steps for an app proof & boot proof pair:
 *  - Verify app proof signature
 *  - Verify the boot proof
 *    - Attestation doc was signed by AWS
 *    - Attestation doc's `user_data` is the hash of the qos manifest
 *  - Verify the connection between the app proof & boot proof i.e. that the ephemeral keys match
 *
 * For more information, check out https://whitepaper.turnkey.com/foundations
 */
export async function verify(
  appProof: v1AppProof,
  bootProof: v1BootProof,
): Promise<void> {
  // 1. Verify App Proof
  verifyAppProofSignature(appProof);

  // 2. Verify Boot Proof
  // Parse attestation
  const coseSign1Der = Uint8Array.from(
    atob(bootProof.awsAttestationDocB64)
      .split("")
      .map((c) => c.charCodeAt(0)),
  );
  const coseSign1 = CBOR.decode(coseSign1Der.buffer);
  const [, , payload] = coseSign1;
  const attestationDoc = CBOR.decode(new Uint8Array(payload).buffer);

  // Verify cose sign1 signature
  verifyCoseSign1Sig(coseSign1, attestationDoc.certificate);

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
  const decodedBootProofManifest = Uint8Array.from(
    atob(bootProof.qosManifestB64)
      .split("")
      .map((c) => c.charCodeAt(0)),
  );
  const manifestDigest = sha256(decodedBootProofManifest);
  if (!bytesEq(manifestDigest, attestationDoc.user_data)) {
    throw new Error(
      `attestationDoc's user_data doesn't match the hash of the manifest. attestationDoc.user_data: ${attestationDoc.user_data} , manifest digest: ${manifestDigest}`,
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
}

export function verifyAppProofSignature(appProof: v1AppProof): void {
  if (appProof.scheme !== "SIGNATURE_SCHEME_EPHEMERAL_KEY_P256") {
    throw new Error("Unsupported signature scheme");
  }

  // Decode public key (130 bytes = 65 encryption key + 65 signing key)
  let publicKeyBytes: Uint8Array;
  try {
    publicKeyBytes = uint8ArrayFromHexString(appProof.publicKey);
  } catch (error) {
    throw new Error("Failed to decode public key");
  }

  if (publicKeyBytes.length !== 130) {
    throw new Error(
      `Expected 130 bytes (encryption + signing pub keys), got ${publicKeyBytes.length} bytes`,
    );
  }

  // Extract signing key (last 65 bytes)
  const signingKeyBytes = publicKeyBytes.slice(65);

  // Validate signing key format (65 bytes, starts with 0x04 for uncompressed)
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
  } catch (error) {
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
    const rootSha = createHash("sha256")
      .update(rootDer)
      .digest("hex")
      .toUpperCase();
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
    if (chain.length !== intermediatesX509.length + 2)
      throw new Error(
        `Incorrect number of certs in X509 Chain. Expected ${intermediatesX509.length + 2}, got ${chain.length}`,
      );

    // It appears `builder.build` does signature-only verification of the chain, but there's no commitement to that in the
    // public api, so we loop through the chain and do (maybe redundant) signature verification
    const appProofDate = new Date(timestampMs);
    for (let i = 0; i < chain.length; i++) {
      const cert = chain[i];
      if (!cert) throw new Error("Invalid certificate in chain");

      // Verify signature
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
        if (!ok)
          throw new Error(
            `Signature check failed: ${cert.subject} not signed by ${issuer.subject}`,
          );
      }
    }
  } catch (error) {
    throw new Error(
      `Certificate chain verification failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function bytesEq(a: ArrayBuffer, b: ArrayBuffer) {
  const A = new Uint8Array(a),
    B = new Uint8Array(b);
  if (A.length !== B.length) return false;
  for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return false;
  return true;
}

export function verifyCoseSign1Sig(coseSign1: any, leaf: Uint8Array): void {
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
  const pubKey = createPublicKey(leafCert.publicKey.toString("pem"));

  const verify = createVerify("sha384");
  verify.update(tbs);
  verify.end();
  const ok = verify.verify(
    { key: pubKey, dsaEncoding: "ieee-p1363" as any },
    new Uint8Array(signature),
  );
  if (!ok) throw new Error("COSE_Sign1 ES384 verification failed");
}
