import {
  type ConfigOptions,
  LeafManager,
  SparkSigner,
  SparkWallet,
  SparkWalletEvent,
  SwapService,
} from "@buildonspark/spark-sdk";
import { TurnkeyTransferService } from "./services/transfer";
import { TurnkeyCoopExitService } from "./services/coop-exit";

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
