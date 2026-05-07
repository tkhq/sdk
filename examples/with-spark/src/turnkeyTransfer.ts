/**
 * Transfer orchestration for the Turnkey Spark signer.
 *
 * The Spark SDK's built-in wallet.transfer() calls subtractSplitAndEncrypt()
 * per-leaf and immediately consumes raw Feldman shares to build per-operator
 * packages client-side. Turnkey's enclave does this atomically — raw shares
 * never leave the enclave boundary.
 *
 * This module replaces the key-tweak + ECIES encryption step with a single
 * PREPARE_SPARK_TRANSFER call, while reusing the SDK's refund signing and
 * operator communication infrastructure.
 *
 * Usage:
 *   const result = await turnkeyTransfer(wallet, signer, {
 *     amountSats: 50000,
 *     receiverSparkAddress: "sp1...",
 *   });
 */

import { v7 as uuidv7 } from "uuid";
import { type SparkWallet, decodeSparkAddress } from "@buildonspark/spark-sdk";
import type { TurnkeySparkSigner } from "./turnkeySigner";
import {
  createSparkClient,
  fetchRefundCommitments,
  fromHex,
  getInternals,
  getOperatorRecipients,
  makeLeafTweaks,
  makeTransferPackage,
  signRefundsBatched,
  type SparkTransfer,
  transferLeavesFromTweaks,
} from "./turnkeyInternal";

/**
 * Execute a Spark transfer using Turnkey's enclave for key tweaks.
 *
 * Replaces wallet.transfer() — the SDK's built-in path calls
 * subtractSplitAndEncrypt() which is incompatible with enclave-only signing.
 */
export async function turnkeyTransfer(
  wallet: SparkWallet,
  signer: TurnkeySparkSigner,
  params: {
    amountSats: number;
    receiverSparkAddress: string;
  },
): Promise<SparkTransfer> {
  const internals = getInternals(wallet);
  const config = internals.config;

  const receiverPubkeyHex = decodeSparkAddress(
    params.receiverSparkAddress,
    config.getNetworkType(),
  ).identityPublicKey;
  const receiverPubkeyBytes = fromHex(receiverPubkeyHex);

  return await internals.leafManager.selectLeavesAndExecute(
    [params.amountSats],
    async (selected) => {
      const leaves = selected[0]!;
      const transferId = uuidv7();

      // The same newKeyDerivation must be used for refund signing and for the
      // Turnkey key-tweak package; otherwise the receiver later claims with a
      // key that Spark operators did not actually rotate to.
      const leafTweaks = makeLeafTweaks(leaves, receiverPubkeyBytes);

      // ── Phase 1: Sign refund transactions ──────────────────────────
      // Batched: one SIGN_FROST_SPARK activity for all (leaf × direction)
      // tuples instead of the SDK's serial 3N round-trips.
      const sparkClient = await createSparkClient(internals);
      const [cpfpC, directC, directFromCpfpC] = await fetchRefundCommitments(
        sparkClient,
        leaves.map((l) => l.id),
      );
      const jobs = await signRefundsBatched(
        internals,
        signer,
        leafTweaks,
        cpfpC,
        directC,
        directFromCpfpC,
        { kind: "transfer" },
      );

      // ── Phase 2: Key tweaks via Turnkey enclave ────────────────────
      // The enclave atomically: derives old/new leaf keys, computes tweak,
      // Feldman-splits across operators, ECIES-encrypts per-leaf data, and
      // signs the transfer package payload (ECDSA-DER). Refund FROST signing
      // already happened in phase 1 via SIGN_FROST_SPARK.
      const turnkeyResult = await signer.prepareTransfer({
        transferId,
        leaves: transferLeavesFromTweaks(leafTweaks),
        threshold: config.getThreshold(),
        operatorRecipients: getOperatorRecipients(config),
        receiverPublicKey: receiverPubkeyHex,
      });

      // ── Phase 3: Assemble and send ─────────────────────────────────
      const receiverIdentityPublicKeys: Record<string, Uint8Array> = {};
      for (const leaf of leaves) {
        receiverIdentityPublicKeys[leaf.id] = receiverPubkeyBytes;
      }

      const response = await sparkClient.start_transfer_v3({
        transferId,
        senderPackages: [
          {
            ownerIdentityPublicKey: await signer.getIdentityPublicKey(),
            transferPackage: makeTransferPackage(turnkeyResult, jobs),
            receiverIdentityPublicKeys,
          },
        ],
        expiryTime: undefined,
      });

      if (!response.transfer) {
        throw new Error("No transfer response from operator");
      }

      await internals.leafManager.handleTransferEvent(response.transfer);
      return response.transfer;
    },
  );
}
