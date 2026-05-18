/**
 * Shared helpers and SDK-internal type shims for the turnkey* orchestration
 * modules.
 *
 * The turnkey{Transfer,Claim,Lightning,Swap,Withdraw} flows all reach into
 * SparkWallet's private surface (transferService, leafManager, signingService,
 * config, gRPC client). We declare the shapes once here and reuse them — the
 * coupling to the SDK's internals is real, so make it explicit. Pin
 * @buildonspark/spark-sdk and update this file when the SDK changes.
 */

import { v7 as uuidv7 } from "uuid";
import {
  createConnectorRefundTxs,
  createCurrentTimelockRefundTxs,
  createDecrementedTimelockRefundTxs,
  getCurrentTimelock,
  getNetwork,
  getNextHTLCTransactionSequence,
  getSigHashFromMultiInputTx,
  getSigHashFromTx,
  getTxFromRawTxBytes,
  type KeyDerivation,
  type Network,
  type NetworkType,
  type SignFrostParams,
  type SigningCommitment,
  SparkValidationError,
  type SparkWallet,
} from "@buildonspark/spark-sdk";
import { createRefundTxsForLightning } from "./htlc-transactions";
import type {
  OperatorRecipientInput,
  TransferLeafInput,
  TransferResult,
  TurnkeySparkSigner,
} from "../turnkeySigner";

// HashVariant.HASH_VARIANT_V2 = 1 (proto-defined)
export const HASH_VARIANT_V2 = 1;

export function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

export function fromHex(h: string): Uint8Array {
  return Buffer.from(h.replace(/^0x/, ""), "hex");
}

export function leafDerivation(path: string): KeyDerivation {
  return { type: "leaf", path } as unknown as KeyDerivation;
}

// ---------------------------------------------------------------------------
// SDK internal type shims
// ---------------------------------------------------------------------------

export interface SparkConfig {
  getSigningOperators(): Record<
    string,
    { id: number; identifier: string; identityPublicKey: string }
  >;
  getThreshold(): number;
  getCoordinatorAddress(): string;
  getNetworkType(): NetworkType;
  getNetwork(): Network;
  getSspIdentityPublicKey(): string;
  signer: TurnkeySparkSigner;
}

export interface OperatorSigningCommitment {
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

export interface LeafSelection {
  id: string;
  nodeTx: Uint8Array;
  refundTx: Uint8Array;
  directTx: Uint8Array;
  directRefundTx?: Uint8Array;
  directFromCpfpRefundTx?: Uint8Array;
  verifyingPublicKey: Uint8Array;
  value: number | bigint;
  status?: string;
  [key: string]: unknown;
}

/**
 * A leaf paired with the key-derivation metadata needed to build refund
 * transactions and FROST sign them.
 *
 * The two optional pubkey fields are populated differently per flow:
 *   - SEND / SWAP / EXIT / LIGHTNING: receiverIdentityPublicKey is set
 *     (recipient's pubkey, used in HTLC scripts and refund outputs);
 *     signingPublicKey is left unset and signRefundsBatched resolves it from
 *     the signer using the current leaf id.
 *   - CLAIM: both fields are set to the freshly HD-derived pubkey for the
 *     rotated leaf id — the receiver is signing with their own new key.
 */
export interface LeafTweak {
  leaf: LeafSelection;
  keyDerivation: KeyDerivation;
  newKeyDerivation: KeyDerivation;
  signingPublicKey?: Uint8Array;
  receiverIdentityPublicKey?: Uint8Array;
}

export interface LeafSigningJob {
  leafId: string;
  rawTx: Uint8Array;
  selfCommitment: { commitment: SigningCommitment };
  signingPublicKey: Uint8Array;
  userSignature: Uint8Array;
  [key: string]: unknown;
}

export interface RefundSigningResult {
  cpfpLeafSigningJobs: LeafSigningJob[];
  directLeafSigningJobs: LeafSigningJob[];
  directFromCpfpLeafSigningJobs: LeafSigningJob[];
}

export interface TransferPackage {
  leavesToSend: LeafSigningJob[];
  keyTweakPackage: Record<string, Uint8Array>;
  userSignature: Uint8Array;
  directLeavesToSend: LeafSigningJob[];
  directFromCpfpLeavesToSend: LeafSigningJob[];
  hashVariant?: number;
}

export interface ConnectorOutput {
  txid: Uint8Array;
  index: number;
}

export interface TransferLeafData {
  leaf: LeafSelection;
  secretCipher: Uint8Array;
  signature: Uint8Array;
  intermediateRefundTx: Uint8Array;
  intermediateDirectRefundTx: Uint8Array;
  intermediateDirectFromCpfpRefundTx: Uint8Array;
}

export interface SparkTransfer {
  id: string;
  senderIdentityPublicKey?: Uint8Array;
  leaves?: TransferLeafData[];
  status?: string | number;
  [key: string]: unknown;
}

export interface WalletLeaf {
  id: string;
  status: string;
  [key: string]: unknown;
}

export interface SparkGrpcClient {
  get_signing_commitments(params: {
    nodeIds?: string[];
    nodeIdCount?: number;
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
  claim_transfer(params: {
    transferId: string;
    ownerIdentityPublicKey: Uint8Array;
    claimPackage: ClaimPackage;
  }): Promise<{ transfer?: SparkTransfer }>;
  store_preimage_share_v2(params: {
    paymentHash: Uint8Array;
    encryptedPreimageShares: Record<string, Uint8Array>;
    threshold: number;
    invoiceString: string;
    userIdentityPublicKey: Uint8Array;
  }): Promise<unknown>;
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

export interface ClaimPackage {
  leavesToClaim: LeafSigningJob[];
  keyTweakPackage: Record<string, Uint8Array>;
  userSignature: Uint8Array;
  directLeavesToClaim: LeafSigningJob[];
  directFromCpfpLeavesToClaim: LeafSigningJob[];
  hashVariant?: number;
}

export interface SparkSigningService {
  signRefunds(
    leaves: LeafTweak[],
    cpfpCommitments: OperatorSigningCommitment[],
    directCommitments: OperatorSigningCommitment[],
    directFromCpfpCommitments: OperatorSigningCommitment[],
    adaptorPubKey?: Uint8Array,
  ): Promise<RefundSigningResult>;
  signRefundsForClaim(
    leaves: LeafTweak[],
    cpfpCommitments: OperatorSigningCommitment[],
    directCommitments: OperatorSigningCommitment[],
    directFromCpfpCommitments: OperatorSigningCommitment[],
  ): Promise<RefundSigningResult>;
  signRefundsForLightning(
    leaves: LeafTweak[],
    cpfpCommitments: OperatorSigningCommitment[],
    directCommitments: OperatorSigningCommitment[],
    directFromCpfpCommitments: OperatorSigningCommitment[],
    paymentHash: Uint8Array,
  ): Promise<RefundSigningResult>;
  signRefundsForCoopExit(
    leaves: LeafTweak[],
    connectorOutputs: ConnectorOutput[],
    connectorTx: Uint8Array,
    cpfpCommitments: OperatorSigningCommitment[],
    directCommitments: OperatorSigningCommitment[],
    directFromCpfpCommitments: OperatorSigningCommitment[],
  ): Promise<RefundSigningResult>;
}

export interface SwapService {
  requestLeavesSwap(params: {
    leaves: LeafSelection[];
    targetAmounts: number[];
    onSwapInitiated?: ((leafIds: string[]) => void | Promise<void>) | undefined;
  }): Promise<LeafSelection[]>;
}

export interface SparkWalletInternals {
  transferService: {
    connectionManager: {
      createSparkClient(address: string): Promise<SparkGrpcClient>;
    };
    config: SparkConfig;
    signingService: SparkSigningService;
    queryTransfer(transferId: string): Promise<SparkTransfer | undefined>;
    queryPendingTransfers(transferIds?: string[]): Promise<{
      transfers: SparkTransfer[];
    }>;
  };
  coopExitService: {
    signingService: SparkSigningService;
    connectionManager: {
      createSparkClient(address: string): Promise<SparkGrpcClient>;
    };
    config: SparkConfig;
  };
  lightningService: {
    swapNodesForPreimage(params: {
      leaves: LeafTweak[];
      receiverIdentityPubkey: Uint8Array;
      paymentHash: Uint8Array;
      isInboundPayment: boolean;
      invoiceString?: string;
      feeSats?: number;
      amountSatsToSend?: number;
      startTransferRequest?: unknown;
      expiryTime?: Date;
      transferID?: string;
      idempotencyKey?: string;
    }): Promise<{ transfer?: SparkTransfer }>;
  };
  leafManager: {
    selectLeavesAndExecute<T>(
      amounts: number[],
      callback: (selected: LeafSelection[][]) => Promise<T>,
    ): Promise<T>;
    executeWithAllLeaves<T>(
      callback: (leaves: LeafSelection[]) => Promise<T>,
    ): Promise<T>;
    handleTransferEvent(transfer: SparkTransfer): Promise<void>;
    registerClaimedLeaves(
      leaves: WalletLeaf[],
      transferId?: string,
    ): Promise<WalletLeaf[]>;
    swapService: SwapService;
  };
  config: SparkConfig;
  getSspClient(): unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getInternals(wallet: SparkWallet): SparkWalletInternals {
  return wallet as unknown as SparkWalletInternals;
}

export async function createSparkClient(
  internals: SparkWalletInternals,
): Promise<SparkGrpcClient> {
  return internals.transferService.connectionManager.createSparkClient(
    internals.config.getCoordinatorAddress(),
  );
}

/**
 * Build the operator-recipients list for transfer/claim/swap/withdraw/lightning
 * package construction.
 *
 * The numeric-id sort is load-bearing — the signer assigns Feldman polynomial
 * evaluation points by *array position*, so position-N must hold operator-with-id-N
 * for every operator to reconstruct its share at the expected x-coordinate.
 * Pre-sort, `Object.values()` insertion order would scramble the assignment and
 * operators couldn't reconstruct. See commit 558d66361 for the original incident.
 */
export function getOperatorRecipients(
  config: SparkConfig,
): OperatorRecipientInput[] {
  return Object.values(config.getSigningOperators())
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((op) => ({
      operatorId: op.identifier,
      encryptionPublicKey: op.identityPublicKey,
    }));
}

export function mapKeyTweakPackage(
  operatorPackages: Array<{ operatorId: string; encryptedPackage: string }>,
): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  for (const pkg of operatorPackages) {
    out[pkg.operatorId] = fromHex(pkg.encryptedPackage);
  }
  return out;
}

/** Builds leaf tweaks with fresh deterministic uuidv7 leaf ids for the new key derivation. */
export function makeLeafTweaks(
  leaves: LeafSelection[],
  receiverIdentityPublicKey: Uint8Array,
): LeafTweak[] {
  return leaves.map((leaf) => ({
    leaf,
    keyDerivation: leafDerivation(leaf.id),
    newKeyDerivation: leafDerivation(uuidv7()),
    receiverIdentityPublicKey,
  }));
}

export function transferLeavesFromTweaks(
  tweaks: LeafTweak[],
): TransferLeafInput[] {
  return tweaks.map((leaf) => ({
    leafId: leaf.leaf.id,
    oldLeafDerivation: leaf.keyDerivation,
    newLeafDerivation: leaf.newKeyDerivation,
  }));
}

/**
 * Fetch 3N signing commitments from the coordinator and split them into
 * (cpfp, direct, directFromCpfp) groups. Pass `nodeIds` for transfer/swap/
 * withdraw/lightning flows (commitments tied to specific nodes) or a number
 * for the claim flow (fresh commitments not tied to any node).
 */
export async function fetchRefundCommitments(
  sparkClient: SparkGrpcClient,
  nodeIdsOrCount: string[] | number,
): Promise<
  [
    OperatorSigningCommitment[],
    OperatorSigningCommitment[],
    OperatorSigningCommitment[],
  ]
> {
  const params =
    typeof nodeIdsOrCount === "number"
      ? { nodeIdCount: nodeIdsOrCount, count: 3 }
      : { nodeIds: nodeIdsOrCount, count: 3 };
  const { signingCommitments } =
    await sparkClient.get_signing_commitments(params);
  const n =
    typeof nodeIdsOrCount === "number"
      ? nodeIdsOrCount
      : nodeIdsOrCount.length;
  return [
    signingCommitments.slice(0, n),
    signingCommitments.slice(n, 2 * n),
    signingCommitments.slice(2 * n, 3 * n),
  ];
}

/** Assemble a TransferPackage from a Turnkey enclave result + signed refund jobs. */
export function makeTransferPackage(
  turnkeyResult: TransferResult,
  jobs: RefundSigningResult,
): TransferPackage {
  return {
    leavesToSend: jobs.cpfpLeafSigningJobs,
    keyTweakPackage: mapKeyTweakPackage(turnkeyResult.operatorPackages),
    userSignature: fromHex(turnkeyResult.transferUserSignature),
    directLeavesToSend: jobs.directLeafSigningJobs,
    directFromCpfpLeavesToSend: jobs.directFromCpfpLeafSigningJobs,
    hashVariant: HASH_VARIANT_V2,
  };
}

// ---------------------------------------------------------------------------
// Batched refund signing
//
// Replacement for SparkSigningService.signRefunds*(...). The SDK's signing
// service runs a serial for-loop over leaves and calls signFrost once per
// (leaf, direction) tuple — N leaves × up to 3 directions = up to 3N Turnkey
// activities per flow. We collapse that to ONE batched SPARK_SIGN_FROST call
// while preserving the exact per-leaf tx-creation and sighash logic.
// ---------------------------------------------------------------------------

/** Mode discriminator for signRefundsBatched. */
export type RefundMode =
  /** Outbound transfer / swap. Uses createDecrementedTimelockRefundTxs. */
  | { kind: "transfer"; adaptorPubKey?: Uint8Array }
  /** Inbound claim. Uses createCurrentTimelockRefundTxs. */
  | { kind: "claim" }
  /** Cooperative exit. Uses createConnectorRefundTxs + multi-input sighash. */
  | {
      kind: "coopExit";
      connectorOutputs: ConnectorOutput[];
      connectorTx: Uint8Array;
    }
  /**
   * Outbound Lightning send. Uses createRefundTxsForLightning, which builds
   * HTLC TXs spending the leaf node TX into a Taproot output committed to
   * (paymentHash, receiver_pubkey)/sequence-locked back to sender.
   */
  | {
      kind: "lightning";
      paymentHash: Uint8Array;
      sequenceLockDestinationPubkey: Uint8Array;
    };

interface PendingFrost {
  direction: "cpfp" | "direct" | "directFromCpfp";
  leafIdx: number;
  rawTx: Uint8Array;
  signingPublicKey: Uint8Array;
  selfCommitment: { commitment: SigningCommitment };
  statechainCommitments: { [key: string]: SigningCommitment };
  message: Uint8Array;
}

async function resolveLeafSigningPublicKey(
  signer: TurnkeySparkSigner,
  leaf: LeafTweak,
): Promise<Uint8Array> {
  if (leaf.signingPublicKey && leaf.signingPublicKey.length > 0) {
    return leaf.signingPublicKey;
  }

  if (leaf.keyDerivation.type !== "leaf") {
    throw new SparkValidationError("Leaf signing requires leaf key derivation", {
      field: "keyDerivation",
      value: leaf.keyDerivation,
      expected: "leaf key derivation",
    });
  }

  return signer.getLeafSigningKey(String(leaf.keyDerivation.path));
}

function emptyCommitment(): { commitment: SigningCommitment } {
  return {
    commitment: {
      hiding: new Uint8Array(33),
      binding: new Uint8Array(33),
    },
  };
}

/**
 * Assert that an operator-commitment entry exists and is non-empty before
 * we forward it into a FROST signing request. Without this, a missing
 * commitment silently becomes `{}` and the wasted Turnkey round-trip only
 * surfaces the failure inside the enclave (`operator_commitments must
 * include at least one operator commitment`). The likely root cause when
 * this throws is `fetchRefundCommitments` returning fewer entries than
 * expected — check the coordinator response.
 */
function requireOperatorCommitments(
  commitment: OperatorSigningCommitment | undefined,
  leafId: string,
  direction: "cpfp" | "direct" | "directFromCpfp",
): { [key: string]: SigningCommitment } {
  const ops = commitment?.signingNonceCommitments;
  if (!ops || Object.keys(ops).length === 0) {
    throw new SparkValidationError(
      `Missing ${direction} operator commitments for leaf ${leafId}`,
      {
        field: "operatorCommitments",
        value: ops,
        expected: "non-empty signingNonceCommitments map",
      },
    );
  }
  return ops;
}

export async function signRefundsBatched(
  internals: SparkWalletInternals,
  signer: TurnkeySparkSigner,
  leaves: LeafTweak[],
  cpfpCommitments: OperatorSigningCommitment[],
  directCommitments: OperatorSigningCommitment[],
  directFromCpfpCommitments: OperatorSigningCommitment[],
  mode: RefundMode,
): Promise<RefundSigningResult> {
  if (leaves.length === 0) {
    return {
      cpfpLeafSigningJobs: [],
      directLeafSigningJobs: [],
      directFromCpfpLeafSigningJobs: [],
    };
  }

  // When a caller intends to use adaptor signing (swap path), the pubkey
  // must be a 33-byte compressed secp256k1 point. SPARK_SIGN_FROST silently
  // accepts a malformed/empty adaptor field and produces a non-adaptor
  // signature share; the aggregate signature is only rejected later by
  // initiate_swap_primary_transfer with "calculated R y-value is odd". The
  // plain-transfer path leaves adaptorPubKey undefined and is fine.
  if (
    mode.kind === "transfer" &&
    mode.adaptorPubKey !== undefined &&
    mode.adaptorPubKey.length !== 33
  ) {
    throw new Error(
      `signRefundsBatched: adaptorPubKey must be a 33-byte compressed ` +
        `secp256k1 point when provided (got length=${mode.adaptorPubKey.length}). ` +
        `Pass undefined for plain (non-swap) transfers, or a valid 33-byte ` +
        `compressed pubkey for the swap path.`,
    );
  }

  const network = internals.config.getNetwork();
  const connectorTxParsed =
    mode.kind === "coopExit" ? getTxFromRawTxBytes(mode.connectorTx) : undefined;

  const pending: PendingFrost[] = [];

  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i]!;
    if (!leaf.leaf) {
      throw new SparkValidationError("Leaf not found in signRefundsBatched", {
        field: "leaf",
        value: leaf,
        expected: "Non-null leaf",
      });
    }

    const nodeTx = getTxFromRawTxBytes(leaf.leaf.nodeTx);
    const nodeOutput = nodeTx.getOutput(0);
    const currRefundTx = getTxFromRawTxBytes(leaf.leaf.refundTx);
    const currentSequence = currRefundTx.getInput(0).sequence;
    if (currentSequence == null) {
      throw new SparkValidationError("Invalid refund transaction", {
        field: "sequence",
        value: currRefundTx.getInput(0),
        expected: "Non-null sequence",
      });
    }

    const isZeroNode = !getCurrentTimelock(nodeTx.getInput(0).sequence);
    const signingPublicKey = await resolveLeafSigningPublicKey(signer, leaf);
    const receivingPubkey =
      leaf.receiverIdentityPublicKey ?? signingPublicKey;

    // signRefundsForCoopExit additionally gates directNodeTx on !isZeroNode;
    // signRefundsCore (transfer/claim) builds it whenever directTx is present
    // and only checks isZeroNode at the signing branch. Either way the signing
    // branch below uses the same condition, so the difference is academic.
    const directNodeTx =
      leaf.leaf.directTx.length > 0 ? getTxFromRawTxBytes(leaf.leaf.directTx) : undefined;

    let refundTxs;
    if (mode.kind === "coopExit") {
      const connectorOutput = mode.connectorOutputs[i];
      if (!connectorOutput || connectorOutput.index === undefined) {
        throw new SparkValidationError("Missing connector output", {
          field: "connectorOutput",
          value: connectorOutput,
          expected: "Valid connector output with index",
        });
      }
      const effectiveDirectNodeTx = isZeroNode ? undefined : directNodeTx;
      refundTxs = await createConnectorRefundTxs({
        nodeTx,
        ...(effectiveDirectNodeTx ? { directNodeTx: effectiveDirectNodeTx } : {}),
        sequence: currentSequence,
        connectorOutput: { txid: connectorOutput.txid, index: connectorOutput.index } as Parameters<
          typeof createConnectorRefundTxs
        >[0]["connectorOutput"],
        receivingPubkey,
        network,
      });
    } else if (mode.kind === "claim") {
      refundTxs = await createCurrentTimelockRefundTxs({
        nodeTx,
        ...(directNodeTx ? { directNodeTx } : {}),
        sequence: currentSequence,
        receivingPubkey,
        network,
      });
    } else if (mode.kind === "lightning") {
      // hashLockDestinationPubkey is the receiver's identity pubkey (per-leaf
      // metadata via leaf.receiverIdentityPublicKey, set by makeLeafTweaks).
      // sequenceLockDestinationPubkey is the sender's (our) identity pubkey,
      // carried on the mode so callers fetch it once.
      if (!leaf.receiverIdentityPublicKey) {
        throw new SparkValidationError(
          "lightning refund signing requires leaf.receiverIdentityPublicKey",
          { field: "receiverIdentityPublicKey" },
        );
      }
      const { nextSequence, nextDirectSequence } =
        getNextHTLCTransactionSequence(currentSequence);
      refundTxs = createRefundTxsForLightning({
        nodeTx,
        directNodeTx,
        vout: 0,
        sequence: nextSequence,
        directSequence: nextDirectSequence,
        network: getNetwork(network),
        hash: mode.paymentHash,
        hashLockDestinationPubkey: leaf.receiverIdentityPublicKey,
        sequenceLockDestinationPubkey: mode.sequenceLockDestinationPubkey,
      });
    } else {
      refundTxs = await createDecrementedTimelockRefundTxs({
        nodeTx,
        ...(directNodeTx ? { directNodeTx } : {}),
        sequence: currentSequence,
        receivingPubkey,
        network,
      });
    }

    // CPFP refund: always signed when present.
    const connectorPrevOutput =
      mode.kind === "coopExit"
        ? connectorTxParsed!.getOutput(mode.connectorOutputs[i]!.index)
        : undefined;
    if (mode.kind === "coopExit" && (!connectorPrevOutput || !connectorPrevOutput.script)) {
      throw new SparkValidationError("Invalid connector transaction output", {
        field: "connectorPrevOutput",
        value: connectorPrevOutput,
        expected: "Valid output with script",
      });
    }

    const cpfpSighash =
      mode.kind === "coopExit"
        ? getSigHashFromMultiInputTx(refundTxs.cpfpRefundTx, 0, [
            nodeOutput,
            connectorPrevOutput!,
          ])
        : getSigHashFromTx(refundTxs.cpfpRefundTx, 0, nodeOutput);

    pending.push({
      direction: "cpfp",
      leafIdx: i,
      rawTx: refundTxs.cpfpRefundTx.toBytes(),
      signingPublicKey,
      selfCommitment: emptyCommitment(),
      statechainCommitments: requireOperatorCommitments(
        cpfpCommitments[i],
        leaf.leaf.id,
        "cpfp",
      ),
      message: cpfpSighash,
    });

    // Direct refund: only when directRefundTx exists AND not a zero-timelock node.
    if (refundTxs.directRefundTx && !isZeroNode) {
      if (!directNodeTx) {
        throw new SparkValidationError(
          "Direct node transaction undefined while direct refund transaction is defined",
          { field: "directNodeTx", value: directNodeTx, expected: "Non-null direct node tx" },
        );
      }
      const directOutput = directNodeTx.getOutput(0);
      const directSighash =
        mode.kind === "coopExit"
          ? getSigHashFromMultiInputTx(refundTxs.directRefundTx, 0, [
              directOutput,
              connectorPrevOutput!,
            ])
          : getSigHashFromTx(refundTxs.directRefundTx, 0, directOutput);

      pending.push({
        direction: "direct",
        leafIdx: i,
        rawTx: refundTxs.directRefundTx.toBytes(),
        signingPublicKey,
        selfCommitment: emptyCommitment(),
        statechainCommitments: requireOperatorCommitments(
          directCommitments[i],
          leaf.leaf.id,
          "direct",
        ),
        message: directSighash,
      });
    }

    // Direct-from-CPFP refund: signed when present (no isZeroNode gate).
    if (refundTxs.directFromCpfpRefundTx) {
      const directFromCpfpSighash =
        mode.kind === "coopExit"
          ? getSigHashFromMultiInputTx(refundTxs.directFromCpfpRefundTx, 0, [
              nodeOutput,
              connectorPrevOutput!,
            ])
          : getSigHashFromTx(refundTxs.directFromCpfpRefundTx, 0, nodeOutput);

      pending.push({
        direction: "directFromCpfp",
        leafIdx: i,
        rawTx: refundTxs.directFromCpfpRefundTx.toBytes(),
        signingPublicKey,
        selfCommitment: emptyCommitment(),
        statechainCommitments: requireOperatorCommitments(
          directFromCpfpCommitments[i],
          leaf.leaf.id,
          "directFromCpfp",
        ),
        message: directFromCpfpSighash,
      });
    }
  }

  // Single batched SPARK_SIGN_FROST call for all (leaf × direction) tuples.
  const adaptor =
    mode.kind === "transfer" && mode.adaptorPubKey
      ? mode.adaptorPubKey
      : new Uint8Array();
  const frostParams: SignFrostParams[] = pending.map((p) => ({
    message: p.message,
    keyDerivation: leaves[p.leafIdx]!.keyDerivation,
    publicKey: p.signingPublicKey,
    selfCommitment: p.selfCommitment,
    statechainCommitments: p.statechainCommitments,
    adaptorPubKey: adaptor,
    verifyingKey: leaves[p.leafIdx]!.leaf.verifyingPublicKey,
  }));
  const signatures = await signer.signFrostBatch(frostParams);

  const cpfpJobs: LeafSigningJob[] = [];
  const directJobs: LeafSigningJob[] = [];
  const directFromCpfpJobs: LeafSigningJob[] = [];

  for (let i = 0; i < pending.length; i++) {
    const p = pending[i]!;
    const leaf = leaves[p.leafIdx]!;
    const job: LeafSigningJob = {
      leafId: leaf.leaf.id,
      signingPublicKey: p.signingPublicKey,
      rawTx: p.rawTx,
      selfCommitment: p.selfCommitment,
      userSignature: signatures[i]!,
      // SDK consumers also read these fields via the [string]: unknown index:
      signingNonceCommitment: p.selfCommitment.commitment,
      signingCommitments: { signingCommitments: p.statechainCommitments },
      additionalInputs: [],
    };

    if (p.direction === "cpfp") cpfpJobs.push(job);
    else if (p.direction === "direct") directJobs.push(job);
    else directFromCpfpJobs.push(job);
  }

  return {
    cpfpLeafSigningJobs: cpfpJobs,
    directLeafSigningJobs: directJobs,
    directFromCpfpLeafSigningJobs: directFromCpfpJobs,
  };
}
