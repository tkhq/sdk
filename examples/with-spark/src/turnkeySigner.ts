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
import type { Transaction } from "@scure/btc-signer";
import type { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function fromHex(h: string): Uint8Array {
  return Buffer.from(h.replace(/^0x/, ""), "hex");
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

function isAlreadyExistsError(err: unknown): boolean {
  const candidate = err as { code?: unknown; message?: unknown };
  return (
    candidate.code === 6 ||
    candidate.code === "ALREADY_EXISTS" ||
    String(candidate.message ?? err).includes("already exists")
  );
}

function isNotFoundError(err: unknown): boolean {
  const candidate = err as { code?: unknown; message?: unknown };
  return (
    candidate.code === 5 ||
    candidate.code === "NOT_FOUND" ||
    String(candidate.message ?? err)
      .toLowerCase()
      .includes("not found")
  );
}

function compressedPublicKeyHex(account: WalletAccount): string | undefined {
  const candidate = account.publicKey ?? account.address;
  return /^[0-9a-fA-F]{66}$/.test(candidate) ? candidate : undefined;
}

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

/**
 * Maps an SDK KeyDerivation to the proto SparkKeyDerivation oneof shape with
 * the signingLeaf variant selected.
 *
 * The three call sites — SPARK_SIGN_FROST signature requests and
 * SPARK_PREPARE_TRANSFER's {old,new}_leaf_derivation — accept the polymorphic
 * SparkKeyDerivation, but the SDK only drives the signingLeaf variant; other
 * derivation types are rejected here.
 */
function mapSigningLeafDerivation(
  kd: KeyDerivation,
): { signingLeaf: { leafId: string } } {
  if (kd.type !== "leaf") {
    throw new Error(
      `Expected leaf KeyDerivation for SparkKeyDerivation signingLeaf, got ${kd.type}`,
    );
  }
  return { signingLeaf: { leafId: String(kd.path) } };
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
 * Result shape from Turnkey's SPARK_SIGN_FROST activity.
 * Mirrors SparkSignFrostResult from activity.proto.
 */
interface SparkSignFrostResult {
  signatures: Array<{
    signatureShare: string;
    hiding: string;
    binding: string;
  }>;
}

/**
 * Result shape from Turnkey's SPARK_PREPARE_TRANSFER activity.
 * Mirrors SparkPrepareTransferResult from activity.proto.
 */
interface SparkPrepareTransferResult {
  operatorPackages: Array<{
    operatorId: string;
    encryptedPackage: string;
  }>;
  transferUserSignature: string;
  newLeafPublicKeys?: Array<{ leafId: string; publicKey: string }>;
}

/**
 * Result shape from Turnkey's SPARK_CLAIM_TRANSFER activity.
 * Mirrors SparkClaimTransferResult from activity.proto.
 */
interface SparkClaimTransferResult {
  operatorPackages: Array<{
    operatorId: string;
    encryptedPackage: string;
  }>;
  newLeafPublicKeys?: Array<{ leafId: string; publicKey: string }>;
}

/**
 * Result shape from Turnkey's SPARK_PREPARE_LIGHTNING_RECEIVE activity.
 * Mirrors SparkPrepareLightningReceiveResult from activity.proto.
 */
interface SparkPrepareLightningReceiveResult {
  operatorPackages: Array<{
    operatorId: string;
    encryptedPackage: string;
  }>;
  paymentHash: string;
}

type WalletAccount = {
  walletAccountId?: string;
  walletId?: string;
  address: string;
  addressFormat: string;
  path: string;
  publicKey?: string;
};

type WalletListItem = { walletId: string };

type PaginationOptions = {
  limit?: string;
  before?: string;
  after?: string;
};

type ApiClient = {
  config: { organizationId?: string };
  getWalletAccounts(params: {
    organizationId?: string | undefined;
    walletId: string;
    paginationOptions?: PaginationOptions | undefined;
  }): Promise<{ accounts: WalletAccount[] }>;
  getWalletAccount(params: {
    organizationId?: string | undefined;
    walletId: string;
    path?: string | undefined;
    address?: string | undefined;
  }): Promise<{ account: WalletAccount }>;
  getWallets(params: {
    organizationId?: string | undefined;
  }): Promise<{ wallets: WalletListItem[] }>;
  createWalletAccounts(params: {
    organizationId?: string | undefined;
    walletId: string;
    accounts: Array<{
      curve: string;
      pathFormat: string;
      path: string;
      addressFormat: string;
    }>;
  }): Promise<{ addresses: string[] }>;
  command<B, R>(url: string, body: B, resultKey: string): Promise<R>;
};

const SPARK_IDENTITY_SUFFIX = "/0'";
const SPARK_SIGNING_SUFFIX = "/1'";
const SPARK_DEPOSIT_SUFFIX = "/2'";
const SPARK_STATIC_DEPOSIT_SUFFIX = "/3'";
const COMPRESSED_ADDRESS_FORMAT = "ADDRESS_FORMAT_COMPRESSED";
const BIP32_HARDENED_RESERVED = 0x80000000;
const ACCOUNT_LOOKUP_RETRIES = 6;
const ACCOUNT_LOOKUP_RETRY_MS = 500;

function signingHdLeafChild(leafId: string): number {
  const digest = sha256(Buffer.from(leafId, "utf8"));
  return (
    ((digest[0]! << 24) |
      (digest[1]! << 16) |
      (digest[2]! << 8) |
      digest[3]!) >>>
    0
  ) % BIP32_HARDENED_RESERVED;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
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

export class TurnkeySparkSigner implements SparkSigner {
  private readonly client: TurnkeyServerSDK;
  /** Spark-formatted address → signRawPayload returns BIP340 Schnorr */
  private readonly sparkAddress: string;
  /** Compressed address for ECDSA, or Spark address when only Schnorr identity signing is available */
  private readonly ecdsaAddress: string;
  /** Compressed 33-byte public key (02/03 prefix) */
  private readonly identityPublicKeyHex: string;
  private readonly walletId: string | undefined;
  private readonly leafSigningKeys = new Map<string, Promise<Uint8Array>>();
  /**
   * Prefetched SIGNING_HD pubkeys, keyed by BIP32 child index (the
   * `signingHdLeafChild(leafId)` output). Populated once at construction by
   * paging through all wallet accounts under m/8797555'/{acct}'/1'/.
   * Lets repeat-session leaf lookups skip a CREATE_WALLET_ACCOUNTS round-trip.
   */
  private prefetchedLeafSigningKeysByChild?: Promise<Map<number, Uint8Array>>;
  private depositSigningKey?: Promise<Uint8Array>;
  private readonly staticDepositSigningKeys = new Map<number, Promise<Uint8Array>>();
  /** Optional exported static-deposit keys for SDK compatibility flows. */
  private readonly staticDepositSecretKeys = new Map<number, Uint8Array>();

  constructor(
    client: TurnkeyServerSDK,
    sparkAddress: string,
    ecdsaAddress: string,
    identityPublicKeyHex: string,
    options: {
      walletId?: string | undefined;
      depositPublicKeyHex?: string | undefined;
      staticDepositPublicKeys?: Record<number, string> | undefined;
    } = {},
  ) {
    this.client = client;
    this.sparkAddress = sparkAddress;
    this.ecdsaAddress = ecdsaAddress;
    this.identityPublicKeyHex = identityPublicKeyHex;
    this.walletId = options.walletId;
    if (options.depositPublicKeyHex) {
      this.depositSigningKey = Promise.resolve(fromHex(options.depositPublicKeyHex));
    }
    for (const [index, publicKeyHex] of Object.entries(
      options.staticDepositPublicKeys ?? {},
    )) {
      this.staticDepositSigningKeys.set(
        Number(index),
        Promise.resolve(fromHex(publicKeyHex)),
      );
    }

    // Fire-and-forget: page through existing SIGNING_HD wallet accounts and
    // index by child. The first getLeafSigningKey lookup awaits this; the
    // Spark SDK's LeafManager.sync calls it in parallel for every known leaf,
    // so all of them become cache hits with no extra round-trips.
    this.prefetchedLeafSigningKeysByChild = this.prefetchSigningHdAccounts().catch((err) => {
      console.warn("[turnkeySigner] leaf signing-key prefetch failed:", err);
      return new Map<number, Uint8Array>();
    });
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

    const signatureRequests = params.map((p) => ({
      derivation: mapSigningLeafDerivation(p.keyDerivation),
      message: hex(p.message),
      verifyingKey: hex(p.verifyingKey),
      operatorCommitments: mapOperatorCommitments(p.statechainCommitments),
      // Spark SDK passes `new Uint8Array()` for non-adaptor signs (empty
      // is truthy as an object), so length-check before forwarding to
      // avoid sending an empty `adaptorPublicKey` on every FROST call.
      ...(p.adaptorPubKey && p.adaptorPubKey.length > 0
        ? { adaptorPublicKey: hex(p.adaptorPubKey) }
        : {}),
    }));

    const result = await this.command<SparkSignFrostResult>(
      "/public/v1/submit/spark_sign_frost",
      "ACTIVITY_TYPE_SPARK_SIGN_FROST",
      "sparkSignFrostResult",
      { signWith: this.sparkAddress, signatures: signatureRequests },
    );

    if (result.signatures.length !== params.length) {
      throw new Error(
        `SPARK_SIGN_FROST returned ${result.signatures.length} signatures; expected ${params.length}`,
      );
    }

    return result.signatures.map((sig, i) => {
      const commitment = params[i]!.selfCommitment.commitment;
      commitment.hiding = fromHex(sig.hiding);
      commitment.binding = fromHex(sig.binding);
      return fromHex(sig.signatureShare);
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
      oldLeafDerivation: mapSigningLeafDerivation(l.oldLeafDerivation),
      newLeafDerivation: mapSigningLeafDerivation(l.newLeafDerivation),
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

    const result = await this.command<SparkPrepareTransferResult>(
      "/public/v1/submit/spark_prepare_transfer",
      "ACTIVITY_TYPE_SPARK_PREPARE_TRANSFER",
      "sparkPrepareTransferResult",
      {
        signWith: this.sparkAddress,
        transfer: {
          transferId: params.transferId,
          leaves,
          threshold: params.threshold,
          operatorRecipients: params.operatorRecipients,
          receiverPublicKey: params.receiverPublicKey,
        },
      },
    );

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
    const result = await this.command<SparkClaimTransferResult>(
      "/public/v1/submit/spark_claim_transfer",
      "ACTIVITY_TYPE_SPARK_CLAIM_TRANSFER",
      "sparkClaimTransferResult",
      {
        signWith: this.sparkAddress,
        claim: {
          leaves: params.leaves,
          threshold: params.threshold,
          transferId: params.transferId,
          operatorRecipients: params.operatorRecipients,
          senderIdentityPublicKey: params.senderIdentityPublicKey,
        },
      },
    );

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

    const result = await this.command<SparkPrepareLightningReceiveResult>(
      "/public/v1/submit/spark_prepare_lightning_receive",
      "ACTIVITY_TYPE_SPARK_PREPARE_LIGHTNING_RECEIVE",
      "sparkPrepareLightningReceiveResult",
      {
        signWith: this.sparkAddress,
        lightningReceive: {
          threshold: params.threshold,
          operatorRecipients: params.operatorRecipients,
        },
      },
    );

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
        throw new Error(`Unsupported key derivation type: ${keyDerivation.type}`);
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
    let publicKey = this.leafSigningKeys.get(leafId);
    if (publicKey) return cloneBytes(await publicKey);

    const child = signingHdLeafChild(leafId);

    // Try the prefetched map first — covers every leaf account that already
    // existed in the Turnkey wallet at construction time (the common case
    // for repeat sessions).
    if (this.prefetchedLeafSigningKeysByChild) {
      const prefetched = await this.prefetchedLeafSigningKeysByChild;
      const fromPrefetch = prefetched.get(child);
      if (fromPrefetch) {
        this.leafSigningKeys.set(leafId, Promise.resolve(fromPrefetch));
        return cloneBytes(fromPrefetch);
      }
    }

    publicKey = this.createOrReuseSparkAccountPublicKey(
      `${SPARK_SIGNING_SUFFIX}/${child}'`,
    );
    this.leafSigningKeys.set(leafId, publicKey);
    return cloneBytes(await publicKey);
  }

  /**
   * Page through every wallet account and collect the SIGNING_HD ones into
   * a `child → public_key` map. Called once at construction; subsequent
   * leaf lookups read this map instead of round-tripping per-leaf.
   */
  private async prefetchSigningHdAccounts(): Promise<Map<number, Uint8Array>> {
    const apiClient = this.apiClient();
    const sparkAccount = await this.findSparkIdentityAccount(apiClient);
    const basePath = sparkAccount.account.path.endsWith(SPARK_IDENTITY_SUFFIX)
      ? sparkAccount.account.path.slice(0, -SPARK_IDENTITY_SUFFIX.length)
      : undefined;
    if (!basePath) return new Map();

    const signingPrefix = `${basePath}${SPARK_SIGNING_SUFFIX}/`;
    const pageLimit = 100;
    const result = new Map<number, Uint8Array>();
    let cursor: string | undefined;

    while (true) {
      const { accounts } = await apiClient.getWalletAccounts({
        organizationId: apiClient.config.organizationId,
        walletId: sparkAccount.walletId,
        paginationOptions: {
          limit: String(pageLimit),
          ...(cursor ? { after: cursor } : {}),
        },
      });
      if (accounts.length === 0) break;

      for (const account of accounts) {
        if (account.addressFormat !== COMPRESSED_ADDRESS_FORMAT) continue;
        if (!account.path.startsWith(signingPrefix)) continue;
        const trailing = account.path.slice(signingPrefix.length);
        const match = trailing.match(/^(\d+)'$/);
        if (!match) continue;
        const child = Number(match[1]);
        const pubkeyHex = compressedPublicKeyHex(account);
        if (!pubkeyHex) continue;
        result.set(child, fromHex(pubkeyHex));
      }

      if (accounts.length < pageLimit) break;
      const last = accounts[accounts.length - 1];
      if (!last?.walletAccountId) break;
      cursor = last.walletAccountId;
    }

    return result;
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
    entries: Array<{ leafId: string; publicKey: string }> | undefined,
  ): void {
    if (!entries) return;
    const seenPubkeys = new Set<string>();
    for (const { leafId, publicKey } of entries) {
      if (!/^[0-9a-fA-F]{66}$/.test(publicKey)) {
        throw new Error(
          `signer returned malformed pubkey for leaf ${leafId}: ` +
            `expected 66 hex chars (33-byte compressed secp256k1), got ${publicKey.length}`,
        );
      }
      try {
        secp256k1.ProjectivePoint.fromHex(publicKey);
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
      this.leafSigningKeys.set(leafId, Promise.resolve(fromHex(publicKey)));
    }
  }

  async getDepositSigningKey(): Promise<Uint8Array> {
    if (!this.depositSigningKey) {
      this.depositSigningKey = this.createOrReuseSparkAccountPublicKey(
        SPARK_DEPOSIT_SUFFIX,
      );
    }
    return cloneBytes(await this.depositSigningKey);
  }

  async getStaticDepositSigningKey(idx: number): Promise<Uint8Array> {
    if (!Number.isInteger(idx) || idx < 0) {
      throw new Error(`Invalid static deposit index: ${idx}`);
    }

    let publicKey = this.staticDepositSigningKeys.get(idx);
    if (!publicKey) {
      publicKey = this.createOrReuseSparkAccountPublicKey(
        `${SPARK_STATIC_DEPOSIT_SUFFIX}/${idx}'`,
      );
      this.staticDepositSigningKeys.set(idx, publicKey);
    }
    return cloneBytes(await publicKey);
  }

  private async createOrReuseSparkAccountPublicKey(
    suffixFromSparkBase: string,
  ): Promise<Uint8Array> {
    const apiClient = this.apiClient();
    const sparkAccount = await this.findSparkIdentityAccount(apiClient);
    const basePath = sparkAccount.account.path.endsWith(SPARK_IDENTITY_SUFFIX)
      ? sparkAccount.account.path.slice(0, -SPARK_IDENTITY_SUFFIX.length)
      : undefined;
    if (!basePath) {
      throw new Error(
        `Spark identity account path must end in ${SPARK_IDENTITY_SUFFIX}, got ${sparkAccount.account.path}`,
      );
    }

    const path = `${basePath}${suffixFromSparkBase}`;
    let account = await this.fetchWalletAccountByPath(
      apiClient,
      sparkAccount.walletId,
      path,
    );

    if (!account || !compressedPublicKeyHex(account)) {
      try {
        await apiClient.createWalletAccounts({
          organizationId: apiClient.config.organizationId,
          walletId: sparkAccount.walletId,
          accounts: [
            {
              curve: "CURVE_SECP256K1",
              pathFormat: "PATH_FORMAT_BIP32",
              path,
              addressFormat: COMPRESSED_ADDRESS_FORMAT,
            },
          ],
        });
      } catch (err) {
        if (!isAlreadyExistsError(err)) throw err;
      }

      for (let attempt = 0; attempt < ACCOUNT_LOOKUP_RETRIES; attempt++) {
        account = await this.fetchWalletAccountByPath(
          apiClient,
          sparkAccount.walletId,
          path,
        );
        if (account && compressedPublicKeyHex(account)) break;
        await sleep(ACCOUNT_LOOKUP_RETRY_MS);
      }
    }

    const publicKeyHex = account && compressedPublicKeyHex(account);
    if (!publicKeyHex) {
      throw new Error(`Could not load Spark account public key for ${path}`);
    }

    return fromHex(publicKeyHex);
  }

  private async fetchWalletAccountByPath(
    apiClient: ApiClient,
    walletId: string,
    path: string,
  ): Promise<WalletAccount | undefined> {
    try {
      const { account } = await apiClient.getWalletAccount({
        organizationId: apiClient.config.organizationId,
        walletId,
        path,
      });
      return account;
    } catch (err) {
      if (isNotFoundError(err)) return undefined;
      throw err;
    }
  }

  private async findSparkIdentityAccount(
    apiClient: ApiClient,
  ): Promise<{ walletId: string; account: WalletAccount }> {
    if (this.walletId) {
      const accounts = await this.getWalletAccounts(apiClient, this.walletId);
      const account = accounts.find(
        (candidate) => candidate.address === this.sparkAddress,
      );
      if (!account) {
        throw new Error(
          `Could not find Spark address ${this.sparkAddress} in wallet ${this.walletId}`,
        );
      }
      return { walletId: this.walletId, account };
    }

    const { wallets } = await apiClient.getWallets({
      organizationId: apiClient.config.organizationId,
    });
    for (const wallet of wallets) {
      const accounts = await this.getWalletAccounts(apiClient, wallet.walletId);
      const account = accounts.find(
        (candidate) => candidate.address === this.sparkAddress,
      );
      if (account) return { walletId: wallet.walletId, account };
    }

    throw new Error(
      `Could not find a Turnkey wallet containing Spark address ${this.sparkAddress}`,
    );
  }

  private async getWalletAccounts(
    apiClient: ApiClient,
    walletId: string,
  ): Promise<WalletAccount[]> {
    const { accounts } = await apiClient.getWalletAccounts({
      organizationId: apiClient.config.organizationId,
      walletId,
    });
    return accounts;
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
    const secretKey = this.staticDepositSecretKeys.get(idx);
    if (secretKey) {
      return cloneBytes(secretKey);
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

  async splitSecretWithProofs(
    _params: SplitSecretWithProofsParams,
  ): Promise<VerifiableSecretShare[]> {
    throw new Error(
      "TurnkeySparkSigner.splitSecretWithProofs is not supported. The SDK's " +
        "built-in Lightning-receive path calls this with a client-generated " +
        "preimage; the Turnkey integration replaces it with " +
        "SPARK_PREPARE_LIGHTNING_RECEIVE which generates the preimage and " +
        "Feldman-splits it inside the enclave (the preimage never enters " +
        "client JS). Use TurnkeySparkSigner.prepareLightningReceive.",
    );
  }

  signTransactionIndex(
    _tx: Transaction,
    _index: number,
    _publicKey: Uint8Array,
  ): void {
    throw new Error(
      "TurnkeySparkSigner.signTransactionIndex is not supported. The Turnkey " +
        "integration uses signFrostBatch for FROST signing and signRawPayload " +
        "for identity signatures; no Turnkey-driven flow needs raw " +
        "transaction-index ECDSA signing with a client-held private key.",
    );
  }

  async htlcHMAC(_transferID: string): Promise<Uint8Array> {
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

  async decryptEcies(_ciphertext: Uint8Array): Promise<Uint8Array> {
    throw new Error(
      "TurnkeySparkSigner.decryptEcies is not supported. The SDK's built-in " +
        "claim flow calls this to decrypt the inbound ciphertext using the " +
        "wallet identity key client-side; the Turnkey integration replaces " +
        "the entire claim flow with SPARK_CLAIM_TRANSFER which performs " +
        "ECIES decryption inside the enclave (identity key never leaves). " +
        "Use TurnkeySparkSigner.prepareClaim — see src/internal/turnkeyClaim.ts.",
    );
  }

  /**
   * Calls a Turnkey activity via the raw command API.
   *
   * The Turnkey SDK doesn't have typed methods for the Spark activities yet —
   * once they land in the OpenAPI spec and SDK codegen, replace these with
   * typed `client.apiClient().xxx(...)` calls.
   */
  private async command<R>(
    url: string,
    type: string,
    resultKey: string,
    intent: Record<string, unknown>,
  ): Promise<R> {
    const apiClient = this.apiClient();

    return apiClient.command<Record<string, unknown>, R>(
      url,
      {
        parameters: intent,
        organizationId: apiClient.config.organizationId,
        timestampMs: String(Date.now()),
        type,
      },
      resultKey,
    );
  }

  private apiClient(): ApiClient {
    return this.client.apiClient() as unknown as ApiClient;
  }
}
