/**
 * Claim orchestration for the Turnkey Spark signer.
 *
 * The Spark SDK's built-in claimTransfer() calls
 * subtractAndSplitSecretWithProofsGivenDerivations() per-leaf and immediately
 * uses raw Feldman shares to build per-operator packages client-side.
 * Turnkey's enclave does this atomically — raw shares never leave the enclave.
 *
 * This module replaces the key-tweak step with a CLAIM_SPARK_TRANSFER call,
 * while reusing the SDK's refund signing and verification infrastructure.
 *
 * Usage:
 *   const leaves = await turnkeyClaim(wallet, signer, transfer);
 */

import {
  type SparkWallet,
  getClaimPackageSigningPayload,
} from "@buildonspark/spark-sdk";
import { secp256k1 } from "@noble/curves/secp256k1";
import type {
  ClaimLeafInput,
  OperatorRecipientInput,
  TurnkeySparkSigner,
} from "./turnkeySigner";
import {
  type ClaimPackage,
  getInternals,
  getOperatorRecipients,
  HASH_VARIANT_V2,
  hex,
  type LeafSelection,
  type LeafTweak,
  leafDerivation,
  mapKeyTweakPackage,
  type SparkTransfer,
  type WalletLeaf,
} from "./turnkeyInternal";

const TRANSFER_STATUS_COMPLETED = 5;
const ALREADY_EXISTS_ERROR_MAX_DEPTH = 4;

function compactEcdsaSignature(signature: Uint8Array): Uint8Array {
  if (signature.length === 64) {
    return secp256k1.Signature.fromCompact(signature)
      .normalizeS()
      .toCompactRawBytes();
  }

  try {
    return secp256k1.Signature.fromDER(signature)
      .normalizeS()
      .toCompactRawBytes();
  } catch {
    throw new Error(
      `Expected compact or DER ECDSA sender signature, got ${signature.length} bytes`,
    );
  }
}

function isAlreadyExistsError(error: unknown): boolean {
  let current: unknown = error;

  for (let i = 0; i < ALREADY_EXISTS_ERROR_MAX_DEPTH; i++) {
    if (!current || typeof current !== "object") break;
    const err = current as {
      code?: unknown;
      details?: unknown;
      message?: unknown;
      originalError?: unknown;
    };
    if (err.code === 6 || err.code === "ALREADY_EXISTS") return true;

    const text = `${err.details ?? ""} ${err.message ?? ""}`;
    if (text.includes("ALREADY_EXISTS") || text.includes("already completed")) {
      return true;
    }

    current = err.originalError;
  }

  const text = String(error);
  return text.includes("ALREADY_EXISTS") || text.includes("already completed");
}

function isCompletedTransfer(transfer: SparkTransfer): boolean {
  return (
    transfer.status === TRANSFER_STATUS_COMPLETED ||
    transfer.status === "TRANSFER_STATUS_COMPLETED"
  );
}

function claimedLeavesFromTransfer(transfer: SparkTransfer): WalletLeaf[] {
  return (transfer.leaves ?? [])
    .flatMap((l) => (l.leaf ? [l.leaf] : []))
    .map((l) => l as unknown as WalletLeaf);
}

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
  options: { register?: boolean } = {},
): Promise<WalletLeaf[]> {
  const internals = getInternals(wallet);
  const config = internals.config;
  const transferService = internals.transferService;
  const signingService = transferService.signingService;
  const operatorRecipients: OperatorRecipientInput[] =
    getOperatorRecipients(config);

  // Build leaf list from transfer data
  const leaves = (transfer.leaves ?? [])
    .filter((tLeaf) => tLeaf.leaf)
    .map((tLeaf) => ({
      leaf: {
        ...tLeaf.leaf,
        refundTx: tLeaf.intermediateRefundTx,
        directRefundTx: tLeaf.intermediateDirectRefundTx ?? new Uint8Array(),
        directFromCpfpRefundTx:
          tLeaf.intermediateDirectFromCpfpRefundTx ?? new Uint8Array(),
      } as LeafSelection,
      secretCipherHex: hex(tLeaf.secretCipher),
      senderSignatureHex: hex(compactEcdsaSignature(tLeaf.signature)),
      newKeyDerivation: leafDerivation(tLeaf.leaf!.id),
    }));

  if (leaves.length === 0) {
    throw new Error("No claimable leaves in transfer");
  }

  const sparkClient = await transferService.connectionManager.createSparkClient(
    config.getCoordinatorAddress(),
  );

  const n = leaves.length;

  // ── Phase 1: Key tweaks via Turnkey enclave (CLAIM_SPARK_TRANSFER) ─
  // The enclave atomically: decrypts each leaf's inbound ciphertext (ECIES),
  // derives the new leaf key, computes tweak, Feldman-splits across operators,
  // and ECIES-encrypts per-operator packages.
  const claimLeafInputs: ClaimLeafInput[] = leaves.map((l) => ({
    leafId: l.leaf.id,
    ciphertext: l.secretCipherHex,
    senderSignature: l.senderSignatureHex,
  }));

  const turnkeyResult = await signer.prepareClaim({
    leaves: claimLeafInputs,
    threshold: config.getThreshold(),
    operatorRecipients,
    transferId: transfer.id,
    senderIdentityPublicKey: hex(transfer.senderIdentityPublicKey!),
  });

  const keyTweakPackage = mapKeyTweakPackage(turnkeyResult.operatorPackages);

  // ── Phase 2: Sign refund transactions ─────────────────────────────
  // get_signing_commitments here uses nodeIdCount (not nodeIds) — claim flow
  // requests fresh commitments not tied to specific nodes.
  const { signingCommitments } = await sparkClient.get_signing_commitments({
    nodeIdCount: n,
    count: 3,
  });

  if (signingCommitments.length !== 3 * n) {
    throw new Error(
      `Expected ${3 * n} signing commitments, got ${signingCommitments.length}`,
    );
  }

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

  // ── Phase 3: Assemble and send ────────────────────────────────────
  const claimPackage: ClaimPackage = {
    leavesToClaim: cpfpLeafSigningJobs,
    keyTweakPackage,
    userSignature: new Uint8Array(
      await signer.signMessageWithIdentityKey(
        getClaimPackageSigningPayload(transfer.id, keyTweakPackage),
      ),
    ),
    directLeavesToClaim: directLeafSigningJobs,
    directFromCpfpLeavesToClaim: directFromCpfpLeafSigningJobs,
    hashVariant: HASH_VARIANT_V2,
  };

  let claimedLeaves: WalletLeaf[];
  try {
    const response = await sparkClient.claim_transfer({
      transferId: transfer.id,
      ownerIdentityPublicKey: await signer.getIdentityPublicKey(),
      claimPackage,
    });

    if (!response.transfer) {
      throw new Error("No transfer response from claim_transfer");
    }

    claimedLeaves = claimedLeavesFromTransfer(response.transfer);
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      throw error;
    }

    const completedTransfer = await transferService.queryTransfer(transfer.id);
    if (!completedTransfer || !isCompletedTransfer(completedTransfer)) {
      throw error;
    }

    claimedLeaves = claimedLeavesFromTransfer(completedTransfer);
  }

  if (options.register === false) {
    return claimedLeaves;
  }

  return internals.leafManager.registerClaimedLeaves(
    claimedLeaves,
    transfer.id,
  );
}
