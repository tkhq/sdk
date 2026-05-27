/**
 * TurnkeySparkSigner — implements the SparkSigner interface, delegating all
 * signing and key operations to Turnkey.
 *
 * Authentication (identity key operations):
 *   - getIdentityPublicKey()
 *   - signMessageWithIdentityKey()   ← ECDSA via compressed address, or Schnorr via Spark address
 *   - signSchnorrWithIdentityKey()   ← BIP340 Schnorr via Spark address
 *
 * Turnkey's signRawPayload dispatches Schnorr vs ECDSA based on the address
 * format. The signer usually holds two addresses for the same underlying key:
 *   - sparkAddress  → ADDRESS_FORMAT_SPARK_* → SchnorrPlain (BIP340)
 *   - ecdsaAddress  → ADDRESS_FORMAT_COMPRESSED → ECDSA
 * If a wallet was imported with only its Spark-formatted address available,
 * ecdsaAddress may also be set to the Spark address for Schnorr identity
 * signatures.
 *
 * FROST signing (via SPARK_SIGN_FROST activity):
 *   - getRandomSigningCommitment()   ← returns mutable placeholder
 *   - signFrost()                    ← calls Turnkey, mutates commitment
 *   - aggregateFrost()               ← client-side signature aggregation
 *
 * Package construction — separate activities, no FROST signing:
 *   - prepareTransfer()              ← SPARK_PREPARE_TRANSFER
 *   - prepareClaim()                 ← SPARK_CLAIM_TRANSFER
 *   - prepareLightningReceive()      ← SPARK_PREPARE_LIGHTNING_RECEIVE
 *   - getDepositSigningKey()         ← create/reuse deterministic DEPOSIT account public key
 *
 * ## Why subtractSplitAndEncrypt is not implemented
 *
 * The Spark SDK's transfer flow calls subtractSplitAndEncrypt() per-leaf and
 * immediately uses the raw Feldman shares to build per-operator packages.
 * Turnkey's enclave does this entire operation atomically inside a single
 * SPARK_PREPARE_TRANSFER call — raw shares never leave the enclave boundary.
 * Use prepareTransfer() instead of the SDK's built-in transfer method.
 *
 * ## Deferred Commitment Pattern
 *
 * The Spark SDK generates user nonce commitments before signing (getRandomSigningCommitment),
 * but Turnkey's SPARK_SIGN_FROST generates the nonce and signs in one call. We bridge this
 * by returning a mutable placeholder from getRandomSigningCommitment, then mutating it with
 * Turnkey's real commitment values inside signFrost. The SDK holds the same object reference,
 * so it picks up the real values when building the transfer package.
 */

import { secp256k1 } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha2";
import { mnemonicToSeed } from "@scure/bip39";
import {
  getSparkFrost,
  type SparkSigner,
  type SignFrostParams,
  type AggregateFrostParams,
  type SigningCommitmentWithOptionalNonce,
  type SigningCommitment,
  type KeyDerivation,
  type SplitSecretWithProofsParams,
  type SubtractSplitAndEncryptParams,
  type SubtractSplitAndEncryptResult,
  type VerifiableSecretShare,
  type SigningNonce,
} from "@buildonspark/spark-sdk";
import {
  uint8ArrayToHexString,
  uint8ArrayFromHexString,
} from "@turnkey/encoding";
import type {
  Turnkey as TurnkeyServerSDK,
  v1SparkFrostCommitment,
  v1SparkKeyDerivation,
  v1SparkLeafPublicKey,
  v1SparkSignatureRequest,
} from "@turnkey/sdk-server";
import {
  SPARK_DEPOSIT_SUFFIX,
  SPARK_SIGNING_SUFFIX,
  SPARK_STATIC_DEPOSIT_SUFFIX,
} from "./constants";
import {
  TurnkeySparkSecretKeyManager,
  TurnkeySparkSigningKeyManager,
} from "./key-management";
import { areBytesEqual, compressedPublicKeyHexFromString } from "./utils";

/**
 * Validate the new-leaf pubkey envelope returned by PREPARE_/SPARK_CLAIM_TRANSFER:
 * one entry per input leaf, no duplicates, every returned leafId expected.
 *
 * The format/curve-point validation of each pubkey happens later in
 * `seedLeafSigningKeys` at the trust boundary. Anything that gets through both
 * checks but is still wrong (e.g., a valid curve point that isn't HD(leaf_id))
 * is bounded by FROST aggregation: operators' shares actually sum to HD(leaf_id),
 * so a lying signer's signature simply fails to verify on-chain — DOS rather
 * than loss-of-funds.
 *
 * Missing pubkeys altogether means the matching mono change isn't deployed;
 * refusing here surfaces the version skew immediately instead of silently
 * falling back to per-leaf pubkey-derivation round-trips.
 */
function requireNewLeafPubkeys(
  activity: string,
  pubkeys: Array<{ leafId: string; publicKey: string }> | undefined,
  expectedLeafIds: string[],
): void {
  const got = pubkeys?.length ?? 0;
  if (got !== expectedLeafIds.length) {
    throw new Error(
      `${activity} returned ${got} new-leaf pubkeys, expected ${expectedLeafIds.length}. ` +
        `This SDK requires the matching mono change that surfaces ` +
        `newLeafPublicKeys on PREPARE_/SPARK_CLAIM_TRANSFER results.`,
    );
  }
  const expected = new Set(expectedLeafIds);
  const seen = new Set<string>();
  for (const { leafId } of pubkeys!) {
    if (!expected.has(leafId)) {
      throw new Error(
        `${activity} returned newLeafPublicKey for unexpected leafId ${leafId}`,
      );
    }
    if (seen.has(leafId)) {
      throw new Error(
        `${activity} returned duplicate newLeafPublicKey for leafId ${leafId}`,
      );
    }
    seen.add(leafId);
  }
}

const BIP32_HARDENED_RESERVED = 0x80000000;

const signingHdLeafChild = (leafId: string): number => {
  const digest = sha256(Buffer.from(leafId, "utf8"));
  return (
    (((digest[0]! << 24) |
      (digest[1]! << 16) |
      (digest[2]! << 8) |
      digest[3]!) >>>
      0) %
    BIP32_HARDENED_RESERVED
  );
};

/**
 * Transfer leaf input for prepareTransfer(). Matches SparkTransferLeaf proto.
 */
export interface TransferLeafInput {
  leafId: string;
  oldLeafDerivation: KeyDerivation;
  newLeafDerivation: KeyDerivation;
  refundSignature?: string;
  directRefundSignature?: string;
  directFromCpfpRefundSignature?: string;
}

/**
 * Operator recipient for prepareTransfer(). Matches SparkOperatorRecipient proto.
 */
export interface OperatorRecipientInput {
  operatorId: string;
  encryptionPublicKey: string;
}

/**
 * Claim leaf input for prepareClaim(). Matches SparkClaimLeaf proto.
 */
export interface ClaimLeafInput {
  leafId: string;
  ciphertext: string;
  senderSignature: string;
}

/**
 * Result from prepareTransfer(). Contains encrypted operator packages and
 * the DER user signature — ready to forward to Spark operators.
 */
export interface TransferResult {
  operatorPackages: Array<{
    operatorId: string;
    encryptedPackage: string;
  }>;
  transferUserSignature: string;
  newLeafPublicKeys?: Array<{ leafId: string; publicKey: string }> | undefined;
}

/**
 * Result from prepareClaim().
 */
export interface ClaimResult {
  operatorPackages: Array<{
    operatorId: string;
    encryptedPackage: string;
  }>;
  newLeafPublicKeys?: Array<{ leafId: string; publicKey: string }> | undefined;
}

/**
 * Result from prepareLightningReceive().
 */
export interface LightningReceiveResult {
  paymentHash: string;
  operatorPackages: Array<{
    operatorId: string;
    encryptedPackage: string;
  }>;
}

export interface TurnkeySparkSignerOptions {
  walletId?: string | undefined;
  depositPublicKeyHex?: string | undefined;
  staticDepositPublicKeys?: Record<number, string> | undefined;
}

export class TurnkeySparkSigner implements SparkSigner {
  private readonly client: TurnkeyServerSDK;
  /** Spark-formatted address → signRawPayload returns BIP340 Schnorr */
  private readonly sparkAddress: string;
  /** Compressed address for ECDSA, or Spark address when only Schnorr identity signing is available */
  private readonly ecdsaAddress: string;
  /** Compressed 33-byte public key (02/03 prefix) */
  private readonly identityPublicKeyHex: string;

  private readonly secretKeyManager: TurnkeySparkSecretKeyManager;
  private readonly signingKeyManager: TurnkeySparkSigningKeyManager;

  constructor(
    client: TurnkeyServerSDK,
    sparkAddress: string,
    ecdsaAddress: string,
    identityPublicKeyHex: string,
    options: TurnkeySparkSignerOptions = {},
  ) {
    this.client = client;
    this.sparkAddress = sparkAddress;
    this.ecdsaAddress = ecdsaAddress;
    this.identityPublicKeyHex = identityPublicKeyHex;

    this.signingKeyManager = new TurnkeySparkSigningKeyManager(
      client.apiClient(),
      sparkAddress,
      options.walletId,
    );

    this.secretKeyManager = new TurnkeySparkSecretKeyManager();

    if (options.depositPublicKeyHex) {
      this.setDepositSigningKey(
        uint8ArrayFromHexString(options.depositPublicKeyHex),
      );
    }

    for (const [index, publicKeyHex] of Object.entries(
      options.staticDepositPublicKeys ?? {},
    )) {
      this.setStaticDepositSigningKey(
        Number(index),
        uint8ArrayFromHexString(publicKeyHex),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Identity key operations (already working)
  // ---------------------------------------------------------------------------

  getIdentityPublicKey(): Promise<Uint8Array> {
    return Promise.resolve(uint8ArrayFromHexString(this.identityPublicKeyHex));
  }

  async signMessageWithIdentityKey(
    message: Uint8Array,
    compact?: boolean,
  ): Promise<Uint8Array> {
    const { r, s } = await this.client.apiClient().signRawPayload({
      signWith: this.ecdsaAddress,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NO_OP",
      payload: uint8ArrayToHexString(message),
    });

    const rBuf = Buffer.from(r.padStart(64, "0"), "hex");
    const sBuf = Buffer.from(s.padStart(64, "0"), "hex");

    // Spark accepts either DER ECDSA or 64-byte Schnorr identity signatures.
    // Use compact bytes only for explicit compact requests or when signWith is
    // Spark-formatted. ECDSA signatures may also return v=00, so v is not a
    // reliable discriminator here.
    if (compact || this.ecdsaAddress.startsWith("spark")) {
      return Buffer.concat([rBuf, sBuf]);
    }

    const sig = new secp256k1.Signature(
      BigInt("0x" + rBuf.toString("hex")),
      BigInt("0x" + sBuf.toString("hex")),
    );
    return Buffer.from(sig.toBytes("der"));
  }

  async signSchnorrWithIdentityKey(message: Uint8Array): Promise<Uint8Array> {
    const { r, s, v } = await this.client.apiClient().signRawPayload({
      signWith: this.sparkAddress,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NO_OP",
      payload: uint8ArrayToHexString(message),
    });

    if (v !== "00") {
      throw new Error(
        `Expected BIP340 Schnorr (v=00) from Spark address, got v=${v}`,
      );
    }

    const rBuf = Buffer.from(r.padStart(64, "0"), "hex");
    const sBuf = Buffer.from(s.padStart(64, "0"), "hex");
    return Buffer.concat([rBuf, sBuf]);
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
    return this.identityPublicKeyHex;
  }

  // ---------------------------------------------------------------------------
  // FROST signing — bridges to SPARK_SIGN_FROST
  // ---------------------------------------------------------------------------

  /**
   * Returns a mutable placeholder commitment. The real commitment values are
   * populated by signFrost() when Turnkey's SPARK_SIGN_FROST returns.
   *
   * The SDK holds a reference to this object and reads commitment.hiding/binding
   * AFTER signFrost() completes, so the mutation propagates correctly.
   */
  async getRandomSigningCommitment(): Promise<SigningCommitmentWithOptionalNonce> {
    const placeholder: SigningCommitmentWithOptionalNonce = {
      commitment: {
        hiding: new Uint8Array(33),
        binding: new Uint8Array(33),
      },
    };
    return placeholder;
  }

  /**
   * Nonce is not available client-side — Turnkey generates it internally.
   * Returns undefined, which the SDK handles gracefully (the nonce is only
   * needed by the local signer implementation, not by the coordinator).
   */
  getNonceForSelfCommitment(
    _selfCommitment: SigningCommitmentWithOptionalNonce,
  ): SigningNonce | undefined {
    return undefined;
  }

  /**
   * Calls Turnkey's SPARK_SIGN_FROST activity. Generates a fresh nonce inside
   * the enclave, signs, and returns the partial signature. Mutates
   * params.selfCommitment with the real (hiding, binding) values from Turnkey.
   */
  async signFrost(params: SignFrostParams): Promise<Uint8Array> {
    const [signature] = await this.signFrostBatch([params]);
    return signature!;
  }

  /**
   * Batched FROST signing: one SPARK_SIGN_FROST activity for many signature
   * requests. Mutates each params[i].selfCommitment.commitment with the real
   * (hiding, binding) values returned by Turnkey, matching signFrost behavior.
   *
   * Used by signRefundsBatched (turnkeyInternal.ts) to collapse the SDK's
   * per-leaf-per-direction signing loop into a single Turnkey round-trip.
   */
  async signFrostBatch(params: SignFrostParams[]): Promise<Uint8Array[]> {
    if (params.length === 0) return [];

    params.forEach(({ adaptorPubKey }, i) => {
      if (
        adaptorPubKey !== undefined &&
        adaptorPubKey.length !== 0 &&
        adaptorPubKey.length !== 33
      ) {
        throw new Error(
          `signFrostBatch[${i}]: adaptorPubKey must be omitted, empty, or ` +
            `a 33-byte compressed secp256k1 point (got length=${adaptorPubKey.length})`,
        );
      }
    });

    const signatureRequests = params.map(signFrostParamsToSignatureRequest);

    const result = await this.client.apiClient().sparkSignFrost({
      signWith: this.sparkAddress,
      signatures: signatureRequests,
    });

    if (result.signatures.length !== params.length) {
      throw new Error(
        `SPARK_SIGN_FROST returned ${result.signatures.length} signatures; expected ${params.length}`,
      );
    }

    return result.signatures.map((sig, i) => {
      const commitment = params[i]!.selfCommitment.commitment;
      commitment.hiding = uint8ArrayFromHexString(sig.hiding);
      commitment.binding = uint8ArrayFromHexString(sig.binding);
      return uint8ArrayFromHexString(sig.signatureShare);
    });
  }

  async aggregateFrost(params: AggregateFrostParams): Promise<Uint8Array> {
    const sparkFrost = getSparkFrost();
    return sparkFrost.aggregateFrost({
      message: params.message,
      statechainSignatures: params.statechainSignatures,
      statechainPublicKeys: params.statechainPublicKeys,
      verifyingKey: params.verifyingKey,
      statechainCommitments: params.statechainCommitments,
      selfCommitment: params.selfCommitment.commitment,
      selfPublicKey: params.publicKey,
      selfSignature: params.selfSignature,
      adaptorPubKey: params.adaptorPubKey,
    });
  }

  // ---------------------------------------------------------------------------
  // Transfer / Claim — Turnkey-specific methods
  //
  // The SDK's built-in transfer() calls subtractSplitAndEncrypt() per-leaf
  // and immediately uses raw Feldman shares to build per-operator packages.
  // Turnkey's enclave does this atomically — shares never leave the enclave.
  // Use these methods instead of the SDK's built-in transfer/claim flow.
  // ---------------------------------------------------------------------------

  /**
   * Prepare a transfer: build encrypted operator packages and the DER user
   * signature for an outbound BTC transfer via SPARK_PREPARE_TRANSFER.
   *
   * FROST signing happens separately — the SDK's signing flow already
   * produces refund signatures via signFrost() per leaf before this is called.
   */
  async prepareTransfer(params: {
    transferId: string;
    leaves: TransferLeafInput[];
    threshold: number;
    operatorRecipients: OperatorRecipientInput[];
    receiverPublicKey: string;
  }): Promise<TransferResult> {
    const leaves = params.leaves.map((l) => ({
      leafId: l.leafId,
      oldLeafDerivation: keyDerivationToSparkKeyDerivation(l.oldLeafDerivation),
      newLeafDerivation: keyDerivationToSparkKeyDerivation(l.newLeafDerivation),
      refundSignature: l.refundSignature ?? "",
      directRefundSignature: l.directRefundSignature ?? "",
      directFromCpfpRefundSignature: l.directFromCpfpRefundSignature ?? "",
    }));

    const result = await this.client.apiClient().sparkPrepareTransfer({
      signWith: this.sparkAddress,
      transfer: {
        transferId: params.transferId,
        leaves,
        threshold: params.threshold,
        operatorRecipients: params.operatorRecipients,
        receiverPublicKey: params.receiverPublicKey,
      },
    });

    requireNewLeafPubkeys(
      "SPARK_PREPARE_TRANSFER",
      result.newLeafPublicKeys,
      params.leaves.map((l) => {
        if (l.newLeafDerivation.type !== "leaf") {
          throw new Error(
            `prepareTransfer requires newLeafDerivation.type === "leaf", got ${l.newLeafDerivation.type}`,
          );
        }
        return l.newLeafDerivation.path;
      }),
    );
    this.seedLeafSigningKeys(result.newLeafPublicKeys);

    return {
      operatorPackages: result.operatorPackages ?? [],
      transferUserSignature: result.transferUserSignature ?? "",
      newLeafPublicKeys: result.newLeafPublicKeys,
    };
  }

  /**
   * Prepare a claim: build encrypted operator packages for inbound leaves
   * via SPARK_CLAIM_TRANSFER. The claim just rotates leaf keys — no FROST.
   */
  async prepareClaim(params: {
    leaves: ClaimLeafInput[];
    threshold: number;
    operatorRecipients: OperatorRecipientInput[];
    transferId: string;
    senderIdentityPublicKey: string;
  }): Promise<ClaimResult> {
    const result = await this.client.apiClient().sparkClaimTransfer({
      signWith: this.sparkAddress,
      claim: {
        leaves: params.leaves,
        threshold: params.threshold,
        transferId: params.transferId,
        operatorRecipients: params.operatorRecipients,
        senderIdentityPublicKey: params.senderIdentityPublicKey,
      },
    });

    requireNewLeafPubkeys(
      "SPARK_CLAIM_TRANSFER",
      result.newLeafPublicKeys,
      params.leaves.map((l) => l.leafId),
    );
    this.seedLeafSigningKeys(result.newLeafPublicKeys);

    return {
      operatorPackages: result.operatorPackages ?? [],
      newLeafPublicKeys: result.newLeafPublicKeys,
    };
  }

  /**
   * Prepare a Lightning receive via SPARK_PREPARE_LIGHTNING_RECEIVE: generate
   * a preimage inside Turnkey, split it into encrypted operator packages, and
   * return only the payment hash plus encrypted packages. The raw
   * preimage/shares never enter client JS.
   */
  async prepareLightningReceive(params: {
    threshold: number;
    operatorRecipients: OperatorRecipientInput[];
  }): Promise<LightningReceiveResult> {
    if (params.threshold < 2) {
      throw new Error("Lightning receive threshold must be at least 2");
    }

    const result = await this.client.apiClient().sparkPrepareLightningReceive({
      signWith: this.sparkAddress,
      lightningReceive: {
        threshold: params.threshold,
        operatorRecipients: params.operatorRecipients,
      },
    });

    if (!result.paymentHash) {
      throw new Error(
        "SPARK_PREPARE_LIGHTNING_RECEIVE returned no payment hash",
      );
    }

    return {
      paymentHash: result.paymentHash,
      operatorPackages: result.operatorPackages ?? [],
    };
  }

  // ---------------------------------------------------------------------------
  // Public-key access without key-operation activities
  // ---------------------------------------------------------------------------

  /**
   * The Spark SDK's transfer flow calls this per-leaf and immediately uses
   * raw Feldman shares. Turnkey's enclave produces fully-encrypted operator
   * packages atomically — raw shares never leave the enclave boundary.
   *
   * Use prepareTransfer() instead of the SDK's built-in transfer method.
   */
  async subtractSplitAndEncrypt(
    _params: SubtractSplitAndEncryptParams,
  ): Promise<SubtractSplitAndEncryptResult> {
    throw new Error(
      "TurnkeySparkSigner does not support subtractSplitAndEncrypt. " +
        "Turnkey's enclave performs subtract-split-encrypt atomically inside " +
        "SPARK_PREPARE_TRANSFER — raw shares never leave the enclave. " +
        "Use TurnkeySparkSigner.prepareTransfer() instead of the SDK's " +
        "built-in transfer method.",
    );
  }

  async getPublicKeyFromDerivation(
    keyDerivation?: KeyDerivation,
  ): Promise<Uint8Array> {
    if (!keyDerivation) {
      return this.getIdentityPublicKey();
    }

    switch (keyDerivation.type) {
      case "deposit":
        return this.getDepositSigningKey();
      case "static_deposit":
        return this.getStaticDepositSigningKey(Number(keyDerivation.path));
      case "leaf":
        return this.getLeafSigningKey(String(keyDerivation.path));
      default:
        throw new Error(
          `Unsupported key derivation type: ${keyDerivation.type}`,
        );
    }
  }

  async getPublicKeysFromDerivations(
    keyDerivations: KeyDerivation[],
  ): Promise<Uint8Array[]> {
    return Promise.all(
      keyDerivations.map((keyDerivation) =>
        this.getPublicKeyFromDerivation(keyDerivation),
      ),
    );
  }

  async getLeafSigningKey(leafId: string): Promise<Uint8Array> {
    const child = signingHdLeafChild(leafId);
    const path = `${SPARK_SIGNING_SUFFIX}/${child}'`;

    const key = await this.signingKeyManager.get(path);
    if (key == null) {
      throw new Error(`No signing key found for leafId ${leafId}.`);
    }

    return key;
  }

  setLeafSigningKey(leafId: string, key: Uint8Array) {
    const child = signingHdLeafChild(leafId);
    const path = `${SPARK_SIGNING_SUFFIX}/${child}'`;

    this.signingKeyManager.set(path, key);
  }

  /**
   * Seed leafSigningKeys from new-leaf pubkeys returned by
   * SPARK_PREPARE_TRANSFER / SPARK_CLAIM_TRANSFER. Subsequent
   * getLeafSigningKey lookups for these leaves hit cache instead of
   * round-tripping to Turnkey.
   *
   * Validation at the trust boundary: each pubkey must be hex-formatted, decode
   * to a valid secp256k1 point, and be distinct across the batch (each
   * HD-derived leaf signing key is unique by construction). A malformed or
   * duplicate entry would silently corrupt every later FROST signature that
   * uses it, so we fail loud here.
   */
  private seedLeafSigningKeys(
    entries: v1SparkLeafPublicKey[] | undefined,
  ): void {
    if (!entries) return;

    const seenPubkeys = new Set<string>();
    for (const { leafId, publicKey } of entries) {
      if (!compressedPublicKeyHexFromString(publicKey)) {
        throw new Error(
          `signer returned malformed pubkey for leaf ${leafId}: ` +
            `expected 66 hex chars (33-byte compressed secp256k1), got ${publicKey.length}`,
        );
      }

      try {
        secp256k1.Point.fromHex(publicKey);
      } catch {
        throw new Error(
          `signer returned non-secp256k1 pubkey for leaf ${leafId}`,
        );
      }

      const normalized = publicKey.toLowerCase();
      if (seenPubkeys.has(normalized)) {
        throw new Error(
          `signer returned duplicate pubkey across leaves in one response; ` +
            `each HD-derived leaf signing key must be unique`,
        );
      }
      seenPubkeys.add(normalized);

      this.setLeafSigningKey(leafId, uint8ArrayFromHexString(publicKey));
    }
  }

  async getDepositSigningKey(): Promise<Uint8Array> {
    const path = SPARK_DEPOSIT_SUFFIX;
    const key = await this.signingKeyManager.get(path);
    if (key == null) {
      throw new Error(
        `No deposit signing key found at suffix ${SPARK_DEPOSIT_SUFFIX}.`,
      );
    }

    return key;
  }

  private setDepositSigningKey(key: Uint8Array): void {
    const path = SPARK_DEPOSIT_SUFFIX;
    this.signingKeyManager.set(path, key);
  }

  async getStaticDepositSigningKey(idx: number): Promise<Uint8Array> {
    if (!Number.isInteger(idx) || idx < 0) {
      throw new Error(`Invalid static deposit index: ${idx}`);
    }

    const path = `${SPARK_STATIC_DEPOSIT_SUFFIX}/${idx}'`;
    const key = await this.signingKeyManager.get(path);
    if (key == null) {
      throw new Error(
        `No static deposit signing key found for index ${idx} at ${path}.`,
      );
    }

    return key;
  }

  private setStaticDepositSigningKey(idx: number, key: Uint8Array): void {
    const path = `${SPARK_STATIC_DEPOSIT_SUFFIX}/${idx}'`;
    this.signingKeyManager.set(path, key);
  }

  /**
   * Cache an exported static-deposit private key in process memory.
   *
   * **Trust boundary deviation.** This is the only `TurnkeySparkSigner`
   * method that puts a private key in client-side JS memory. Every other
   * Spark key stays inside Turnkey's enclave; static-deposit is the
   * exception because the Spark SDK's claim path requires the raw secret
   * client-side and there is no enclave-only alternative today.
   *
   * The secret must come from `exportWalletAccount` against the Turnkey
   * static-deposit account at `idx`. This method validates the secret
   * derives the expected secp256k1 pubkey before caching; mismatched
   * keys throw without storing.
   *
   * **Hygiene — read this.** Once cached, the secret is plaintext on
   * the JS heap and exposed to memory disclosure (process dumps,
   * debugger attach, swap-to-disk, log accidents, RCE). To minimize
   * exposure:
   *   - Prefer the `installStaticDepositSecretKey` helper, which
   *     exports + caches + zeros the local copy in one call.
   *   - Wrap the claim call in a `try`/`finally` and call
   *     `clearStaticDepositSecretKey(idx)` in `finally` so the cache
   *     is zeroed even on error.
   *   - Don't run static-deposit claims from long-lived daemons.
   *     Use a short-lived process, ideally one that doesn't service
   *     other untrusted requests during the claim window.
   *   - Don't log this value or anything derived from it.
   */
  async setStaticDepositSecretKey(
    idx: number,
    secretKey: Uint8Array,
  ): Promise<void> {
    if (secretKey.length !== 32) {
      throw new Error(
        `Static deposit secret key must be 32 bytes, got ${secretKey.length}`,
      );
    }

    const expectedPublicKey = await this.getStaticDepositSigningKey(idx);
    const actualPublicKey = secp256k1.getPublicKey(secretKey);
    if (!areBytesEqual(actualPublicKey, expectedPublicKey)) {
      throw new Error(
        `Exported static deposit key at index ${idx} does not match Spark-derived public key`,
      );
    }

    this.secretKeyManager.set(idx, new Uint8Array(secretKey));
  }

  /**
   * Returns the cached static-deposit secret for `idx`. Throws if no
   * secret was pre-loaded via `setStaticDepositSecretKey`.
   *
   * Called by the Spark SDK's static-deposit claim path. There is no
   * enclave-only fallback — the SDK's claim flow needs the raw secret
   * client-side, so if you haven't exported and cached it the claim
   * cannot proceed. See `setStaticDepositSecretKey` for the trust-
   * boundary caveats and lifecycle hygiene.
   */
  async getStaticDepositSecretKey(idx: number): Promise<Uint8Array> {
    const secretKey = await this.secretKeyManager.get(idx);
    if (secretKey) {
      return new Uint8Array(secretKey);
    }
    throw new Error(
      `TurnkeySparkSigner.getStaticDepositSecretKey(${idx}): no secret cached. ` +
        "The Spark SDK's static-deposit claim path needs the raw private " +
        "key client-side; call installStaticDepositSecretKey (export from " +
        "Turnkey + cache) before invoking the claim, and " +
        "clearStaticDepositSecretKey afterward. There is no enclave-only " +
        "static-deposit-claim path today — see " +
        "src/spark-deposit/static.ts for the recommended pattern.",
    );
  }

  // ---------------------------------------------------------------------------
  // Not needed for Turnkey-backed wallets
  //
  // Each method below explains why it's unsupported and where the equivalent
  // Turnkey-driven flow lives (if any). Errors here surface only when SDK
  // code paths we don't normally exercise call into them — file an issue if
  // you hit one in a flow that should work.
  // ---------------------------------------------------------------------------

  async generateMnemonic(): Promise<string> {
    throw new Error(
      "TurnkeySparkSigner.generateMnemonic is not supported. Wallets are " +
        "created via Turnkey's CREATE_WALLET activity (see setup.ts), not " +
        "from a client-generated mnemonic. The wallet seed lives inside " +
        "Turnkey's enclave and never leaves.",
    );
  }

  async subtractPrivateKeysGivenDerivationPaths(
    _first: string,
    _second: string,
  ): Promise<Uint8Array> {
    throw new Error(
      "TurnkeySparkSigner.subtractPrivateKeysGivenDerivationPaths is not " +
        "supported. This primitive is only used by the SDK's built-in " +
        "transfer/claim flows; the Turnkey integration replaces those with " +
        "SPARK_PREPARE_TRANSFER / SPARK_CLAIM_TRANSFER which compute the " +
        "tweak scalar atomically inside the enclave. Use " +
        "TurnkeySparkSigner.prepareTransfer or prepareClaim instead.",
    );
  }

  async subtractAndSplitSecretWithProofsGivenDerivations(
    _params: Omit<SplitSecretWithProofsParams, "secret"> & {
      first: KeyDerivation;
      second?: KeyDerivation | undefined;
    },
  ): Promise<VerifiableSecretShare[]> {
    throw new Error(
      "TurnkeySparkSigner.subtractAndSplitSecretWithProofsGivenDerivations " +
        "is not supported. The SDK's built-in transfer/claim flows call " +
        "this; the Turnkey integration replaces them with " +
        "SPARK_PREPARE_TRANSFER / SPARK_CLAIM_TRANSFER which subtract + " +
        "Feldman-split atomically inside the enclave (raw shares never " +
        "leave). Use TurnkeySparkSigner.prepareTransfer or prepareClaim.",
    );
  }

  async splitSecretWithProofs(): Promise<VerifiableSecretShare[]> {
    throw new Error(
      "TurnkeySparkSigner.splitSecretWithProofs is not supported. The SDK's " +
        "built-in Lightning-receive path calls this with a client-generated " +
        "preimage; the Turnkey integration replaces it with " +
        "SPARK_PREPARE_LIGHTNING_RECEIVE which generates the preimage and " +
        "Feldman-splits it inside the enclave (the preimage never enters " +
        "client JS). Use TurnkeySparkSigner.prepareLightningReceive.",
    );
  }

  signTransactionIndex(): void {
    throw new Error(
      "TurnkeySparkSigner.signTransactionIndex is not supported. The Turnkey " +
        "integration uses signFrostBatch for FROST signing and signRawPayload " +
        "for identity signatures; no Turnkey-driven flow needs raw " +
        "transaction-index ECDSA signing with a client-held private key.",
    );
  }

  async htlcHMAC(): Promise<Uint8Array> {
    throw new Error(
      "TurnkeySparkSigner.htlcHMAC is not supported. Turnkey-driven Lightning " +
        "flows route through src/internal/turnkeyLightning.ts " +
        "(SPARK_PREPARE_LIGHTNING_RECEIVE for receives, the swap-based send " +
        "path) and do not require client-side preimage derivation. " +
        "If you need raw HTLC primitives (atomic swaps, manual LSP " +
        "integration), pass an explicit `preimage` to wallet.createHTLC(...) " +
        "— the Spark SDK skips htlcHMAC when preimage is provided. For " +
        "deterministic wallet-seed-derived preimages, a SPARK_HTLC_HMAC " +
        "Turnkey activity would be needed (not built today; file an issue " +
        "if you have a use case).",
    );
  }

  async decryptEcies(): Promise<Uint8Array> {
    throw new Error(
      "TurnkeySparkSigner.decryptEcies is not supported. The SDK's built-in " +
        "claim flow calls this to decrypt the inbound ciphertext using the " +
        "wallet identity key client-side; the Turnkey integration replaces " +
        "the entire claim flow with SPARK_CLAIM_TRANSFER which performs " +
        "ECIES decryption inside the enclave (identity key never leaves). " +
        "Use TurnkeySparkSigner.prepareClaim — see src/internal/turnkeyClaim.ts.",
    );
  }
}

const signFrostParamsToSignatureRequest = (
  params: SignFrostParams,
): v1SparkSignatureRequest => ({
  derivation: keyDerivationToSparkKeyDerivation(params.keyDerivation),
  message: uint8ArrayToHexString(params.message),
  verifyingKey: uint8ArrayToHexString(params.verifyingKey),
  operatorCommitments: Object.entries(
    params.statechainCommitments ?? {},
  ).flatMap(([id, commitment]) =>
    commitment
      ? [statechainCommitmentToSparkFrostCommitment(id, commitment)]
      : [],
  ),
  adaptorPublicKey: adaptorPubKeyToSparkAdaptorPublicKey(params.adaptorPubKey),
});

const adaptorPubKeyToSparkAdaptorPublicKey = (
  adaptorPubKey: Uint8Array | undefined,
): string => {
  if (adaptorPubKey === undefined || adaptorPubKey.length === 0) return "";

  // adaptorPubKey may be omitted (undefined) or empty (`new Uint8Array()`,
  // how the Spark SDK signals non-adaptor signs) — both forward as plain
  // FROST. Any other length is a caller bug: SPARK_SIGN_FROST would
  // either reject (non-33-byte → enclave InvalidArgument) or, for a 33-
  // byte non-curve-point, fail downstream aggregation. Reject at the SDK
  // boundary so the error points at the call site, not the enclave.
  if (adaptorPubKey.length !== 33) {
    throw new Error(
      `adaptorPubKey must be omitted, empty, or ` +
        `a 33-byte compressed secp256k1 point (got ${uint8ArrayToHexString(adaptorPubKey)})`,
    );
  }

  return uint8ArrayToHexString(adaptorPubKey);
};

/**
 * Maps an SDK KeyDerivation to the proto SparkKeyDerivation oneof shape with
 * the signingLeaf variant selected.
 *
 * The three call sites — SPARK_SIGN_FROST signature requests and
 * SPARK_PREPARE_TRANSFER's {old,new}_leaf_derivation — accept the polymorphic
 * SparkKeyDerivation, but the SDK only drives the signingLeaf variant; other
 * derivation types are rejected here.
 */
const keyDerivationToSparkKeyDerivation = (
  kd: KeyDerivation,
): v1SparkKeyDerivation => {
  if (kd.type !== "leaf") {
    throw new Error(
      `Expected leaf KeyDerivation for SparkKeyDerivation signingLeaf, got ${kd.type}`,
    );
  }

  return { signingLeaf: { leafId: String(kd.path) } };
};

/** Maps operator commitment to proto shape. */
const statechainCommitmentToSparkFrostCommitment = (
  id: string,
  commitment: SigningCommitment,
): v1SparkFrostCommitment => {
  return {
    id,
    hiding: uint8ArrayToHexString(commitment.hiding),
    binding: uint8ArrayToHexString(commitment.binding),
  };
};
