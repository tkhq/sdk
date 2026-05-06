/**
 * Withdraw (cooperative exit) orchestration for the Turnkey Spark signer.
 *
 * The Spark SDK's built-in withdraw() calls prepareSendTransferKeyTweaks()
 * inside getConnectorRefundSignatures(), which calls subtractSplitAndEncrypt()
 * per-leaf. Turnkey's enclave does this atomically — raw shares never leave
 * the enclave boundary.
 *
 * This module replaces the key-tweak step with a single
 * PREPARE_SPARK_TRANSFER call, while reusing the SDK's SSP interaction,
 * refund signing, and leaf management.
 *
 * Usage:
 *   const result = await turnkeyWithdraw(wallet, signer, {
 *     onchainAddress: "bcrt1q...",
 *     amountSats: 25000,
 *     feeAmountSats: 500,
 *     feeQuoteId: "...",
 *     exitSpeed: "FAST",
 *   });
 */

import { v7 as uuidv7 } from "uuid";
import type {
  SparkWallet,
  KeyDerivation,
  NetworkType,
  SigningCommitment,
} from "@buildonspark/spark-sdk";
import { getTxFromRawTxHex, getTxId } from "@buildonspark/spark-sdk";
import type {
  TurnkeySparkSigner,
  TransferLeafInput,
  OperatorRecipientInput,
} from "./turnkeySigner";

function fromHex(h: string): Uint8Array {
  return Buffer.from(h.replace(/^0x/, ""), "hex");
}

function leafDerivation(path: string): KeyDerivation {
  return { type: "leaf", path } as unknown as KeyDerivation;
}

// ---------------------------------------------------------------------------
// SDK internal access helpers
// ---------------------------------------------------------------------------

interface SparkWalletInternals {
  coopExitService: {
    signingService: SparkSigningService;
    connectionManager: {
      createSparkClient(address: string): Promise<SparkGrpcClient>;
    };
    config: SparkConfig;
  };
  sspClient: SspClient | null;
  leafManager: {
    selectLeavesAndExecute<T>(
      amounts: number[],
      callback: (selected: LeafSelection[][]) => Promise<T>,
    ): Promise<T>;
    executeWithAllLeaves<T>(
      callback: (leaves: LeafSelection[]) => Promise<T>,
    ): Promise<T>;
    handleTransferEvent(transfer: SparkTransfer): Promise<void>;
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
  getNetworkType(): NetworkType;
  getNetwork(): string;
  getSspIdentityPublicKey(): string;
  signer: TurnkeySparkSigner;
}

interface SspClient {
  requestCoopExit(params: {
    leafExternalIds: string[];
    withdrawalAddress: string;
    exitSpeed: string;
    withdrawAll: boolean;
    userOutboundTransferExternalId: string;
    feeQuoteId?: string;
    feeLeafExternalIds?: string[];
  }): Promise<CoopExitRequest | null>;
  completeCoopExit(params: {
    userOutboundTransferExternalId: string;
  }): Promise<unknown>;
  getCoopExitFeeQuote(params: {
    leafExternalIds: string[];
    withdrawalAddress: string;
  }): Promise<CoopExitFeeQuote | null>;
}

interface CoopExitRequest {
  rawConnectorTransaction: string;
  coopExitTxid: string;
}

interface CoopExitFeeQuote {
  id: string;
  l1BroadcastFeeFast?: { originalValue: number };
  l1BroadcastFeeMedium?: { originalValue: number };
  l1BroadcastFeeSlow?: { originalValue: number };
  userFeeFast?: { originalValue: number };
  userFeeMedium?: { originalValue: number };
  userFeeSlow?: { originalValue: number };
}

interface SparkGrpcClient {
  get_signing_commitments(params: {
    nodeIds: string[];
    count: number;
  }): Promise<{ signingCommitments: OperatorSigningCommitment[] }>;
  cooperative_exit_v2(params: {
    transfer: {
      transferId: string;
      ownerIdentityPublicKey: Uint8Array;
      receiverIdentityPublicKey: Uint8Array;
      transferPackage: TransferPackage;
      expiryTime: Date;
    };
    exitId: string;
    exitTxid: Uint8Array;
    connectorTx: Uint8Array;
  }): Promise<{ transfer?: SparkTransfer }>;
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
  signRefundsForCoopExit(
    leaves: LeafTweak[],
    connectorOutputs: ConnectorOutput[],
    connectorTx: Uint8Array,
    cpfpCommitments: OperatorSigningCommitment[],
    directCommitments: OperatorSigningCommitment[],
    directFromCpfpCommitments: OperatorSigningCommitment[],
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
  value: bigint;
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

interface ConnectorOutput {
  txid: Uint8Array;
  index: number;
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
  [key: string]: unknown;
}

// HashVariant.HASH_VARIANT_V2 = 1
const HASH_VARIANT_V2 = 1;

export interface WithdrawParams {
  onchainAddress: string;
  /** Amount to withdraw. If omitted, withdraws all available balance. */
  amountSats?: number;
  exitSpeed: "FAST" | "MEDIUM" | "SLOW";
  /** Pre-fetched fee quote. If provided, feeAmountSats is derived from it. */
  feeQuote?: CoopExitFeeQuote;
  feeAmountSats?: number;
  feeQuoteId?: string;
  deductFeeFromWithdrawalAmount?: boolean;
}

/**
 * Execute a cooperative exit (withdraw) using Turnkey's enclave for key tweaks.
 *
 * Replaces wallet.withdraw() — the SDK's built-in path calls
 * subtractSplitAndEncrypt() which is incompatible with enclave-only signing.
 */
export async function turnkeyWithdraw(
  wallet: SparkWallet,
  signer: TurnkeySparkSigner,
  params: WithdrawParams,
): Promise<unknown> {
  const internals = wallet as unknown as SparkWalletInternals;
  const config = internals.config;
  const signingService = internals.coopExitService.signingService;
  const connectionManager = internals.coopExitService.connectionManager;
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

  // Resolve fee
  let { feeAmountSats, feeQuoteId } = params;
  const deductFee = params.deductFeeFromWithdrawalAmount ?? true;

  if (params.feeQuote) {
    switch (params.exitSpeed) {
      case "FAST":
        feeAmountSats =
          (params.feeQuote.l1BroadcastFeeFast?.originalValue ?? 0) +
          (params.feeQuote.userFeeFast?.originalValue ?? 0);
        break;
      case "MEDIUM":
        feeAmountSats =
          (params.feeQuote.l1BroadcastFeeMedium?.originalValue ?? 0) +
          (params.feeQuote.userFeeMedium?.originalValue ?? 0);
        break;
      case "SLOW":
        feeAmountSats =
          (params.feeQuote.l1BroadcastFeeSlow?.originalValue ?? 0) +
          (params.feeQuote.userFeeSlow?.originalValue ?? 0);
        break;
    }
    feeQuoteId = params.feeQuote.id;
  }

  if (!feeAmountSats) throw new Error("No fee quote or fee amount provided");
  if (!feeQuoteId) throw new Error("No fee quote ID provided");

  const finalFeeAmountSats = feeAmountSats;
  const finalFeeQuoteId = feeQuoteId;

  // ── Leaf selection + execute ───────────────────────────────────────
  const executeCoopExit = async (
    leavesToSendToSsp: LeafSelection[],
    leavesToSendToSE: LeafSelection[],
  ) => {
    const allLeaves = [...leavesToSendToSE, ...leavesToSendToSsp];
    const leafTweaks: LeafTweak[] = allLeaves.map((leaf) => ({
      leaf,
      keyDerivation: leafDerivation(leaf.id),
      newKeyDerivation: leafDerivation(uuidv7()),
      receiverIdentityPublicKey: sspPubKey,
    }));

    const transferId = uuidv7();

    // ── Step 1: Request coop exit from SSP ────────────────────────
    const requestParams: Parameters<typeof sspClient.requestCoopExit>[0] = {
      leafExternalIds: leavesToSendToSsp.map((l) => l.id),
      withdrawalAddress: params.onchainAddress,
      exitSpeed: params.exitSpeed,
      withdrawAll: deductFee,
      userOutboundTransferExternalId: transferId,
    };
    if (!deductFee) {
      requestParams.feeQuoteId = finalFeeQuoteId;
      requestParams.feeLeafExternalIds = leavesToSendToSE.map((l) => l.id);
    }

    const coopExitRequest = await sspClient.requestCoopExit(requestParams);
    if (!coopExitRequest?.rawConnectorTransaction) {
      throw new Error("Failed to request coop exit");
    }

    const connectorTxBytes = fromHex(coopExitRequest.rawConnectorTransaction);
    const coopExitTxId = fromHex(coopExitRequest.coopExitTxid);

    // Parse connector outputs — one per leaf (SDK uses getTxFromRawTxHex
    // internally; we build the output references directly)
    const connectorTxIdBytes = fromHex(
      coopExitRequest.rawConnectorTransaction.length > 0
        ? getTxId(getTxFromRawTxHex(coopExitRequest.rawConnectorTransaction))
        : "",
    );
    const connectorOutputs: ConnectorOutput[] = allLeaves.map((_, i) => ({
      txid: connectorTxIdBytes,
      index: i,
    }));

    // ── Step 2: Sign refund transactions ──────────────────────────
    const sparkClient = await connectionManager.createSparkClient(
      config.getCoordinatorAddress(),
    );
    const nodeIds = allLeaves.map((l) => l.id);
    const { signingCommitments } = await sparkClient.get_signing_commitments({
      nodeIds,
      count: 3,
    });

    const n = allLeaves.length;
    const {
      cpfpLeafSigningJobs,
      directLeafSigningJobs,
      directFromCpfpLeafSigningJobs,
    } = await signingService.signRefundsForCoopExit(
      leafTweaks,
      connectorOutputs,
      connectorTxBytes,
      signingCommitments.slice(0, n),
      signingCommitments.slice(n, 2 * n),
      signingCommitments.slice(2 * n, 3 * n),
    );

    // ── Step 3: Key tweaks via Turnkey enclave ────────────────────
    // Reuse the same new derivation that signRefundsForCoopExit used above.
    const transferLeaves: TransferLeafInput[] = leafTweaks.map((leaf) => ({
      leafId: leaf.leaf.id,
      oldLeafDerivation: leaf.keyDerivation,
      newLeafDerivation: leaf.newKeyDerivation,
    }));

    const turnkeyResult = await signer.prepareTransfer({
      transferId,
      leaves: transferLeaves,
      threshold,
      operatorRecipients,
      receiverPublicKey: sspPubKeyHex,
    });

    // ── Step 4: Assemble and send ─────────────────────────────────
    const keyTweakPackage: Record<string, Uint8Array> = {};
    for (const pkg of turnkeyResult.operatorPackages) {
      keyTweakPackage[pkg.operatorId] = fromHex(pkg.encryptedPackage);
    }

    const transferPackage: TransferPackage = {
      leavesToSend: cpfpLeafSigningJobs,
      keyTweakPackage,
      userSignature: fromHex(turnkeyResult.transferUserSignature),
      directLeavesToSend: directLeafSigningJobs,
      directFromCpfpLeavesToSend: directFromCpfpLeafSigningJobs,
      hashVariant: HASH_VARIANT_V2,
    };

    const ownerIdentityPublicKey = await signer.getIdentityPublicKey();

    const isMainnet = config.getNetwork() === "MAINNET";
    const expiryMs = isMainnet ? 10080 * 60 * 1000 + 300 * 1000 : 2100 * 1000;

    const response = await sparkClient.cooperative_exit_v2({
      transfer: {
        transferId,
        ownerIdentityPublicKey,
        receiverIdentityPublicKey: sspPubKey,
        transferPackage,
        expiryTime: new Date(Date.now() + expiryMs),
      },
      exitId: uuidv7(),
      exitTxid: coopExitTxId,
      connectorTx: connectorTxBytes,
    });

    if (!response.transfer) {
      throw new Error("Failed to initiate cooperative exit");
    }

    await internals.leafManager.handleTransferEvent(response.transfer);
    return await sspClient.completeCoopExit({
      userOutboundTransferExternalId: response.transfer.id,
    });
  };

  // ── Leaf selection ─────────────────────────────────────────────────
  if (deductFee) {
    if (params.amountSats) {
      return await internals.leafManager.selectLeavesAndExecute(
        [params.amountSats],
        async (selected) => {
          return await executeCoopExit(selected[0]!, []);
        },
      );
    } else {
      return await internals.leafManager.executeWithAllLeaves(
        async (allLeaves) => {
          return await executeCoopExit(allLeaves, []);
        },
      );
    }
  } else {
    if (!params.amountSats) {
      throw new Error(
        "amountSats is required when deductFeeFromWithdrawalAmount is false",
      );
    }
    return await internals.leafManager.selectLeavesAndExecute(
      [params.amountSats, finalFeeAmountSats],
      async (selected) => {
        return await executeCoopExit(selected[0]!, selected[1]!);
      },
    );
  }
}
