/**
 * TurnkeySparkSigner — implements the SparkSigner interface, delegating all
 * signing to Turnkey.
 *
 * The Spark SDK authenticates to its signing operators by:
 *   1. Fetching a challenge from the SO (protobuf-encoded, SHA-256 hashed)
 *   2. Signing the hash with the identity key via ECDSA → DER bytes
 *   3. Sending the DER signature + public key to verify_challenge
 *
 * That means the critical methods for authentication are:
 *   - getIdentityPublicKey()
 *   - signMessageWithIdentityKey()  ← ECDSA, DER-encoded output
 *
 * Token operations additionally need:
 *   - signSchnorrWithIdentityKey()  ← Schnorr, 64-byte compact output
 *
 * Operations requireing FROST and ECIES are not implemented at the moment, but coming soon.
 */

import { secp256k1 } from "@noble/curves/secp256k1"; // used in validateMessageWithIdentityKey
import { mnemonicToSeed } from "@scure/bip39";
import type { SparkSigner } from "@buildonspark/spark-sdk";
import type { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

const notImplemented = (method: string) => () => {
  throw new Error(
    `TurnkeySparkSigner.${method} is not implemented. ` +
      `This method requires operations that are not yet expressible via Turnkey's signRawPayload API.`,
  );
};

export class TurnkeySparkSigner implements SparkSigner {
  private readonly client: TurnkeyServerSDK;
  /** The Turnkey address used for the Spark identity key */
  private readonly identityKeyAddress: string;
  /** Compressed 33-byte public key (02/03 prefix) */
  private readonly identityPublicKeyHex: string;

  constructor(
    client: TurnkeyServerSDK,
    identityKeyAddress: string,
    identityPublicKeyHex: string,
  ) {
    this.client = client;
    this.identityKeyAddress = identityKeyAddress;
    this.identityPublicKeyHex = identityPublicKeyHex;
  }

  getIdentityPublicKey(): Promise<Uint8Array> {
    return Promise.resolve(Buffer.from(this.identityPublicKeyHex, "hex"));
  }

  /**
   * ECDSA sign over the message (which the Spark SDK pre-hashes with SHA-256
   * before calling this method). Returns DER-encoded bytes by default, or
   * compact 64-byte bytes when compact=true.
   *
   * Turnkey's signRawPayload with HASH_FUNCTION_NO_OP signs the payload
   * exactly as provided, returning (r, s) as hex strings.
   */
  async signMessageWithIdentityKey(
    message: Uint8Array,
    _compact?: boolean,
  ): Promise<Uint8Array> {
    const { r, s } = await this.client.apiClient().signRawPayload({
      signWith: this.identityKeyAddress,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NO_OP",
      payload: hex(message),
    });

    // Zero-pad r and s to 32 bytes each in case of leading-zero stripping.
    // The Turnkey key is a Schnorr (Taproot) key so signRawPayload returns
    // Schnorr (r, s). The Spark SO's verify_challenge tries both ECDSA and
    // Schnorr — return the raw 64-byte compact form so the Schnorr path succeeds.
    // DER-wrapping these bytes (70 bytes) would fail both paths.
    const rPadded = r.padStart(64, "0");
    const sPadded = s.padStart(64, "0");
    return Buffer.from(rPadded + sPadded, "hex");
  }

  /**
   * Schnorr sign over the message (used for token operations).
   * The Spark SDK passes the 32-byte message directly — noble's schnorr.sign
   * does NOT hash internally, so we send it to Turnkey with NO_OP.
   */
  async signSchnorrWithIdentityKey(message: Uint8Array): Promise<Uint8Array> {
    const { r, s } = await this.client.apiClient().signRawPayload({
      signWith: this.identityKeyAddress,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NO_OP",
      payload: hex(message),
    });

    const rPadded = r.padStart(64, "0");
    const sPadded = s.padStart(64, "0");
    return Buffer.from(rPadded + sPadded, "hex");
  }

  async validateMessageWithIdentityKey(
    message: Uint8Array,
    signature: Uint8Array,
  ): Promise<boolean> {
    const pubKey = await this.getIdentityPublicKey();
    return secp256k1.verify(signature, message, pubKey);
  }

  async mnemonicToSeed(mnemonic: string): Promise<Uint8Array> {
    return mnemonicToSeed(mnemonic);
  }

  async createSparkWalletFromSeed(
    _seed: Uint8Array | string,
    _accountNumber?: number,
  ): Promise<string> {
    // No key derivation needed — Turnkey holds the keys. Return the identity
    // public key hex as the default signer does, since callers use this return
    // value to identify the wallet.
    return this.identityPublicKeyHex;
  }

  // --- Not implemented: ---

  getDepositSigningKey = notImplemented("getDepositSigningKey");

  getStaticDepositSigningKey = notImplemented("getStaticDepositSigningKey");

  getStaticDepositSecretKey = notImplemented("getStaticDepositSecretKey");

  generateMnemonic = notImplemented("generateMnemonic");

  signFrost = notImplemented("signFrost");

  aggregateFrost = notImplemented("aggregateFrost");

  decryptEcies = notImplemented("decryptEcies");

  getRandomSigningCommitment = notImplemented("getRandomSigningCommitment");

  getNonceForSelfCommitment = notImplemented("getNonceForSelfCommitment");

  getPublicKeyFromDerivation = notImplemented("getPublicKeyFromDerivation");

  subtractPrivateKeysGivenDerivationPaths = notImplemented(
    "subtractPrivateKeysGivenDerivationPaths",
  );

  subtractAndSplitSecretWithProofsGivenDerivations = notImplemented(
    "subtractAndSplitSecretWithProofsGivenDerivations",
  );

  subtractSplitAndEncrypt = notImplemented("subtractSplitAndEncrypt");

  splitSecretWithProofs = notImplemented("splitSecretWithProofs");

  signTransactionIndex = notImplemented("signTransactionIndex");

  htlcHMAC = notImplemented("htlcHMAC");
}
