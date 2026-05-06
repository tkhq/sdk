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
import type {
  KeyDerivation,
  NetworkType,
  SigningCommitment,
  SparkWallet,
} from "@buildonspark/spark-sdk";
import type {
  OperatorRecipientInput,
  TransferLeafInput,
  TransferResult,
  TurnkeySparkSigner,
} from "./turnkeySigner";

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
  getNetwork(): string;
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
  value: number | bigint;
  status?: string;
  [key: string]: unknown;
}

export interface LeafTweak {
  leaf: LeafSelection;
  keyDerivation: KeyDerivation;
  newKeyDerivation: KeyDerivation;
  receiverIdentityPublicKey: Uint8Array;
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
 * (cpfp, direct, directFromCpfp) groups. The signRefunds* methods on
 * SparkSigningService all consume this 3-way split.
 */
export async function fetchRefundCommitments(
  sparkClient: SparkGrpcClient,
  nodeIds: string[],
): Promise<
  [
    OperatorSigningCommitment[],
    OperatorSigningCommitment[],
    OperatorSigningCommitment[],
  ]
> {
  const { signingCommitments } = await sparkClient.get_signing_commitments({
    nodeIds,
    count: 3,
  });
  const n = nodeIds.length;
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
