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
  type PayLightningInvoiceParams,
  type SparkWallet,
} from "@buildonspark/spark-sdk";
import { decode as decodeBolt11 } from "light-bolt11-decoder";
import type { TurnkeySparkSigner } from "./turnkeySigner";
import {
  createSparkClient,
  fetchRefundCommitments,
  fromHex,
  getInternals,
  getOperatorRecipients,
  hex,
  type LeafTweak,
  makeLeafTweaks,
  makeTransferPackage,
  type SparkWalletInternals,
  transferLeavesFromTweaks,
} from "./turnkeyInternal";

interface Bolt11Decoded {
  sections: Array<{ name: string; value?: unknown }>;
}

function invoiceNetwork(
  invoice: string,
): "MAINNET" | "REGTEST" | "TESTNET" | "SIGNET" | null {
  if (invoice.startsWith("lnbcrt")) return "REGTEST";
  if (invoice.startsWith("lnbc")) return "MAINNET";
  if (invoice.startsWith("lntb")) return "TESTNET";
  if (invoice.startsWith("lnsb")) return "SIGNET";
  return null;
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
      { field: "invoice", value: network, expected: walletNetwork },
    );
  }
}

export async function createTurnkeyLightningInvoice(
  wallet: SparkWallet,
  signer: TurnkeySparkSigner,
  params: Omit<CreateLightningHodlInvoiceParams, "paymentHash">,
): Promise<Awaited<ReturnType<SparkWallet["createLightningHodlInvoice"]>>> {
  const internals = getInternals(wallet);
  const config = internals.config;
  const threshold = config.getThreshold();

  const prepared = await signer.prepareLightningReceive({
    threshold,
    operatorRecipients: getOperatorRecipients(config),
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

  const receiverIdentityPubkey = params.receiverIdentityPubkey
    ? fromHex(params.receiverIdentityPubkey)
    : await signer.getIdentityPublicKey();

  const sparkClient = await createSparkClient(internals);

  await sparkClient.store_preimage_share_v2({
    paymentHash: fromHex(prepared.paymentHash),
    encryptedPreimageShares,
    threshold,
    invoiceString: invoice.invoice.encodedInvoice,
    userIdentityPublicKey: receiverIdentityPubkey,
  });

  return invoice;
}

export async function turnkeyPayLightningInvoice(
  wallet: SparkWallet,
  signer: TurnkeySparkSigner,
  params: Omit<PayLightningInvoiceParams, "preferSpark">,
): Promise<unknown> {
  const internals = getInternals(wallet);
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

  const feeEstimateParams: { encodedInvoice: string; amountSats?: number } = {
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
  const sspClient = internals.getSspClient() as unknown as {
    requestLightningSend(params: {
      encodedInvoice: string;
      amountSats?: number;
      userOutboundTransferExternalId: string;
    }): Promise<unknown>;
  };
  const paymentHash = fromHex(decodedInvoice.paymentHash);
  // Matches the Spark SDK's Lightning send retry window. The SSP can use this
  // transfer request while the outbound Lightning payment is in flight.
  const expiryTime = new Date(Date.now() + 16 * 24 * 60 * 60 * 1000);

  return internals.leafManager.selectLeavesAndExecute(
    [totalAmount],
    async (selected) => {
      const leaves = selected[0]!;
      const sspIdentityPubkey = fromHex(config.getSspIdentityPublicKey());
      const leafTweaks = makeLeafTweaks(leaves, sspIdentityPubkey);
      const transferId = uuidv7();

      const startTransferRequest = await prepareTurnkeyTransferForLightning(
        internals,
        signer,
        leafTweaks,
        paymentHash,
        expiryTime,
        transferId,
      );

      const swapResponse =
        await internals.lightningService.swapNodesForPreimage({
          leaves: leafTweaks,
          receiverIdentityPubkey: sspIdentityPubkey,
          paymentHash,
          isInboundPayment: false,
          invoiceString: invoice,
          feeSats: feeEstimate,
          startTransferRequest,
          expiryTime,
          transferID: transferId,
          ...(params.amountSatsToSend !== undefined
            ? { amountSatsToSend: params.amountSatsToSend }
            : {}),
          ...(params.idempotencyKey !== undefined
            ? { idempotencyKey: params.idempotencyKey }
            : {}),
        });

      if (!swapResponse.transfer) {
        throw new Error("Failed to swap nodes for preimage");
      }

      await internals.leafManager.handleTransferEvent(swapResponse.transfer);

      const sspResponse = await sspClient.requestLightningSend({
        encodedInvoice: invoice,
        userOutboundTransferExternalId: swapResponse.transfer.id,
        ...(isZeroAmountInvoice
          ? { amountSats: params.amountSatsToSend! }
          : {}),
      });

      if (!sspResponse) {
        throw new Error("Failed to contact SSP");
      }

      return sspResponse;
    },
  );
}

async function prepareTurnkeyTransferForLightning(
  internals: SparkWalletInternals,
  signer: TurnkeySparkSigner,
  leaves: LeafTweak[],
  paymentHash: Uint8Array,
  expiryTime: Date,
  transferId: string,
): Promise<{
  transferId: string;
  ownerIdentityPublicKey: Uint8Array;
  receiverIdentityPublicKey: Uint8Array;
  transferPackage: ReturnType<typeof makeTransferPackage>;
  sparkInvoice: string;
  leavesToSend: [];
  expiryTime: Date;
}> {
  if (leaves.length === 0) {
    throw new SparkValidationError("leaves must not be empty");
  }

  const config = internals.config;
  const signingService = internals.transferService.signingService;
  const sparkClient = await createSparkClient(internals);

  const [cpfpC, directC, directFromCpfpC] = await fetchRefundCommitments(
    sparkClient,
    leaves.map((l) => l.leaf.id),
  );
  const jobs = await signingService.signRefundsForLightning(
    leaves,
    cpfpC,
    directC,
    directFromCpfpC,
    paymentHash,
  );

  const turnkeyResult = await signer.prepareTransfer({
    transferId,
    leaves: transferLeavesFromTweaks(leaves),
    threshold: config.getThreshold(),
    operatorRecipients: getOperatorRecipients(config),
    receiverPublicKey: hex(leaves[0]!.receiverIdentityPublicKey),
  });

  return {
    transferId,
    ownerIdentityPublicKey: await signer.getIdentityPublicKey(),
    receiverIdentityPublicKey: leaves[0]!.receiverIdentityPublicKey,
    transferPackage: makeTransferPackage(turnkeyResult, jobs),
    sparkInvoice: "",
    leavesToSend: [],
    expiryTime,
  };
}
