/**
 * Claim orchestration for the Turnkey Spark signer.
 *
 * The Spark SDK's built-in claimTransfer() calls
 * subtractAndSplitSecretWithProofsGivenDerivations() per-leaf and immediately
 * uses raw Feldman shares to build per-operator packages client-side.
 * Turnkey's enclave does this atomically — raw shares never leave the enclave.
 *
 * This module replaces the key-tweak step with a SPARK_PREPARE_AND_SIGN call
 * carrying a `claim` package request, while reusing the SDK's refund signing
 * and verification infrastructure.
 *
 * Usage:
 *   const leaves = await turnkeyClaim(wallet, signer, transfer);
 */

import {
  type SparkWallet,
  KeyDerivationType,
  getClaimPackageSigningPayload,
  type KeyDerivation,
  type NetworkType,
  type SigningCommitment,
} from "@buildonspark/spark-sdk";
import type { TurnkeySparkSigner, ClaimLeafInput, OperatorRecipientInput } from "./turnkeySigner";

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function fromHex(h: string): Uint8Array {
  return Buffer.from(h.replace(/^0x/, ""), "hex");
}

// ---------------------------------------------------------------------------
// SDK internal access helpers
// ---------------------------------------------------------------------------

interface SparkWalletInternals {
  transferService: {
    connectionManager: {
      createSparkClient(address: string): Promise<SparkGrpcClient>;
    };
    config: SparkConfig;
    signingService: SparkSigningService;
    verifyPendingTransfer(
      transfer: SparkTransfer,
    ): Promise<Map<string, Uint8Array>>;
    queryPendingTransfers(transferIds?: string[]): Promise<{
      transfers: SparkTransfer[];
    }>;
    queryTransfer(transferId: string): Promise<SparkTransfer | undefined>;
  };
  leafManager: {
    addLeaves(leaves: WalletLeaf[]): Promise<void>;
    addIncomingLeaves(leaves: WalletLeaf[], id: string): Promise<void>;
    handleTransferEvent(transfer: SparkTransfer): Promise<void>;
  };
  config: SparkConfig;
}

interface SparkConfig {
  getSigningOperators(): Record<
    string,
    { id: number; identifier: string; identityPublicKey: string }
  >;
  getThreshold(): number;
  getCoordinatorAddress(): string;
  getNetworkType(): NetworkType;
  signer: TurnkeySparkSigner;
}

interface SparkGrpcClient {
  get_signing_commitments(params: {
    nodeIdCount: number;
    count: number;
  }): Promise<{ signingCommitments: OperatorSigningCommitment[] }>;
  claim_transfer(params: {
    transferId: string;
    ownerIdentityPublicKey: Uint8Array;
    claimPackage: ClaimPackage;
  }): Promise<{ transfer?: SparkTransfer }>;
  query_pending_transfers(params: {
    participant: {
      $case: string;
      receiverIdentityPublicKey: Uint8Array;
    };
    transferIds?: string[];
    network: unknown;
  }): Promise<{ transfers: SparkTransfer[] }>;
}

interface OperatorSigningCommitment {
  signingNonceCommitments?: Record<
    string,
    { hiding: Uint8Array; binding: Uint8Array }
  >;
  publicKeys?: Record<string, Uint8Array>;
  signatureShares?: Record<string, Uint8Array>;
  verifyingKey?: Uint8Array;
  leafId?: string;
}

interface SparkSigningService {
  signRefundsForClaim(
    leaves: LeafTweak[],
    cpfpCommitments: OperatorSigningCommitment[],
    directCommitments: OperatorSigningCommitment[],
    directFromCpfpCommitments: OperatorSigningCommitment[],
  ): Promise<{
    cpfpLeafSigningJobs: LeafSigningJob[];
    directLeafSigningJobs: LeafSigningJob[];
    directFromCpfpLeafSigningJobs: LeafSigningJob[];
  }>;
}

interface TransferLeafData {
  leaf: LeafSelection;
  secretCipher: Uint8Array;
  signature: Uint8Array;
  intermediateRefundTx: Uint8Array;
  intermediateDirectRefundTx: Uint8Array;
  intermediateDirectFromCpfpRefundTx: Uint8Array;
}

interface SparkTransfer {
  id: string;
  senderIdentityPublicKey: Uint8Array;
  leaves: TransferLeafData[];
  [key: string]: unknown;
}

interface LeafSelection {
  id: string;
  nodeTx: Uint8Array;
  refundTx: Uint8Array;
  directTx: Uint8Array;
  directRefundTx: Uint8Array;
  directFromCpfpRefundTx: Uint8Array;
  value: bigint;
  status: string;
  [key: string]: unknown;
}

interface WalletLeaf {
  id: string;
  status: string;
  [key: string]: unknown;
}

interface LeafTweak {
  leaf: LeafSelection;
  keyDerivation: KeyDerivation;
  newKeyDerivation: KeyDerivation;
  receiverIdentityPublicKey: Uint8Array;
}

interface LeafSigningJob {
  leafId: string;
  rawTx: Uint8Array;
  selfCommitment: { commitment: SigningCommitment };
  signingPublicKey: Uint8Array;
  userSignature: Uint8Array;
  [key: string]: unknown;
}

interface ClaimPackage {
  leavesToClaim: LeafSigningJob[];
  keyTweakPackage: Record<string, Uint8Array>;
  userSignature: Uint8Array;
  directLeavesToClaim: LeafSigningJob[];
  directFromCpfpLeavesToClaim: LeafSigningJob[];
  hashVariant?: number;
}

// HashVariant.HASH_VARIANT_V2 = 1
const HASH_VARIANT_V2 = 1;

/**
 * Claim an inbound Spark transfer using Turnkey's enclave for key tweaks.
 *
 * Replaces the SDK's built-in claimTransfer() flow which calls
 * subtractAndSplitSecretWithProofsGivenDerivations() — incompatible with
 * enclave-only signing.
 */
export async function turnkeyClaim(
  wallet: SparkWallet,
  signer: TurnkeySparkSigner,
  transfer: SparkTransfer,
): Promise<WalletLeaf[]> {
  const internals = wallet as unknown as SparkWalletInternals;
  const config = internals.config;
  const transferService = internals.transferService;
  const signingService = transferService.signingService;

  const signingOperators = config.getSigningOperators();
  const threshold = config.getThreshold();
  const operatorRecipients: OperatorRecipientInput[] = Object.values(
    signingOperators,
  )
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((op) => ({
      operatorId: String(op.id),
      encryptionPublicKey: op.identityPublicKey,
    }));

  // ── Phase 1: Verify the inbound transfer ──────────────────────────
  // Decrypts each leaf's secretCipher via ECIES (SPARK_KEY_OPERATION)
  // and verifies the sender's signature.
  await transferService.verifyPendingTransfer(transfer);

  const selfIdentityPubkey = await signer.getIdentityPublicKey();

  // Build leaf list from transfer data
  const leaves: Array<{
    leaf: LeafSelection;
    secretCipherHex: string;
    newKeyDerivation: KeyDerivation;
  }> = [];

  for (const tLeaf of transfer.leaves) {
    if (!tLeaf.leaf) continue;
    const leaf: LeafSelection = {
      ...tLeaf.leaf,
      refundTx: tLeaf.intermediateRefundTx,
      directTx: tLeaf.intermediateDirectRefundTx ?? new Uint8Array(),
      directRefundTx: tLeaf.intermediateDirectRefundTx ?? new Uint8Array(),
      directFromCpfpRefundTx:
        tLeaf.intermediateDirectFromCpfpRefundTx ?? new Uint8Array(),
    };
    leaves.push({
      leaf,
      secretCipherHex: hex(tLeaf.secretCipher),
      newKeyDerivation: {
        type: KeyDerivationType.LEAF,
        path: tLeaf.leaf.id,
      },
    });
  }

  // ── Phase 2: Sign refund transactions ─────────────────────────────
  const sparkClient =
    await transferService.connectionManager.createSparkClient(
      config.getCoordinatorAddress(),
    );

  const n = leaves.length;
  const { signingCommitments } = await sparkClient.get_signing_commitments({
    nodeIdCount: n,
    count: 3,
  });

  // signRefundsForClaim signs with the NEW key — both keyDerivation and
  // newKeyDerivation point to the same LEAF derivation.
  const claimLeaves: LeafTweak[] = await Promise.all(
    leaves.map(async (l) => ({
      leaf: l.leaf,
      keyDerivation: l.newKeyDerivation,
      newKeyDerivation: l.newKeyDerivation,
      receiverIdentityPublicKey: await signer.getPublicKeyFromDerivation(
        l.newKeyDerivation,
      ),
    })),
  );

  const {
    cpfpLeafSigningJobs,
    directLeafSigningJobs,
    directFromCpfpLeafSigningJobs,
  } = await signingService.signRefundsForClaim(
    claimLeaves,
    signingCommitments.slice(0, n),
    signingCommitments.slice(n, 2 * n),
    signingCommitments.slice(2 * n, 3 * n),
  );

  // ── Phase 3: Key tweaks via Turnkey enclave ───────────────────────
  // The enclave atomically:
  //   - decrypts each leaf's inbound ciphertext (ECIES)
  //   - derives the new leaf key
  //   - computes tweak = old - new (mod n)
  //   - Feldman-splits the tweak across operators
  //   - ECIES-encrypts per-operator packages
  const claimLeafInputs: ClaimLeafInput[] = leaves.map((l) => ({
    leafId: l.leaf.id,
    ciphertext: l.secretCipherHex,
  }));

  const turnkeyResult = await signer.prepareClaim({
    leaves: claimLeafInputs,
    threshold,
    operatorRecipients,
  });

  // ── Phase 4: Assemble and send ────────────────────────────────────
  const keyTweakPackage: Record<string, Uint8Array> = {};
  for (const pkg of turnkeyResult.operatorPackages) {
    keyTweakPackage[pkg.operatorId] = fromHex(pkg.encryptedPackage);
  }

  const claimPackage: ClaimPackage = {
    leavesToClaim: cpfpLeafSigningJobs,
    keyTweakPackage,
    userSignature: new Uint8Array(),
    directLeavesToClaim: directLeafSigningJobs,
    directFromCpfpLeavesToClaim: directFromCpfpLeafSigningJobs,
    hashVariant: HASH_VARIANT_V2,
  };

  // Sign the claim package payload with identity key
  const signingPayload = getClaimPackageSigningPayload(
    transfer.id,
    keyTweakPackage,
  );
  claimPackage.userSignature = new Uint8Array(
    await signer.signMessageWithIdentityKey(signingPayload),
  );

  const response = await sparkClient.claim_transfer({
    transferId: transfer.id,
    ownerIdentityPublicKey: selfIdentityPubkey,
    claimPackage,
  });

  if (!response.transfer) {
    throw new Error("No transfer response from claim_transfer");
  }

  const claimedLeaves: WalletLeaf[] = response.transfer.leaves
    .flatMap((l: TransferLeafData) => (l.leaf ? [l.leaf] : []))
    .map((l: LeafSelection) => l as unknown as WalletLeaf);

  return claimedLeaves;
}
