import {
  type ConfigOptions,
  SparkSigner,
  SparkWallet,
} from "@buildonspark/spark-sdk";
import { TurneyTransferService } from "./services/transfer";

export class TurnkeySparkWallet extends SparkWallet {
  constructor(options?: ConfigOptions, signerArg?: SparkSigner) {
    super(options, signerArg);

    this.transferService = new TurneyTransferService(
      this.config,
      this.connectionManager,
      this.signingService,
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
    Object.assign(this.leafManager, {
      transferService: this.transferService,
      onAutoOptimize: async () => undefined,
    });

    Object.assign(this.swapService, { transferService: this.transferService });
  }
}
