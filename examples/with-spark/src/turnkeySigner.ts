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
 * FROST signing (via SPARK_PREPARE_AND_SIGN activity):
 *   - getRandomSigningCommitment()   ← returns mutable placeholder
 *   - signFrost()                    ← calls Turnkey, mutates commitment
 *   - aggregateFrost()               ← client-side signature aggregation
 *
 * Transfer / claim / lightning (via SPARK_PREPARE_AND_SIGN with package_request):
 *   - prepareTransfer()              ← custom method (not part of SparkSigner)
 *   - prepareClaim()                 ← custom method (not part of SparkSigner)
 *   - prepareLightningReceive()      ← custom method (not part of SparkSigner)
 *
 * Key operations (via SPARK_KEY_OPERATION activity):
 *   - getPublicKeyFromDerivation()   ← derive public key at any SparkKeyType path
 *   - getDepositSigningKey()         ← derive DEPOSIT public key
 *
 * ## Why subtractSplitAndEncrypt is not implemented
 *
 * The Spark SDK's transfer flow calls subtractSplitAndEncrypt() per-leaf and
 * immediately uses the raw Feldman shares to build per-operator packages.
 * Turnkey's enclave does this entire operation atomically inside a single
 * SPARK_PREPARE_AND_SIGN call — raw shares never leave the enclave boundary.
 * Use prepareTransfer() instead of the SDK's built-in transfer method.
 *
 * ## Deferred Commitment Pattern
 *
 * The Spark SDK generates user nonce commitments before signing (getRandomSigningCommitment),
 * but Turnkey's PREPARE_AND_SIGN generates the nonce and signs in one call. We bridge this
 * by returning a mutable placeholder from getRandomSigningCommitment, then mutating it with
 * Turnkey's real commitment values inside signFrost. The SDK holds the same object reference,
 * so it picks up the real values when building the transfer package.
 */

import { secp256k1 } from "@noble/curves/secp256k1";
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
import type { Transaction } from "@scure/btc-signer";
import type { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function fromHex(h: string): Uint8Array {
  return Buffer.from(h.replace(/^0x/, ""), "hex");
}

function notImplemented(method: string): never {
  throw new Error(
    `TurnkeySparkSigner.${method} is not yet implemented. ` +
      `This method requires functionality not yet available via Turnkey activities.`,
  );
}

function cloneBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}

/** Maps SDK KeyDerivation to the proto SparkKeyDerivation shape. */
function mapKeyDerivation(kd: KeyDerivation): Record<string, unknown> {
  switch (kd.type) {
    case "leaf":
      return { type: "SPARK_KEY_TYPE_SIGNING_HD", leafId: kd.path };
    case "deposit":
      return { type: "SPARK_KEY_TYPE_DEPOSIT" };
    case "static_deposit":
      return { type: "SPARK_KEY_TYPE_STATIC_DEPOSIT_HD", index: kd.path };
    default:
      throw new Error(`Unsupported key derivation type: ${kd.type}`);
  }
}

function keyDerivationCacheKey(kd: KeyDerivation): string {
  switch (kd.type) {
    case "leaf":
      return `leaf:${kd.path}`;
    case "deposit":
      return "deposit";
    case "static_deposit":
      return `static_deposit:${kd.path}`;
    default:
      throw new Error(`Unsupported key derivation type: ${kd.type}`);
  }
}

/** Maps operator commitment map to proto shape. */
function mapOperatorCommitments(
  commitments: { [key: string]: SigningCommitment } | undefined,
): Array<{ id: string; hiding: string; binding: string }> {
  if (!commitments) return [];
  return Object.entries(commitments).map(([id, c]) => ({
    id,
    hiding: hex(c.hiding),
    binding: hex(c.binding),
  }));
}

/**
 * Result shape from Turnkey's SPARK_PREPARE_AND_SIGN activity.
 * This mirrors SparkPrepareAndSignResult from activity.proto.
 */
interface PrepareAndSignResult {
  signatures: Array<{
    signatureShare: string;
    hiding: string;
    binding: string;
  }>;
  operatorPackages?: Array<{
    operatorId: string;
    encryptedPackage: string;
  }>;
  paymentHash?: string;
  transferUserSignature?: string;
}

/**
 * Result shape from Turnkey's SPARK_KEY_OPERATION activity.
 * This mirrors SparkKeyOperationResult from activity.proto.
 */
interface KeyOperationResult {
  publicKeys?: Array<{ publicKey: string }>;
}

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
  signatures: Array<{
    signatureShare: Uint8Array;
    hiding: Uint8Array;
    binding: Uint8Array;
  }>;
  operatorPackages: Array<{
    operatorId: string;
    encryptedPackage: string;
  }>;
  transferUserSignature: string;
}

/**
 * Result from prepareClaim().
 */
export interface ClaimResult {
  operatorPackages: Array<{
    operatorId: string;
    encryptedPackage: string;
  }>;
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

export class TurnkeySparkSigner implements SparkSigner {
  private readonly client: TurnkeyServerSDK;
  /** Spark-formatted address → signRawPayload returns BIP340 Schnorr */
  private readonly sparkAddress: string;
  /** Compressed address for ECDSA, or Spark address when only Schnorr identity signing is available */
  private readonly ecdsaAddress: string;
  /** Compressed 33-byte public key (02/03 prefix) */
  private readonly identityPublicKeyHex: string;
  /** Coalesces and caches deterministic SPARK_KEY_OPERATION public-key derivations. */
  private readonly publicKeyCache = new Map<string, Promise<Uint8Array>>();
  /** Optional exported static-deposit keys for SDK compatibility flows. */
  private readonly staticDepositSecretKeys = new Map<number, Uint8Array>();

  constructor(
    client: TurnkeyServerSDK,
    sparkAddress: string,
    ecdsaAddress: string,
    identityPublicKeyHex: string,
  ) {
    this.client = client;
    this.sparkAddress = sparkAddress;
    this.ecdsaAddress = ecdsaAddress;
    this.identityPublicKeyHex = identityPublicKeyHex;
  }

  // ---------------------------------------------------------------------------
  // Identity key operations (already working)
  // ---------------------------------------------------------------------------

  getIdentityPublicKey(): Promise<Uint8Array> {
    return Promise.resolve(Buffer.from(this.identityPublicKeyHex, "hex"));
  }

  async signMessageWithIdentityKey(
    message: Uint8Array,
    compact?: boolean,
  ): Promise<Uint8Array> {
    const { r, s } = await this.client.apiClient().signRawPayload({
      signWith: this.ecdsaAddress,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NO_OP",
      payload: hex(message),
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
    return Buffer.from(sig.toDERRawBytes());
  }

  async signSchnorrWithIdentityKey(message: Uint8Array): Promise<Uint8Array> {
    const { r, s, v } = await this.client.apiClient().signRawPayload({
      signWith: this.sparkAddress,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NO_OP",
      payload: hex(message),
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
  // FROST signing — bridges to SPARK_PREPARE_AND_SIGN
  // ---------------------------------------------------------------------------

  /**
   * Returns a mutable placeholder commitment. The real commitment values are
   * populated by signFrost() when Turnkey's PREPARE_AND_SIGN returns.
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
   * Calls Turnkey's SPARK_PREPARE_AND_SIGN activity for FROST signing only
   * (no package_request). Generates nonce, signs, and returns the partial
   * signature. Mutates params.selfCommitment with the real (hiding, binding)
   * values from Turnkey.
   */
  async signFrost(params: SignFrostParams): Promise<Uint8Array> {
    const signatureRequest = {
      derivation: mapKeyDerivation(params.keyDerivation),
      message: hex(params.message),
      verifyingKey: hex(params.verifyingKey),
      operatorCommitments: mapOperatorCommitments(
        params.statechainCommitments,
      ),
      ...(params.adaptorPubKey
        ? { adaptorPublicKey: hex(params.adaptorPubKey) }
        : {}),
    };

    const intent: Record<string, unknown> = {
      signWith: this.sparkAddress,
      signatures: [signatureRequest],
    };

    const result = await this.callPrepareAndSign(intent);

    const sig = result.signatures[0]!;
    const commitment = params.selfCommitment.commitment;
    commitment.hiding = fromHex(sig.hiding);
    commitment.binding = fromHex(sig.binding);

    return fromHex(sig.signatureShare);
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
   * Prepare a transfer: FROST-sign each leaf + build encrypted operator
   * packages in a single SPARK_PREPARE_AND_SIGN call.
   *
   * Returns encrypted operator packages and the DER user signature, ready
   * to forward to Spark operators.
   */
  async prepareTransfer(params: {
    signatures: Array<{
      keyDerivation: KeyDerivation;
      message: Uint8Array;
      verifyingKey: Uint8Array;
      operatorCommitments?: { [key: string]: SigningCommitment };
      selfCommitment: SigningCommitmentWithOptionalNonce;
      adaptorPubKey?: Uint8Array;
    }>;
    transferId: string;
    leaves: TransferLeafInput[];
    threshold: number;
    operatorRecipients: OperatorRecipientInput[];
    receiverPublicKey: string;
  }): Promise<TransferResult> {
    const signatureRequests = params.signatures.map((s) => ({
      derivation: mapKeyDerivation(s.keyDerivation),
      message: hex(s.message),
      verifyingKey: hex(s.verifyingKey),
      operatorCommitments: mapOperatorCommitments(s.operatorCommitments),
      ...(s.adaptorPubKey ? { adaptorPublicKey: hex(s.adaptorPubKey) } : {}),
    }));

    const leaves = params.leaves.map((l) => ({
      leafId: l.leafId,
      oldLeafDerivation: mapKeyDerivation(l.oldLeafDerivation),
      newLeafDerivation: mapKeyDerivation(l.newLeafDerivation),
      ...(l.refundSignature ? { refundSignature: l.refundSignature } : {}),
      ...(l.directRefundSignature
        ? { directRefundSignature: l.directRefundSignature }
        : {}),
      ...(l.directFromCpfpRefundSignature
        ? {
            directFromCpfpRefundSignature: l.directFromCpfpRefundSignature,
          }
        : {}),
    }));

    const intent: Record<string, unknown> = {
      signWith: this.sparkAddress,
      signatures: signatureRequests,
      packageRequest: {
        transfer: {
          transferId: params.transferId,
          leaves,
          threshold: params.threshold,
          operatorRecipients: params.operatorRecipients,
          receiverPublicKey: params.receiverPublicKey,
        },
      },
    };

    const result = await this.callPrepareAndSign(intent);

    for (let i = 0; i < params.signatures.length; i++) {
      const sig = result.signatures[i]!;
      const commitment = params.signatures[i]!.selfCommitment.commitment;
      commitment.hiding = fromHex(sig.hiding);
      commitment.binding = fromHex(sig.binding);
    }

    return {
      signatures: result.signatures.map((s) => ({
        signatureShare: fromHex(s.signatureShare),
        hiding: fromHex(s.hiding),
        binding: fromHex(s.binding),
      })),
      operatorPackages: result.operatorPackages ?? [],
      transferUserSignature: result.transferUserSignature ?? "",
    };
  }

  /**
   * Prepare a claim: build encrypted operator packages for inbound leaves.
   * No FROST signatures needed — the claim just rotates leaf keys.
   */
  async prepareClaim(params: {
    leaves: ClaimLeafInput[];
    threshold: number;
    operatorRecipients: OperatorRecipientInput[];
    transferId: string;
    senderIdentityPublicKey: string;
  }): Promise<ClaimResult> {
    const intent: Record<string, unknown> = {
      signWith: this.sparkAddress,
      signatures: [],
      packageRequest: {
        claim: {
          leaves: params.leaves,
          threshold: params.threshold,
          operatorRecipients: params.operatorRecipients,
          transferId: params.transferId,
          senderIdentityPublicKey: params.senderIdentityPublicKey,
        },
      },
    };

    const result = await this.callPrepareAndSign(intent);

    return {
      operatorPackages: result.operatorPackages ?? [],
    };
  }

  /**
   * Prepare a Lightning receive: generate a preimage inside Turnkey, split it
   * into encrypted operator packages, and return only the payment hash plus
   * encrypted packages. The raw preimage/shares never enter client JS.
   */
  async prepareLightningReceive(params: {
    threshold: number;
    operatorRecipients: OperatorRecipientInput[];
  }): Promise<LightningReceiveResult> {
    if (params.threshold < 2) {
      throw new Error("Lightning receive threshold must be at least 2");
    }

    const intent: Record<string, unknown> = {
      signWith: this.sparkAddress,
      signatures: [],
      packageRequest: {
        lightningReceive: {
          threshold: params.threshold,
          operatorRecipients: params.operatorRecipients,
        },
      },
    };

    const result = await this.callPrepareAndSign(intent);

    if (!result.paymentHash) {
      throw new Error(
        "SPARK_PREPARE_AND_SIGN returned no payment hash for lightning receive",
      );
    }

    return {
      paymentHash: result.paymentHash,
      operatorPackages: result.operatorPackages ?? [],
    };
  }

  // ---------------------------------------------------------------------------
  // Key operations (via SPARK_KEY_OPERATION)
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
        "SPARK_PREPARE_AND_SIGN — raw shares never leave the enclave. " +
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

    const cacheKey = keyDerivationCacheKey(keyDerivation);
    const cached = this.publicKeyCache.get(cacheKey);
    if (cached) {
      return cloneBytes(await cached);
    }

    const promise = this.fetchPublicKeyFromDerivation(keyDerivation);
    this.publicKeyCache.set(cacheKey, promise);

    try {
      return cloneBytes(await promise);
    } catch (err) {
      this.publicKeyCache.delete(cacheKey);
      throw err;
    }
  }

  async getPublicKeysFromDerivations(
    keyDerivations: KeyDerivation[],
  ): Promise<Uint8Array[]> {
    const output = new Array<Uint8Array>(keyDerivations.length);
    const missingIndexes: number[] = [];
    const missingDerivations: KeyDerivation[] = [];

    for (let i = 0; i < keyDerivations.length; i++) {
      const keyDerivation = keyDerivations[i]!;
      const cached = this.publicKeyCache.get(
        keyDerivationCacheKey(keyDerivation),
      );
      if (cached) {
        output[i] = cloneBytes(await cached);
      } else {
        missingIndexes.push(i);
        missingDerivations.push(keyDerivation);
      }
    }

    if (missingDerivations.length === 0) {
      return output;
    }

    const batchPromise = this.fetchPublicKeysFromDerivations(missingDerivations);
    const perKeyPromises = missingDerivations.map((_, i) =>
      batchPromise.then((keys) => keys[i]!),
    );

    missingDerivations.forEach((keyDerivation, i) => {
      this.publicKeyCache.set(
        keyDerivationCacheKey(keyDerivation),
        perKeyPromises[i]!,
      );
    });

    try {
      const missingKeys = await batchPromise;
      missingIndexes.forEach((originalIndex, i) => {
        output[originalIndex] = cloneBytes(missingKeys[i]!);
      });
      return output;
    } catch (err) {
      missingDerivations.forEach((keyDerivation) => {
        this.publicKeyCache.delete(keyDerivationCacheKey(keyDerivation));
      });
      throw err;
    }
  }

  private async fetchPublicKeyFromDerivation(
    keyDerivation: KeyDerivation,
  ): Promise<Uint8Array> {
    const publicKeys = await this.fetchPublicKeysFromDerivations([
      keyDerivation,
    ]);
    return publicKeys[0]!;
  }

  private async fetchPublicKeysFromDerivations(
    keyDerivations: KeyDerivation[],
  ): Promise<Uint8Array[]> {
    const result = await this.callSparkKeyOperation({
      signWith: this.sparkAddress,
      derivePublicKeys: keyDerivations.map((keyDerivation) => ({
        derivation: mapKeyDerivation(keyDerivation),
      })),
    });

    if (!result.publicKeys || result.publicKeys.length !== keyDerivations.length) {
      throw new Error(
        `SPARK_KEY_OPERATION returned ${result.publicKeys?.length ?? 0} public keys; expected ${keyDerivations.length}`,
      );
    }

    return result.publicKeys.map((entry, i) => {
      if (!entry.publicKey) {
        throw new Error(`SPARK_KEY_OPERATION returned no public key at index ${i}`);
      }
      return fromHex(entry.publicKey);
    });
  }

  async getDepositSigningKey(): Promise<Uint8Array> {
    return this.getPublicKeyFromDerivation({
      type: "deposit",
    } as unknown as KeyDerivation);
  }

  async getStaticDepositSigningKey(idx: number): Promise<Uint8Array> {
    return this.getPublicKeyFromDerivation({
      type: "static_deposit",
      path: idx,
    } as unknown as KeyDerivation);
  }

  async setStaticDepositSecretKey(idx: number, secretKey: Uint8Array): Promise<void> {
    if (secretKey.length !== 32) {
      throw new Error(
        `Static deposit secret key must be 32 bytes, got ${secretKey.length}`,
      );
    }

    const expectedPublicKey = await this.getStaticDepositSigningKey(idx);
    const actualPublicKey = secp256k1.getPublicKey(secretKey);
    if (!bytesEqual(actualPublicKey, expectedPublicKey)) {
      throw new Error(
        `Exported static deposit key at index ${idx} does not match Spark-derived public key`,
      );
    }

    this.clearStaticDepositSecretKey(idx);
    this.staticDepositSecretKeys.set(idx, cloneBytes(secretKey));
  }

  clearStaticDepositSecretKey(idx: number): void {
    const secretKey = this.staticDepositSecretKeys.get(idx);
    if (secretKey) {
      secretKey.fill(0);
      this.staticDepositSecretKeys.delete(idx);
    }
  }

  async getStaticDepositSecretKey(idx: number): Promise<Uint8Array> {
    const secretKey = this.staticDepositSecretKeys.get(idx);
    if (secretKey) {
      return cloneBytes(secretKey);
    }
    return notImplemented("getStaticDepositSecretKey");
  }

  // ---------------------------------------------------------------------------
  // Not needed for Turnkey-backed wallets
  // ---------------------------------------------------------------------------

  async generateMnemonic(): Promise<string> {
    return notImplemented("generateMnemonic");
  }

  async subtractPrivateKeysGivenDerivationPaths(
    _first: string,
    _second: string,
  ): Promise<Uint8Array> {
    return notImplemented("subtractPrivateKeysGivenDerivationPaths");
  }

  async subtractAndSplitSecretWithProofsGivenDerivations(
    _params: Omit<SplitSecretWithProofsParams, "secret"> & {
      first: KeyDerivation;
      second?: KeyDerivation | undefined;
    },
  ): Promise<VerifiableSecretShare[]> {
    return notImplemented("subtractAndSplitSecretWithProofsGivenDerivations");
  }

  async splitSecretWithProofs(
    _params: SplitSecretWithProofsParams,
  ): Promise<VerifiableSecretShare[]> {
    return notImplemented("splitSecretWithProofs");
  }

  signTransactionIndex(
    _tx: Transaction,
    _index: number,
    _publicKey: Uint8Array,
  ): void {
    notImplemented("signTransactionIndex");
  }

  async htlcHMAC(_transferID: string): Promise<Uint8Array> {
    return notImplemented("htlcHMAC");
  }

  async decryptEcies(_ciphertext: Uint8Array): Promise<Uint8Array> {
    return notImplemented("decryptEcies");
  }

  // ---------------------------------------------------------------------------
  // Internal: Turnkey activity calls
  // ---------------------------------------------------------------------------

  /**
   * Calls Turnkey's SPARK_PREPARE_AND_SIGN activity via the raw command API.
   *
   * The Turnkey SDK doesn't have a typed method for this activity yet —
   * once it's added to the OpenAPI spec and SDK codegen, replace this with
   * the typed `client.apiClient().sparkPrepareAndSign(...)` call.
   */
  private async callPrepareAndSign(
    intent: Record<string, unknown>,
  ): Promise<PrepareAndSignResult> {
    const apiClient = this.client.apiClient() as unknown as {
      command<B, R>(url: string, body: B, resultKey: string): Promise<R>;
      config: { organizationId?: string };
    };

    return apiClient.command<Record<string, unknown>, PrepareAndSignResult>(
      "/public/v1/submit/spark_prepare_and_sign",
      {
        parameters: intent,
        organizationId: apiClient.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_SPARK_PREPARE_AND_SIGN",
      },
      "sparkPrepareAndSignResult",
    );
  }

  private async callSparkKeyOperation(
    intent: Record<string, unknown>,
  ): Promise<KeyOperationResult> {
    const apiClient = this.client.apiClient() as unknown as {
      command<B, R>(url: string, body: B, resultKey: string): Promise<R>;
      config: { organizationId?: string };
    };

    return apiClient.command<Record<string, unknown>, KeyOperationResult>(
      "/public/v1/submit/spark_key_operation",
      {
        parameters: intent,
        organizationId: apiClient.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_SPARK_KEY_OPERATION",
      },
      "sparkKeyOperationResult",
    );
  }
}
