/**
 * Turnkey-backed Spark leaf swap/change path.
 *
 * Spark SDK leaf selection swaps leaves when a requested transfer amount does
 * not exactly match existing wallet leaves. The SDK's default SwapService uses
 * subtractSplitAndEncrypt() to build operator packages client-side; this shim
 * mirrors that flow while delegating key-tweak package creation to Turnkey's
 * SPARK_PREPARE_AND_SIGN activity.
 */

import { secp256k1 } from "@noble/curves/secp256k1";
import {
  getSigHashFromTx,
  getTxFromRawTxBytes,
  type KeyDerivation,
  type NetworkType,
  type SigningCommitment,
  type SparkWallet,
} from "@buildonspark/spark-sdk";
import { v7 as uuidv7 } from "uuid";
import { turnkeyClaim } from "./turnkeyClaim";
import type {
  OperatorRecipientInput,
  TransferLeafInput,
  TurnkeySparkSigner,
} from "./turnkeySigner";

const MAX_BATCH_SIZE = 64;
const HASH_VARIANT_V2 = 1;

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function fromHex(h: string): Uint8Array {
  return Buffer.from(h.replace(/^0x/, ""), "hex");
}

function leafDerivation(path: string): KeyDerivation {
  return { type: "leaf", path } as unknown as KeyDerivation;
}

interface RequestLeavesSwapParams {
  leaves: LeafSelection[];
  targetAmounts: number[];
  onSwapInitiated?:
    | ((leafIds: string[]) => void | Promise<void>)
    | undefined;
}

interface SparkWalletInternals {
  transferService: {
    connectionManager: {
      createSparkClient(address: string): Promise<SparkGrpcClient>;
    };
    config: SparkConfig;
    signingService: SparkSigningService;
    queryTransfer(transferId: string): Promise<SparkTransfer | undefined>;
  };
  leafManager: {
    swapService: {
      requestLeavesSwap(params: RequestLeavesSwapParams): Promise<LeafSelection[]>;
    };
  };
  config: SparkConfig;
  getSspClient(): SspClient;
}

interface SparkConfig {
  getSigningOperators(): Record<
    string,
    { id: number; identifier: string; identityPublicKey: string }
  >;
  getThreshold(): number;
  getCoordinatorAddress(): string;
  getSspIdentityPublicKey(): string;
  getNetworkType(): NetworkType;
  signer: TurnkeySparkSigner;
}

interface SparkGrpcClient {
  get_signing_commitments(params: {
    nodeIds: string[];
    count: number;
  }): Promise<{ signingCommitments: OperatorSigningCommitment[] }>;
  initiate_swap_primary_transfer(params: {
    transfer: {
      transferId: string;
      ownerIdentityPublicKey: Uint8Array;
      receiverIdentityPublicKey: Uint8Array;
      transferPackage: TransferPackage;
    };
    adaptorPublicKeys: { adaptorPublicKey: Uint8Array };
  }): Promise<{
    transfer?: SparkTransfer;
    signingResults: OperatorSigningCommitment[];
  }>;
}

interface SspClient {
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

interface OperatorSigningCommitment {
  signingNonceCommitments?: Record<
    string,
    { hiding: Uint8Array; binding: Uint8Array }
  >;
  publicKeys?: Record<string, Uint8Array>;
  signatureShares?: Record<string, Uint8Array>;
  verifyingKey?: Uint8Array;
  leafId?: string;
  refundTxSigningResult?: {
    signingNonceCommitments?: Record<
      string,
      { hiding: Uint8Array; binding: Uint8Array }
    >;
    publicKeys?: Record<string, Uint8Array>;
    signatureShares?: Record<string, Uint8Array>;
  };
}

interface SparkSigningService {
  signRefunds(
    leaves: LeafTweak[],
    cpfpCommitments: OperatorSigningCommitment[],
    directCommitments: OperatorSigningCommitment[],
    directFromCpfpCommitments: OperatorSigningCommitment[],
    adaptorPubKey?: Uint8Array,
  ): Promise<{
    cpfpLeafSigningJobs: LeafSigningJob[];
    directLeafSigningJobs: LeafSigningJob[];
    directFromCpfpLeafSigningJobs: LeafSigningJob[];
  }>;
}

interface LeafSelection {
  id: string;
  nodeTx: Uint8Array;
  refundTx: Uint8Array;
  directTx: Uint8Array;
  value: number | bigint;
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

interface TransferPackage {
  leavesToSend: LeafSigningJob[];
  keyTweakPackage: Record<string, Uint8Array>;
  userSignature: Uint8Array;
  directLeavesToSend: LeafSigningJob[];
  directFromCpfpLeavesToSend: LeafSigningJob[];
  hashVariant?: number;
}

interface SparkTransfer {
  id: string;
  senderIdentityPublicKey: Uint8Array;
  leaves: Array<{
    leaf: LeafSelection;
    secretCipher: Uint8Array;
    signature: Uint8Array;
    intermediateRefundTx: Uint8Array;
    intermediateDirectRefundTx: Uint8Array;
    intermediateDirectFromCpfpRefundTx: Uint8Array;
  }>;
  [key: string]: unknown;
}

export function installTurnkeySwapService(
  wallet: SparkWallet,
  signer: TurnkeySparkSigner,
): void {
  const internals = wallet as unknown as SparkWalletInternals;

  internals.leafManager.swapService = {
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

  const internals = wallet as unknown as SparkWalletInternals;
  const config = internals.config;
  const transferService = internals.transferService;
  const signingService = transferService.signingService;
  const sspClient = internals.getSspClient();

  const sspPubKeyHex = config.getSspIdentityPublicKey();
  const sspPubKey = fromHex(sspPubKeyHex);

  const signingOperators = config.getSigningOperators();
  const threshold = config.getThreshold();
  const operatorRecipients: OperatorRecipientInput[] = Object.values(
    signingOperators,
  )
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((op) => ({
      operatorId: op.identifier,
      encryptionPublicKey: op.identityPublicKey,
    }));

  const leafTweaks: LeafTweak[] = leaves.map((leaf) => ({
    leaf,
    keyDerivation: leafDerivation(leaf.id),
    newKeyDerivation: leafDerivation(uuidv7()),
    receiverIdentityPublicKey: sspPubKey,
  }));

  const transferId = uuidv7();
  const adaptorPrivKey = secp256k1.utils.randomSecretKey();
  const adaptorPubkey = secp256k1.getPublicKey(adaptorPrivKey);

  const sparkClient =
    await transferService.connectionManager.createSparkClient(
      config.getCoordinatorAddress(),
    );

  const nodeIds = leaves.map((leaf) => leaf.id);
  const { signingCommitments } = await sparkClient.get_signing_commitments({
    nodeIds,
    count: 3,
  });

  const n = leaves.length;
  const { cpfpLeafSigningJobs } = await signingService.signRefunds(
    leafTweaks,
    signingCommitments.slice(0, n),
    signingCommitments.slice(n, 2 * n),
    signingCommitments.slice(2 * n, 3 * n),
    adaptorPubkey,
  );

  const transferLeaves: TransferLeafInput[] = leafTweaks.map((leaf) => ({
    leafId: leaf.leaf.id,
    oldLeafDerivation: leaf.keyDerivation,
    newLeafDerivation: leaf.newKeyDerivation,
  }));

  const turnkeyResult = await signer.prepareTransfer({
    signatures: [],
    transferId,
    leaves: transferLeaves,
    threshold,
    operatorRecipients,
    receiverPublicKey: sspPubKeyHex,
  });

  const keyTweakPackage: Record<string, Uint8Array> = {};
  for (const pkg of turnkeyResult.operatorPackages) {
    keyTweakPackage[pkg.operatorId] = fromHex(pkg.encryptedPackage);
  }

  const transferPackage: TransferPackage = {
    leavesToSend: cpfpLeafSigningJobs,
    keyTweakPackage,
    userSignature: fromHex(turnkeyResult.transferUserSignature),
    // The SDK leaves these empty for swap-primary transfers.
    directLeavesToSend: [],
    directFromCpfpLeavesToSend: [],
    hashVariant: HASH_VARIANT_V2,
  };

  const response = await sparkClient.initiate_swap_primary_transfer({
    transfer: {
      transferId,
      ownerIdentityPublicKey: await signer.getIdentityPublicKey(),
      receiverIdentityPublicKey: sspPubKey,
      transferPackage,
    },
    adaptorPublicKeys: {
      adaptorPublicKey: adaptorPubkey,
    },
  });

  if (!response.transfer) {
    throw new Error("No transfer response from initiate_swap_primary_transfer");
  }
  if (response.transfer.leaves.some((leaf) => !leaf.leaf)) {
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
  for (const transferLeaf of response.transfer.leaves) {
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

  const incomingTransfer = await transferService.queryTransfer(inboundTransferId);
  if (!incomingTransfer) {
    throw new Error(`Failed to query inbound swap transfer ${inboundTransferId}`);
  }

  return (await turnkeyClaim(wallet, signer, incomingTransfer as any, {
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
      throw new Error(`Leaf not found for adaptor signature ${signingResult.leafId}`);
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
      throw new Error(`Target amount ${target} could not be assigned to a swap batch`);
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

  const totalTargetAmount = targetAmounts.reduce((acc, amount) => acc + amount, 0);
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
