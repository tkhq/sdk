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
import {
  type SparkWallet,
  decodeSparkAddress,
  type KeyDerivation,
  type NetworkType,
  type SigningCommitment,
} from "@buildonspark/spark-sdk";
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
//
// SparkWallet's transferService, signingService, leafManager, and config
// are private. We access them via type casting. This couples us to the
// SDK's internal structure — pin your @buildonspark/spark-sdk version.
// ---------------------------------------------------------------------------

interface SparkWalletInternals {
  transferService: {
    connectionManager: {
      createSparkClient(address: string): Promise<SparkGrpcClient>;
    };
    config: SparkConfig;
    signingService: SparkSigningService;
    prepareSendTransferKeyTweaks: unknown;
    prepareTransferPackage: unknown;
  };
  leafManager: {
    selectLeavesAndExecute<T>(
      amounts: number[],
      callback: (selected: LeafSelection[][]) => Promise<T>,
    ): Promise<T>;
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
    nodeIds: string[];
    count: number;
  }): Promise<{ signingCommitments: OperatorSigningCommitment[] }>;
  start_transfer_v3(params: {
    transferId: string;
    senderPackages: Array<{
      ownerIdentityPublicKey: Uint8Array;
      transferPackage: TransferPackage;
      receiverIdentityPublicKeys: Record<string, Uint8Array>;
    }>;
    expiryTime: undefined;
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
  const internals = wallet as unknown as SparkWalletInternals;
  const config = internals.config;
  const transferService = internals.transferService;
  const signingService = transferService.signingService;

  const receiverAddress = decodeSparkAddress(
    params.receiverSparkAddress,
    config.getNetworkType(),
  );
  const receiverPubkeyHex = receiverAddress.identityPublicKey;
  const receiverPubkeyBytes = fromHex(receiverPubkeyHex);

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

  return await internals.leafManager.selectLeavesAndExecute(
    [params.amountSats],
    async (selected) => {
      const leaves = selected[0]!;
      const transferId = uuidv7();

      // Build leaf tweaks (same shape as SDK's toSendTweak). The same
      // newKeyDerivation must be used for refund signing and for the
      // Turnkey key-tweak package; otherwise the receiver later claims
      // with a key that Spark operators did not actually rotate to.
      const leafTweaks: LeafTweak[] = leaves.map((leaf) => ({
        leaf,
        keyDerivation: leafDerivation(leaf.id),
        newKeyDerivation: leafDerivation(uuidv7()),
        receiverIdentityPublicKey: receiverPubkeyBytes,
      }));

      // ── Phase 1: Sign refund transactions ──────────────────────────
      // Get 3N signing commitments from operator (CPFP, direct, directFromCPFP)
      const nodeIds = leaves.map((l) => l.id);
      const sparkClient =
        await transferService.connectionManager.createSparkClient(
          config.getCoordinatorAddress(),
        );
      const { signingCommitments } = await sparkClient.get_signing_commitments({
        nodeIds,
        count: 3,
      });

      const n = leaves.length;
      const {
        cpfpLeafSigningJobs,
        directLeafSigningJobs,
        directFromCpfpLeafSigningJobs,
      } = await signingService.signRefunds(
        leafTweaks,
        signingCommitments.slice(0, n),
        signingCommitments.slice(n, 2 * n),
        signingCommitments.slice(2 * n, 3 * n),
      );

      // ── Phase 2: Key tweaks via Turnkey enclave ────────────────────
      // The enclave atomically:
      //   - derives old/new leaf keys
      //   - computes tweak = old - new (mod n)
      //   - Feldman-splits the tweak across operators
      //   - ECIES-encrypts per-leaf data to each operator
      //   - signs the transfer package payload (ECDSA-DER)
      //
      // For the basic transfer flow, the new leaf derivation uses a
      // new SIGNING_HD key with a fresh leaf_id. The SDK uses RANDOM,
      // but Turnkey uses deterministic HD derivation for reproducibility.
      const transferLeaves: TransferLeafInput[] = leafTweaks.map((leaf) => ({
        leafId: leaf.leaf.id,
        oldLeafDerivation: leaf.keyDerivation,
        newLeafDerivation: leaf.newKeyDerivation,
      }));

      // prepareTransfer (PREPARE_SPARK_TRANSFER) returns encrypted operator
      // packages + DER user signature. Refund FROST signing already happened
      // in phase 1 via signFrost (SIGN_FROST_SPARK).
      const turnkeyResult = await signer.prepareTransfer({
        transferId,
        leaves: transferLeaves,
        threshold,
        operatorRecipients,
        receiverPublicKey: receiverPubkeyHex,
      });

      // ── Phase 3: Assemble and send ─────────────────────────────────
      // Map Turnkey's operator packages to SDK's keyTweakPackage format
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

      const receiverIdentityPublicKeys: Record<string, Uint8Array> = {};
      for (const leaf of leaves) {
        receiverIdentityPublicKeys[leaf.id] = receiverPubkeyBytes;
      }

      const ownerIdentityPublicKey = await signer.getIdentityPublicKey();

      const response = await sparkClient.start_transfer_v3({
        transferId,
        senderPackages: [
          {
            ownerIdentityPublicKey,
            transferPackage,
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
