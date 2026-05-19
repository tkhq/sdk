/**
 * Withdraw (cooperative exit) orchestration for the Turnkey Spark signer.
 *
 * The Spark SDK's built-in withdraw() calls prepareSendTransferKeyTweaks()
 * inside getConnectorRefundSignatures(), which calls subtractSplitAndEncrypt()
 * per-leaf. Turnkey's enclave does this atomically — raw shares never leave
 * the enclave boundary.
 *
 * This module replaces the key-tweak step with a single
 * SPARK_PREPARE_TRANSFER call, while reusing the SDK's SSP interaction,
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
 *
 * ## Trust model
 *
 * Coop-exit is **SSP-trusted by protocol design**. The user submits
 * `params.onchainAddress` to the SSP and trusts the SSP to:
 *   1. Build a `rawConnectorTransaction` whose outputs route the user's
 *      leaves to the correct destination (this module signs refunds
 *      against those outputs without verifying their address)
 *   2. Broadcast a `coopExitTxid` whose L1 output pays to
 *      `params.onchainAddress` (this module never re-fetches and verifies
 *      the broadcast tx)
 *
 * If the SSP returns a malicious connector tx that routes leaves to an
 * attacker-controlled output, or broadcasts an L1 tx with a different
 * destination, the user can lose funds. This is fundamental to the Spark
 * coop-exit protocol; running your own broadcasting infrastructure would
 * be the only way to remove the SSP trust dependency.
 *
 * Operational mitigation: post-broadcast, the caller can independently
 * query L1 for `coopExitTxid` and verify the output paying to
 * `params.onchainAddress` matches the requested amount. The SDK doesn't
 * do this automatically.
 */

import { v7 as uuidv7 } from "uuid";
import {
  getTxFromRawTxHex,
  getTxId,
  type SparkWallet,
} from "@buildonspark/spark-sdk";
import type { TurnkeySparkSigner } from "../turnkeySigner";
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

/**
 * Spark protocol expiry for an in-flight cooperative-exit transfer.
 *
 * **Source of truth:** matches the SDK's coop-exit expiry constants — see
 * the constant definitions in @buildonspark/spark-sdk's coop-exit service.
 * Different windows for mainnet (7 days + 5 min buffer) vs other networks
 * (35 min) reflect the L1 confirmation latency the SSP needs.
 *
 * Re-validate against `@buildonspark/spark-sdk` whenever the pinned SDK
 * version is bumped. If they diverge, operators may reject the transfer
 * or accept it with subtly different semantics.
 */
const COOP_EXIT_EXPIRY_MS_MAINNET = 10080 * 60 * 1000 + 300 * 1000;
const COOP_EXIT_EXPIRY_MS_OTHER = 2100 * 1000;

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

    // Parse the connector tx once, derive both the raw bytes (for refund
    // signing) and the txid bytes (for connector output references).
    const connectorTx = getTxFromRawTxHex(coopExitRequest.rawConnectorTransaction);
    const connectorTxBytes = fromHex(coopExitRequest.rawConnectorTransaction);
    const connectorTxIdBytes = fromHex(getTxId(connectorTx));
    const coopExitTxId = fromHex(coopExitRequest.coopExitTxid);

    // Parse connector outputs — one per leaf.
    const connectorOutputs: ConnectorOutput[] = allLeaves.map((_, i) => ({
      txid: connectorTxIdBytes,
      index: i,
    }));

    // ── Step 2: Sign refund transactions ──────────────────────────
    // Batched: one SPARK_SIGN_FROST activity for all (leaf × direction)
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
    const expiryMs = isMainnet ? COOP_EXIT_EXPIRY_MS_MAINNET : COOP_EXIT_EXPIRY_MS_OTHER;

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
