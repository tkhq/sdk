/**
 * Lightning orchestration for the Turnkey Spark signer.
 *
 * The Spark SDK's native Lightning receive path calls splitSecretWithProofs()
 * client-side, and its Lightning send path calls subtractSplitAndEncrypt().
 * Turnkey keeps those secrets inside the enclave, so this module wires the
 * SDK Lightning protocol steps to Turnkey's SPARK_PREPARE_LIGHTNING_RECEIVE
 * (for receive) and PREPARE_SPARK_TRANSFER (for send) activities.
 */

import { v7 as uuidv7 } from "uuid";
import {
  SparkValidationError,
  type CreateLightningHodlInvoiceParams,
  type KeyDerivation,
  type PayLightningInvoiceParams,
  type SigningCommitment,
  type SparkWallet,
} from "@buildonspark/spark-sdk";
import { decode as decodeBolt11 } from "light-bolt11-decoder";
import type {
  OperatorRecipientInput,
  TransferLeafInput,
  TurnkeySparkSigner,
} from "./turnkeySigner";

const HASH_VARIANT_V2 = 1;

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function fromHex(h: string): Uint8Array {
  return Buffer.from(h.replace(/^0x/, ""), "hex");
}

function leafDerivation(leafId: string): KeyDerivation {
  return { type: "leaf", path: leafId } as unknown as KeyDerivation;
}

function invoiceNetwork(invoice: string): "MAINNET" | "REGTEST" | "TESTNET" | "SIGNET" | null {
  if (invoice.startsWith("lnbcrt")) return "REGTEST";
  if (invoice.startsWith("lnbc")) return "MAINNET";
  if (invoice.startsWith("lntb")) return "TESTNET";
  if (invoice.startsWith("lnsb")) return "SIGNET";
  return null;
}

interface Bolt11Section {
  name: string;
  value?: unknown;
}

interface Bolt11Decoded {
  sections: Bolt11Section[];
}

function decodeLightningInvoice(invoice: string): {
  amountMSats: bigint | null;
  paymentHash: string;
} {
  const decoded = decodeBolt11(invoice) as Bolt11Decoded;
  let amountMSats: bigint | null = null;
  let paymentHash: string | undefined;

  for (const section of decoded.sections) {
    if (section.name === "amount" && section.value) {
      amountMSats = BigInt(String(section.value));
    }
    if (section.name === "payment_hash" && section.value) {
      paymentHash = String(section.value);
    }
  }

  if (!paymentHash) {
    throw new SparkValidationError("No payment hash found in invoice", {
      invoice,
    });
  }

  return { amountMSats, paymentHash };
}

function assertInvoiceNetworkCompatible(
  invoice: string,
  walletNetwork: string,
): void {
  const network = invoiceNetwork(invoice);
  const valid =
    network === walletNetwork ||
    (network === "REGTEST" &&
      (walletNetwork === "REGTEST" || walletNetwork === "LOCAL"));

  if (!valid) {
    throw new SparkValidationError(
      `Invoice network: ${network} does not match wallet network: ${walletNetwork}`,
      {
        field: "invoice",
        value: network,
        expected: walletNetwork,
      },
    );
  }
}

function operatorRecipients(config: SparkConfig): OperatorRecipientInput[] {
  return Object.values(config.getSigningOperators())
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((op) => ({
      operatorId: op.identifier,
      encryptionPublicKey: op.identityPublicKey,
    }));
}

interface SparkWalletInternals {
  transferService: {
    connectionManager: {
      createSparkClient(address: string): Promise<SparkGrpcClient>;
    };
    config: SparkConfig;
    signingService: SparkSigningService;
  };
  leafManager: {
    selectLeavesAndExecute<T>(
      amounts: number[],
      callback: (selected: LeafSelection[][]) => Promise<T>,
    ): Promise<T>;
    handleTransferEvent(transfer: SparkTransfer): Promise<void>;
  };
  lightningService: {
    swapNodesForPreimage(params: SwapNodesForPreimageParams): Promise<{
      transfer?: SparkTransfer;
    }>;
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
  getNetworkType(): string;
  signer: TurnkeySparkSigner;
}

interface SparkGrpcClient {
  get_signing_commitments(params: {
    nodeIds: string[];
    count: number;
  }): Promise<{ signingCommitments: OperatorSigningCommitment[] }>;
  store_preimage_share_v2(params: {
    paymentHash: Uint8Array;
    encryptedPreimageShares: Record<string, Uint8Array>;
    threshold: number;
    invoiceString: string;
    userIdentityPublicKey: Uint8Array;
  }): Promise<unknown>;
}

interface SspClient {
  requestLightningSend(params: {
    encodedInvoice: string;
    amountSats?: number;
    userOutboundTransferExternalId: string;
  }): Promise<unknown>;
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
  signRefundsForLightning(
    leaves: LeafTweak[],
    cpfpCommitments: OperatorSigningCommitment[],
    directCommitments: OperatorSigningCommitment[],
    directFromCpfpCommitments: OperatorSigningCommitment[],
    paymentHash: Uint8Array,
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

interface StartTransferRequest {
  transferId: string;
  ownerIdentityPublicKey: Uint8Array;
  receiverIdentityPublicKey: Uint8Array;
  transferPackage: TransferPackage;
  sparkInvoice: string;
  leavesToSend: [];
  expiryTime: Date;
}

interface SparkTransfer {
  id: string;
  [key: string]: unknown;
}

interface SwapNodesForPreimageParams {
  leaves: LeafTweak[];
  receiverIdentityPubkey: Uint8Array;
  paymentHash: Uint8Array;
  isInboundPayment: boolean;
  invoiceString?: string;
  feeSats?: number;
  amountSatsToSend?: number;
  startTransferRequest?: StartTransferRequest;
  expiryTime?: Date;
  transferID?: string;
  idempotencyKey?: string;
}

export async function createTurnkeyLightningInvoice(
  wallet: SparkWallet,
  signer: TurnkeySparkSigner,
  params: Omit<CreateLightningHodlInvoiceParams, "paymentHash">,
): Promise<Awaited<ReturnType<SparkWallet["createLightningHodlInvoice"]>>> {
  const internals = wallet as unknown as SparkWalletInternals;
  const config = internals.config;
  const threshold = config.getThreshold();
  const recipients = operatorRecipients(config);

  const prepared = await signer.prepareLightningReceive({
    threshold,
    operatorRecipients: recipients,
  });

  // If storing the encrypted preimage shares fails after invoice creation, rerun
  // invoice creation instead of reusing the printed invoice; the old hodl invoice
  // may time out because Spark operators do not have the shares for its hash.
  const invoice = await wallet.createLightningHodlInvoice({
    ...params,
    paymentHash: prepared.paymentHash,
  });

  const encryptedPreimageShares: Record<string, Uint8Array> = {};
  for (const pkg of prepared.operatorPackages) {
    encryptedPreimageShares[pkg.operatorId] = fromHex(pkg.encryptedPackage);
  }

  const invoiceString = invoice.invoice.encodedInvoice;
  const receiverIdentityPubkey = params.receiverIdentityPubkey
    ? fromHex(params.receiverIdentityPubkey)
    : await signer.getIdentityPublicKey();

  const sparkClient =
    await internals.transferService.connectionManager.createSparkClient(
      config.getCoordinatorAddress(),
    );

  await sparkClient.store_preimage_share_v2({
    paymentHash: fromHex(prepared.paymentHash),
    encryptedPreimageShares,
    threshold,
    invoiceString,
    userIdentityPublicKey: receiverIdentityPubkey,
  });

  return invoice;
}

export async function turnkeyPayLightningInvoice(
  wallet: SparkWallet,
  signer: TurnkeySparkSigner,
  params: Omit<PayLightningInvoiceParams, "preferSpark">,
): Promise<unknown> {
  const internals = wallet as unknown as SparkWalletInternals;
  const config = internals.config;
  const invoice = params.invoice.toLowerCase();

  assertInvoiceNetworkCompatible(invoice, config.getNetworkType());

  const decodedInvoice = decodeLightningInvoice(invoice);
  const isZeroAmountInvoice = !decodedInvoice.amountMSats;

  if (!isZeroAmountInvoice && params.amountSatsToSend !== undefined) {
    throw new SparkValidationError(
      "Invalid amount. User can only specify amountSatsToSend for 0 amount lightning invoice",
      {
        field: "amountMSats",
        value: Number(decodedInvoice.amountMSats),
        expected: "0",
      },
    );
  }

  if (isZeroAmountInvoice && params.amountSatsToSend === undefined) {
    throw new SparkValidationError(
      "Invalid amount. User must specify amountSatsToSend for 0 amount lightning invoice",
      {
        field: "amountMSats",
        value: Number(decodedInvoice.amountMSats),
        expected: "0",
      },
    );
  }

  const amountSats = isZeroAmountInvoice
    ? params.amountSatsToSend!
    : Math.ceil(Number(decodedInvoice.amountMSats) / 1000);

  if (isNaN(amountSats) || amountSats <= 0) {
    throw new SparkValidationError("Invalid amount", {
      field: "amountSats",
      value: amountSats,
      expected: "greater than 0",
    });
  }

  const feeEstimateParams: {
    encodedInvoice: string;
    amountSats?: number;
  } = {
    encodedInvoice: invoice,
  };
  if (isZeroAmountInvoice) {
    feeEstimateParams.amountSats = params.amountSatsToSend!;
  }

  const feeEstimate =
    await wallet.getLightningSendFeeEstimate(feeEstimateParams);

  if (params.maxFeeSats < feeEstimate) {
    throw new SparkValidationError("maxFeeSats does not cover fee estimate", {
      field: "maxFeeSats",
      value: params.maxFeeSats,
      expected: `${feeEstimate} sats`,
    });
  }

  const totalAmount = amountSats + feeEstimate;
  const sspClient = internals.getSspClient();
  const paymentHash = fromHex(decodedInvoice.paymentHash);
  // Matches the Spark SDK's Lightning send retry window. The SSP can use this
  // transfer request while the outbound Lightning payment is in flight.
  const expiryTime = new Date(Date.now() + 16 * 24 * 60 * 60 * 1000);

  return internals.leafManager.selectLeavesAndExecute(
    [totalAmount],
    async (selected) => {
      const leaves = selected[0]!;
      const sspIdentityPubkey = fromHex(config.getSspIdentityPublicKey());
      const leafTweaks: LeafTweak[] = leaves.map((leaf) => ({
        leaf,
        keyDerivation: leafDerivation(leaf.id),
        newKeyDerivation: leafDerivation(uuidv7()),
        receiverIdentityPublicKey: sspIdentityPubkey,
      }));
      const transferId = uuidv7();

      const startTransferRequest = await prepareTurnkeyTransferForLightning(
        wallet,
        signer,
        leafTweaks,
        paymentHash,
        expiryTime,
        transferId,
      );

      const swapParams: SwapNodesForPreimageParams = {
        leaves: leafTweaks,
        receiverIdentityPubkey: sspIdentityPubkey,
        paymentHash,
        isInboundPayment: false,
        invoiceString: invoice,
        feeSats: feeEstimate,
        startTransferRequest,
        expiryTime,
        transferID: transferId,
      };
      if (params.amountSatsToSend !== undefined) {
        swapParams.amountSatsToSend = params.amountSatsToSend;
      }
      if (params.idempotencyKey !== undefined) {
        swapParams.idempotencyKey = params.idempotencyKey;
      }

      const swapResponse =
        await internals.lightningService.swapNodesForPreimage(swapParams);

      if (!swapResponse.transfer) {
        throw new Error("Failed to swap nodes for preimage");
      }

      await internals.leafManager.handleTransferEvent(swapResponse.transfer);

      const requestLightningSendParams: {
        encodedInvoice: string;
        amountSats?: number;
        userOutboundTransferExternalId: string;
      } = {
        encodedInvoice: invoice,
        userOutboundTransferExternalId: swapResponse.transfer.id,
      };
      if (isZeroAmountInvoice) {
        requestLightningSendParams.amountSats = params.amountSatsToSend!;
      }

      const sspResponse = await sspClient.requestLightningSend(
        requestLightningSendParams,
      );

      if (!sspResponse) {
        throw new Error("Failed to contact SSP");
      }

      return sspResponse;
    },
  );
}

async function prepareTurnkeyTransferForLightning(
  wallet: SparkWallet,
  signer: TurnkeySparkSigner,
  leaves: LeafTweak[],
  paymentHash: Uint8Array,
  expiryTime: Date,
  transferId: string,
): Promise<StartTransferRequest> {
  if (leaves.length === 0) {
    throw new SparkValidationError("leaves must not be empty");
  }

  const internals = wallet as unknown as SparkWalletInternals;
  const config = internals.config;
  const signingService = internals.transferService.signingService;
  const sparkClient =
    await internals.transferService.connectionManager.createSparkClient(
      config.getCoordinatorAddress(),
    );

  const { signingCommitments } = await sparkClient.get_signing_commitments({
    nodeIds: leaves.map((leaf) => leaf.leaf.id),
    count: 3,
  });

  const n = leaves.length;
  const {
    cpfpLeafSigningJobs,
    directLeafSigningJobs,
    directFromCpfpLeafSigningJobs,
  } = await signingService.signRefundsForLightning(
    leaves,
    signingCommitments.slice(0, n),
    signingCommitments.slice(n, 2 * n),
    signingCommitments.slice(2 * n, 3 * n),
    paymentHash,
  );

  const recipients = operatorRecipients(config);
  const turnkeyResult = await signer.prepareTransfer({
    transferId,
    leaves: leaves.map(
      (leaf): TransferLeafInput => ({
        leafId: leaf.leaf.id,
        oldLeafDerivation: leaf.keyDerivation,
        newLeafDerivation: leaf.newKeyDerivation,
      }),
    ),
    threshold: config.getThreshold(),
    operatorRecipients: recipients,
    receiverPublicKey: hex(leaves[0]!.receiverIdentityPublicKey),
  });

  const keyTweakPackage: Record<string, Uint8Array> = {};
  for (const pkg of turnkeyResult.operatorPackages) {
    keyTweakPackage[pkg.operatorId] = fromHex(pkg.encryptedPackage);
  }

  return {
    transferId,
    ownerIdentityPublicKey: await signer.getIdentityPublicKey(),
    receiverIdentityPublicKey: leaves[0]!.receiverIdentityPublicKey,
    transferPackage: {
      leavesToSend: cpfpLeafSigningJobs,
      keyTweakPackage,
      userSignature: fromHex(turnkeyResult.transferUserSignature),
      directLeavesToSend: directLeafSigningJobs,
      directFromCpfpLeavesToSend: directFromCpfpLeafSigningJobs,
      hashVariant: HASH_VARIANT_V2,
    },
    sparkInvoice: "",
    leavesToSend: [],
    expiryTime,
  };
}
