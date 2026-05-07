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
import {
  getTxFromRawTxHex,
  getTxId,
  type SparkWallet,
} from "@buildonspark/spark-sdk";
import type { TurnkeySparkSigner } from "./turnkeySigner";
import {
  type ConnectorOutput,
  createSparkClient,
  fetchRefundCommitments,
  fromHex,
  getInternals,
  getOperatorRecipients,
  type LeafSelection,
  makeLeafTweaks,
  makeTransferPackage,
  signRefundsBatched,
  transferLeavesFromTweaks,
} from "./turnkeyInternal";

interface WithdrawSspClient {
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

export interface CoopExitFeeQuote {
  id: string;
  l1BroadcastFeeFast?: { originalValue: number };
  l1BroadcastFeeMedium?: { originalValue: number };
  l1BroadcastFeeSlow?: { originalValue: number };
  userFeeFast?: { originalValue: number };
  userFeeMedium?: { originalValue: number };
  userFeeSlow?: { originalValue: number };
}

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

function feeFromQuote(
  quote: CoopExitFeeQuote,
  exitSpeed: WithdrawParams["exitSpeed"],
): number {
  switch (exitSpeed) {
    case "FAST":
      return (
        (quote.l1BroadcastFeeFast?.originalValue ?? 0) +
        (quote.userFeeFast?.originalValue ?? 0)
      );
    case "MEDIUM":
      return (
        (quote.l1BroadcastFeeMedium?.originalValue ?? 0) +
        (quote.userFeeMedium?.originalValue ?? 0)
      );
    case "SLOW":
      return (
        (quote.l1BroadcastFeeSlow?.originalValue ?? 0) +
        (quote.userFeeSlow?.originalValue ?? 0)
      );
  }
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
  const internals = getInternals(wallet);
  const config = internals.config;
  const sspClient = internals.getSspClient() as WithdrawSspClient;

  const sspPubKeyHex = config.getSspIdentityPublicKey();
  const sspPubKey = fromHex(sspPubKeyHex);

  const deductFee = params.deductFeeFromWithdrawalAmount ?? true;
  const feeAmountSats = params.feeQuote
    ? feeFromQuote(params.feeQuote, params.exitSpeed)
    : params.feeAmountSats;
  const feeQuoteId = params.feeQuote?.id ?? params.feeQuoteId;

  if (!feeAmountSats) throw new Error("No fee quote or fee amount provided");
  if (!feeQuoteId) throw new Error("No fee quote ID provided");

  const executeCoopExit = async (
    leavesToSendToSsp: LeafSelection[],
    leavesToSendToSE: LeafSelection[],
  ) => {
    const allLeaves = [...leavesToSendToSE, ...leavesToSendToSsp];
    const leafTweaks = makeLeafTweaks(allLeaves, sspPubKey);
    const transferId = uuidv7();

    // ── Step 1: Request coop exit from SSP ────────────────────────
    const coopExitRequest = await sspClient.requestCoopExit({
      leafExternalIds: leavesToSendToSsp.map((l) => l.id),
      withdrawalAddress: params.onchainAddress,
      exitSpeed: params.exitSpeed,
      withdrawAll: deductFee,
      userOutboundTransferExternalId: transferId,
      ...(deductFee
        ? {}
        : {
            feeQuoteId,
            feeLeafExternalIds: leavesToSendToSE.map((l) => l.id),
          }),
    });
    if (!coopExitRequest?.rawConnectorTransaction) {
      throw new Error("Failed to request coop exit");
    }

    const connectorTxBytes = fromHex(coopExitRequest.rawConnectorTransaction);
    const coopExitTxId = fromHex(coopExitRequest.coopExitTxid);

    // Parse connector outputs — one per leaf.
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
    // Batched: one SIGN_FROST_SPARK activity for all (leaf × direction)
    // tuples instead of the SDK's serial 3N round-trips.
    const sparkClient = await createSparkClient(internals);
    const [cpfpC, directC, directFromCpfpC] = await fetchRefundCommitments(
      sparkClient,
      allLeaves.map((l) => l.id),
    );
    const jobs = await signRefundsBatched(
      internals,
      signer,
      leafTweaks,
      cpfpC,
      directC,
      directFromCpfpC,
      { kind: "coopExit", connectorOutputs, connectorTx: connectorTxBytes },
    );

    // ── Step 3: Key tweaks via Turnkey enclave ────────────────────
    const turnkeyResult = await signer.prepareTransfer({
      transferId,
      leaves: transferLeavesFromTweaks(leafTweaks),
      threshold: config.getThreshold(),
      operatorRecipients: getOperatorRecipients(config),
      receiverPublicKey: sspPubKeyHex,
    });

    // ── Step 4: Assemble and send ─────────────────────────────────
    const isMainnet = config.getNetworkType() === "MAINNET";
    const expiryMs = isMainnet ? 10080 * 60 * 1000 + 300 * 1000 : 2100 * 1000;

    const response = await sparkClient.cooperative_exit_v2({
      transfer: {
        transferId,
        ownerIdentityPublicKey: await signer.getIdentityPublicKey(),
        receiverIdentityPublicKey: sspPubKey,
        transferPackage: makeTransferPackage(turnkeyResult, jobs),
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
        async (selected) => executeCoopExit(selected[0]!, []),
      );
    }
    return await internals.leafManager.executeWithAllLeaves(async (allLeaves) =>
      executeCoopExit(allLeaves, []),
    );
  }

  if (!params.amountSats) {
    throw new Error(
      "amountSats is required when deductFeeFromWithdrawalAmount is false",
    );
  }
  return await internals.leafManager.selectLeavesAndExecute(
    [params.amountSats, feeAmountSats],
    async (selected) => executeCoopExit(selected[0]!, selected[1]!),
  );
}
