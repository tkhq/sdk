/**
 * Turnkey-backed Spark leaf swap/change path.
 *
 * Spark SDK leaf selection swaps leaves when a requested transfer amount does
 * not exactly match existing wallet leaves. The SDK's default SwapService uses
 * subtractSplitAndEncrypt() to build operator packages client-side; this shim
 * mirrors that flow while delegating key-tweak package creation to Turnkey's
 * PREPARE_SPARK_TRANSFER activity.
 */

import { secp256k1 } from "@noble/curves/secp256k1";
import {
  getSigHashFromTx,
  getTxFromRawTxBytes,
  type SparkWallet,
} from "@buildonspark/spark-sdk";
import { v7 as uuidv7 } from "uuid";
import { turnkeyClaim } from "./turnkeyClaim";
import type { TurnkeySparkSigner } from "./turnkeySigner";
import {
  createSparkClient,
  fetchRefundCommitments,
  fromHex,
  getInternals,
  getOperatorRecipients,
  hex,
  type LeafSelection,
  type LeafTweak,
  makeLeafTweaks,
  makeTransferPackage,
  type OperatorSigningCommitment,
  type RefundSigningResult,
  signRefundsBatched,
  type TransferPackage,
  transferLeavesFromTweaks,
} from "./turnkeyInternal";

const MAX_BATCH_SIZE = 64;

interface RequestLeavesSwapParams {
  leaves: LeafSelection[];
  targetAmounts: number[];
  onSwapInitiated?: ((leafIds: string[]) => void | Promise<void>) | undefined;
}

interface SwapSspClient {
  requestLeavesSwap(params: {
    userLeaves: UserLeafInput[];
    adaptorPubkey: string;
    targetAmountSats: number[];
    totalAmountSats: number;
    feeSats: number;
    userOutboundTransferExternalId: string;
  }): Promise<LeavesSwapRequest | null>;
}

interface LeavesSwapRequest {
  status: string;
  swapLeaves?: unknown[];
  inboundTransfer?: { sparkId?: string };
}

interface UserLeafInput {
  leaf_id: string;
  raw_unsigned_refund_transaction: string;
  direct_raw_unsigned_refund_transaction: string;
  direct_from_cpfp_raw_unsigned_refund_transaction: string;
  adaptor_added_signature: string;
  direct_adaptor_added_signature: string;
  direct_from_cpfp_adaptor_added_signature: string;
}

export function installTurnkeySwapService(
  wallet: SparkWallet,
  signer: TurnkeySparkSigner,
): void {
  getInternals(wallet).leafManager.swapService = {
    requestLeavesSwap: (params) =>
      requestTurnkeyLeavesSwap(wallet, signer, params),
  };
}

async function requestTurnkeyLeavesSwap(
  wallet: SparkWallet,
  signer: TurnkeySparkSigner,
  params: RequestLeavesSwapParams,
): Promise<LeafSelection[]> {
  validateSwapInputs(params.leaves, params.targetAmounts);

  if (params.leaves.length <= MAX_BATCH_SIZE) {
    return executeSingleTurnkeySwap(wallet, signer, params);
  }

  const sortedLeaves = [...params.leaves].sort(
    (a, b) => Number(b.value) - Number(a.value),
  );
  const batches: LeafSelection[][] = [];
  for (let i = 0; i < sortedLeaves.length; i += MAX_BATCH_SIZE) {
    batches.push(sortedLeaves.slice(i, i + MAX_BATCH_SIZE));
  }

  const targetAmountsByBatch = distributeTargetAmounts(
    params.targetAmounts,
    batches,
  );
  const results: LeafSelection[] = [];

  for (let i = 0; i < batches.length; i++) {
    const leaves = batches[i];
    const targetAmounts = targetAmountsByBatch[i];
    if (!leaves || !targetAmounts || targetAmounts.length === 0) continue;

    const batchResult = await executeSingleTurnkeySwap(wallet, signer, {
      leaves,
      targetAmounts,
      onSwapInitiated: params.onSwapInitiated,
    });
    results.push(...batchResult);
  }

  return results;
}

async function executeSingleTurnkeySwap(
  wallet: SparkWallet,
  signer: TurnkeySparkSigner,
  { leaves, targetAmounts, onSwapInitiated }: RequestLeavesSwapParams,
): Promise<LeafSelection[]> {
  validateSwapInputs(leaves, targetAmounts);

  const internals = getInternals(wallet);
  const config = internals.config;
  const sspClient = internals.getSspClient() as SwapSspClient;

  const sspPubKeyHex = config.getSspIdentityPublicKey();
  const sspPubKey = fromHex(sspPubKeyHex);

  const leafTweaks = makeLeafTweaks(leaves, sspPubKey);
  const transferId = uuidv7();
  const adaptorPrivKey = secp256k1.utils.randomSecretKey();
  const adaptorPubkey = secp256k1.getPublicKey(adaptorPrivKey);

  const sparkClient = await createSparkClient(internals);

  const [cpfpC, directC, directFromCpfpC] = await fetchRefundCommitments(
    sparkClient,
    leaves.map((l) => l.id),
  );
  const { cpfpLeafSigningJobs } = await signRefundsBatched(
    internals,
    signer,
    leafTweaks,
    cpfpC,
    directC,
    directFromCpfpC,
    { kind: "transfer", adaptorPubKey: adaptorPubkey },
  );

  const turnkeyResult = await signer.prepareTransfer({
    transferId,
    leaves: transferLeavesFromTweaks(leafTweaks),
    threshold: config.getThreshold(),
    operatorRecipients: getOperatorRecipients(config),
    receiverPublicKey: sspPubKeyHex,
  });

  // The SDK leaves direct/directFromCpfp empty for swap-primary transfers.
  const swapJobs: RefundSigningResult = {
    cpfpLeafSigningJobs,
    directLeafSigningJobs: [],
    directFromCpfpLeafSigningJobs: [],
  };
  const transferPackage = makeTransferPackage(turnkeyResult, swapJobs);

  const response = await sparkClient.initiate_swap_primary_transfer({
    transfer: {
      transferId,
      ownerIdentityPublicKey: await signer.getIdentityPublicKey(),
      receiverIdentityPublicKey: sspPubKey,
      transferPackage,
    },
    adaptorPublicKeys: { adaptorPublicKey: adaptorPubkey },
  });

  if (!response.transfer) {
    throw new Error("No transfer response from initiate_swap_primary_transfer");
  }
  if ((response.transfer.leaves ?? []).some((leaf) => !leaf.leaf)) {
    throw new Error("Leaf is missing in swap transfer response");
  }

  const adaptorAddedSignatureMap = await aggregateAdaptorSignatures({
    signer,
    signingResults: response.signingResults,
    transferPackage,
    leaves: leafTweaks,
    adaptorPubkey,
  });

  await onSwapInitiated?.(leaves.map((leaf) => leaf.id));

  const userLeaves: UserLeafInput[] = [];
  for (const transferLeaf of response.transfer.leaves ?? []) {
    const leaf = transferLeaf.leaf;
    if (!leaf) throw new Error("Leaf is missing in swap transfer response");

    const adaptorAddedSignature = adaptorAddedSignatureMap.get(leaf.id);
    if (!adaptorAddedSignature) {
      throw new Error(`Adaptor added signature not found for leaf ${leaf.id}`);
    }

    userLeaves.push({
      leaf_id: leaf.id,
      raw_unsigned_refund_transaction: hex(transferLeaf.intermediateRefundTx),
      direct_raw_unsigned_refund_transaction: hex(
        transferLeaf.intermediateDirectRefundTx ?? new Uint8Array(),
      ),
      direct_from_cpfp_raw_unsigned_refund_transaction: hex(
        transferLeaf.intermediateDirectFromCpfpRefundTx ?? new Uint8Array(),
      ),
      adaptor_added_signature: hex(adaptorAddedSignature),
      direct_adaptor_added_signature: hex(adaptorAddedSignature),
      direct_from_cpfp_adaptor_added_signature: hex(adaptorAddedSignature),
    });
  }

  const request = await sspClient.requestLeavesSwap({
    userLeaves,
    adaptorPubkey: hex(adaptorPubkey),
    targetAmountSats: targetAmounts,
    totalAmountSats: leaves.reduce((acc, leaf) => acc + Number(leaf.value), 0),
    feeSats: 0,
    userOutboundTransferExternalId: response.transfer.id,
  });

  const inboundTransferId = request?.inboundTransfer?.sparkId;
  if (
    !request ||
    !request.swapLeaves ||
    request.swapLeaves.length === 0 ||
    request.status === "FAILED" ||
    !inboundTransferId
  ) {
    throw new Error("Failed to request leaves swap");
  }

  const incomingTransfer =
    await internals.transferService.queryTransfer(inboundTransferId);
  if (!incomingTransfer) {
    throw new Error(
      `Failed to query inbound swap transfer ${inboundTransferId}`,
    );
  }

  return (await turnkeyClaim(wallet, signer, incomingTransfer, {
    register: false,
  })) as unknown as LeafSelection[];
}

async function aggregateAdaptorSignatures(params: {
  signer: TurnkeySparkSigner;
  signingResults: OperatorSigningCommitment[];
  transferPackage: TransferPackage;
  leaves: LeafTweak[];
  adaptorPubkey: Uint8Array;
}): Promise<Map<string, Uint8Array>> {
  const adaptorAddedSignatureMap = new Map<string, Uint8Array>();

  for (const signingResult of params.signingResults) {
    if (!signingResult.leafId) continue;

    const leafJob = params.transferPackage.leavesToSend.find(
      (job) => job.leafId === signingResult.leafId,
    );
    const leafTweak = params.leaves.find(
      (leaf) => leaf.leaf.id === signingResult.leafId,
    );
    if (!leafJob || !leafTweak) {
      throw new Error(
        `Leaf not found for adaptor signature ${signingResult.leafId}`,
      );
    }
    if (!signingResult.verifyingKey) {
      throw new Error(
        `Missing verifying key for adaptor signature ${signingResult.leafId}`,
      );
    }

    const refundTx = getTxFromRawTxBytes(leafJob.rawTx);
    const nodeTx = getTxFromRawTxBytes(leafTweak.leaf.nodeTx);
    const nodeOutput = nodeTx.getOutput(0);
    if (!nodeOutput) {
      throw new Error(`Missing node output for leaf ${signingResult.leafId}`);
    }

    const message = getSigHashFromTx(refundTx, 0, nodeOutput);
    const adaptorAddedSignature = await params.signer.aggregateFrost({
      message,
      publicKey: leafJob.signingPublicKey,
      verifyingKey: signingResult.verifyingKey,
      selfCommitment: leafJob.selfCommitment,
      statechainCommitments:
        signingResult.refundTxSigningResult?.signingNonceCommitments,
      statechainSignatures:
        signingResult.refundTxSigningResult?.signatureShares,
      statechainPublicKeys: signingResult.refundTxSigningResult?.publicKeys,
      selfSignature: leafJob.userSignature,
      adaptorPubKey: params.adaptorPubkey,
    });

    adaptorAddedSignatureMap.set(signingResult.leafId, adaptorAddedSignature);
  }

  return adaptorAddedSignatureMap;
}

function distributeTargetAmounts(
  targetAmounts: number[],
  leafBatches: LeafSelection[][],
): number[][] {
  const targetAmountsByBatch: number[][] = leafBatches.map(() => []);
  const remainingBatchAmounts = leafBatches.map((batch) =>
    batch.reduce((acc, leaf) => acc + Number(leaf.value), 0),
  );
  const remainingTargets = [...targetAmounts].sort((a, b) => b - a);

  for (const target of remainingTargets) {
    let assigned = false;
    for (let i = 0; i < leafBatches.length; i++) {
      const remaining = remainingBatchAmounts[i];
      const targets = targetAmountsByBatch[i];
      if (remaining === undefined || targets === undefined) continue;
      if (remaining >= target) {
        targets.push(target);
        remainingBatchAmounts[i] = remaining - target;
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      throw new Error(
        `Target amount ${target} could not be assigned to a swap batch`,
      );
    }
  }

  return targetAmountsByBatch;
}

function validateSwapInputs(
  leaves: LeafSelection[],
  targetAmounts: number[],
): void {
  if (targetAmounts.length === 0) {
    throw new Error("Target amounts must be non-empty");
  }

  const totalTargetAmount = targetAmounts.reduce(
    (acc, amount) => acc + amount,
    0,
  );
  const totalLeavesValue = leaves.reduce(
    (acc, leaf) => acc + Number(leaf.value),
    0,
  );

  if (totalTargetAmount > totalLeavesValue) {
    throw new Error(
      `Total target amount ${totalTargetAmount} exceeds leaves value ${totalLeavesValue}`,
    );
  }
  if (targetAmounts.some((amount) => amount <= 0)) {
    throw new Error("Target amounts must be positive");
  }
  if (targetAmounts.some((amount) => !Number.isSafeInteger(amount))) {
    throw new Error("Target amounts must be safe integers");
  }
}
