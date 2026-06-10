import {
  type ConfigOptions,
  type CreateLightningInvoiceParams,
  LeafManager,
  SparkSigner,
  SparkWallet,
  SparkWalletEvent,
  SwapService,
} from "@buildonspark/spark-sdk";
import {
  operatorsToOperatorRecipients,
  TurnkeyTransferService,
} from "./services/transfer";
import { TurnkeyCoopExitService } from "./services/coop-exit";
import type { TurnkeySparkSigner } from "./signer";
import { uint8ArrayFromHexString } from "@turnkey/encoding";
import type { LightningReceiveRequest } from "@buildonspark/spark-sdk/dist/types";

export class TurnkeySparkWallet extends SparkWallet {
  constructor(options?: ConfigOptions, signerArg?: SparkSigner) {
    super(options, signerArg);

    this.transferService = new TurnkeyTransferService(
      this.config,
      this.connectionManager,
      this.signingService,
      this.__getLogging__(),
    );

    this.swapService = new SwapService(
      this.config,
      this.transferService,
      this.sspClient!,
      this.__getLogging__(),
    );

    this.coopExitService = new TurnkeyCoopExitService(
      this.config,
      this.connectionManager,
      this.signingService,
      this.__getLogging__(),
    );

    // Disable the SDK's claim-time auto-optimize swap. The optimizer splits a
    // freshly-claimed leaf into binary denominations via the swap path, leaving
    // each new leaf in SWAP_PENDING locally. The SO-side state transitions to
    // AVAILABLE only after the swap finalizes, which the in-process LeafManager
    // sees only via a fresh sync — short-lived example runs that try to
    // withdraw/transfer immediately after a claim see available=0 because every
    // local leaf is SWAP_PENDING. Disabling the auto-optimize keeps the claim's
    // leaf AVAILABLE so the next operation proceeds. Users who want
    // optimization can call wallet.optimizeLeaves() explicitly and await it.
    this.leafManager = new LeafManager(
      this.config,
      this.swapService,
      this.transferService,
      this.connectionManager,
      (balance) => {
        this.emit(SparkWalletEvent.BalanceUpdate, {
          available: BigInt(balance.available),
          owned: BigInt(balance.owned),
          incoming: BigInt(balance.incoming),
        });
      },
      undefined,
      this.__getLogging__(),
    );
  }

  override async createLightningInvoice(
    params: CreateLightningInvoiceParams,
  ): Promise<LightningReceiveRequest> {
    const config = this.config;
    const signer = this.config.signer as TurnkeySparkSigner;
    const threshold = config.getThreshold();

    const operatorRecipients = operatorsToOperatorRecipients(
      config.getSigningOperators(),
    );
    const prepared = await signer.prepareLightningReceive({
      threshold,
      operatorRecipients,
    });

    // If storing the encrypted preimage shares fails after invoice creation, rerun
    // invoice creation instead of reusing the printed invoice; the old hodl invoice
    // may time out because Spark operators do not have the shares for its hash.
    const invoice = await this.createLightningHodlInvoice({
      ...params,
      paymentHash: prepared.paymentHash,
    });

    const encryptedPreimageShares: Record<string, Uint8Array> = {};
    for (const pkg of prepared.operatorPackages) {
      encryptedPreimageShares[pkg.operatorId] = uint8ArrayFromHexString(
        pkg.encryptedPackage,
      );
    }

    const receiverIdentityPubkey = params.receiverIdentityPubkey
      ? uint8ArrayFromHexString(params.receiverIdentityPubkey)
      : await signer.getIdentityPublicKey();

    const sparkClient = await this.connectionManager.createSparkClient(
      this.config.getCoordinatorAddress(),
    );

    await sparkClient.store_preimage_share_v2({
      paymentHash: uint8ArrayFromHexString(prepared.paymentHash),
      encryptedPreimageShares,
      threshold,
      invoiceString: invoice.invoice.encodedInvoice,
      userIdentityPublicKey: receiverIdentityPubkey,
    });

    return invoice;
  }

  // override async payLightningInvoice(params: PayLightningInvoiceParams): Promise<LightningSendRequest | WalletTransfer> {

  // }

  /**
   * this.logging is not being exposed by SparkWallet so we'll need to work around TypeScript to get it
   */
  private __getLogging__() {
    // This method seems the fastest way to get the LoggingService type
    type BuildConnectionManager = typeof this.buildConnectionManager;
    type LoggingService = Parameters<BuildConnectionManager>[1];

    return (this as any).logging as LoggingService | undefined;
  }
}

// export async function turnkeyPayLightningInvoice(
//   wallet: SparkWallet,
//   signer: TurnkeySparkSigner,
//   params: Omit<PayLightningInvoiceParams, "preferSpark">,
// ): Promise<unknown> {
//   const internals = getInternals(wallet);
//   const config = internals.config;
//   const invoice = params.invoice.toLowerCase();

//   assertInvoiceNetworkCompatible(invoice, config.getNetworkType());

//   const decodedInvoice = decodeLightningInvoice(invoice);
//   const isZeroAmountInvoice = !decodedInvoice.amountMSats;

//   if (!isZeroAmountInvoice && params.amountSatsToSend !== undefined) {
//     throw new SparkValidationError(
//       "Invalid amount. User can only specify amountSatsToSend for 0 amount lightning invoice",
//       {
//         field: "amountMSats",
//         value: Number(decodedInvoice.amountMSats),
//         expected: "0",
//       },
//     );
//   }

//   if (isZeroAmountInvoice && params.amountSatsToSend === undefined) {
//     throw new SparkValidationError(
//       "Invalid amount. User must specify amountSatsToSend for 0 amount lightning invoice",
//       {
//         field: "amountMSats",
//         value: Number(decodedInvoice.amountMSats),
//         expected: "0",
//       },
//     );
//   }

//   const amountSats = isZeroAmountInvoice
//     ? params.amountSatsToSend!
//     : Math.ceil(Number(decodedInvoice.amountMSats) / 1000);

//   if (isNaN(amountSats) || amountSats <= 0) {
//     throw new SparkValidationError("Invalid amount", {
//       field: "amountSats",
//       value: amountSats,
//       expected: "greater than 0",
//     });
//   }

//   const feeEstimateParams: { encodedInvoice: string; amountSats?: number } = {
//     encodedInvoice: invoice,
//   };
//   if (isZeroAmountInvoice) {
//     feeEstimateParams.amountSats = params.amountSatsToSend!;
//   }

//   const feeEstimate =
//     await wallet.getLightningSendFeeEstimate(feeEstimateParams);

//   if (params.maxFeeSats < feeEstimate) {
//     throw new SparkValidationError("maxFeeSats does not cover fee estimate", {
//       field: "maxFeeSats",
//       value: params.maxFeeSats,
//       expected: `${feeEstimate} sats`,
//     });
//   }

//   const totalAmount = amountSats + feeEstimate;
//   const sspClient = internals.getSspClient() as unknown as {
//     requestLightningSend(params: {
//       encodedInvoice: string;
//       amountSats?: number;
//       userOutboundTransferExternalId: string;
//     }): Promise<unknown>;
//   };
//   const paymentHash = fromHex(decodedInvoice.paymentHash);
//   const expiryTime = new Date(Date.now() + LIGHTNING_SEND_EXPIRY_MS);

//   return internals.leafManager.selectLeavesAndExecute(
//     [totalAmount],
//     async (selected) => {
//       const leaves = selected[0]!;
//       const sspIdentityPubkey = fromHex(config.getSspIdentityPublicKey());
//       const leafTweaks = makeLeafTweaks(leaves, sspIdentityPubkey);
//       const transferId = uuidv7();

//       const startTransferRequest = await prepareTurnkeyTransferForLightning(
//         internals,
//         signer,
//         leafTweaks,
//         paymentHash,
//         expiryTime,
//         transferId,
//       );

//       const swapResponse =
//         await internals.lightningService.swapNodesForPreimage({
//           leaves: leafTweaks,
//           receiverIdentityPubkey: sspIdentityPubkey,
//           paymentHash,
//           isInboundPayment: false,
//           invoiceString: invoice,
//           feeSats: feeEstimate,
//           startTransferRequest,
//           expiryTime,
//           transferID: transferId,
//           ...(params.amountSatsToSend !== undefined
//             ? { amountSatsToSend: params.amountSatsToSend }
//             : {}),
//           ...(params.idempotencyKey !== undefined
//             ? { idempotencyKey: params.idempotencyKey }
//             : {}),
//         });

//       if (!swapResponse.transfer) {
//         throw new Error("Failed to swap nodes for preimage");
//       }

//       await internals.leafManager.handleTransferEvent(swapResponse.transfer);

//       const sspResponse = await sspClient.requestLightningSend({
//         encodedInvoice: invoice,
//         userOutboundTransferExternalId: swapResponse.transfer.id,
//         ...(isZeroAmountInvoice
//           ? { amountSats: params.amountSatsToSend! }
//           : {}),
//       });

//       if (!sspResponse) {
//         throw new Error("Failed to contact SSP");
//       }

//       return sspResponse;
//     },
//   );
// }
