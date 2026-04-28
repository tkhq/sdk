/**
 * TurnkeyWalletAccountSpark — extends Tether's WalletAccountSpark so that
 * the underlying SparkWallet is constructed with our TurnkeySparkSigner.
 *
 * The base class hard-codes `new Bip44SparkSigner(index)` inside its
 * `at(seed, index, config)` factory. We can't override that factory
 * cleanly (it takes a seed), so this subclass provides its own
 * `fromTurnkey()` factory and overrides the high-level methods that the
 * SDK's per-leaf flow can't service for an enclave-resident key.
 */

import { SparkWallet } from "@buildonspark/spark-sdk";
import type { NetworkType, WithdrawParams } from "@buildonspark/spark-sdk";
import type { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { WalletAccountSpark } from "@tetherto/wdk-wallet-spark";

import { TurnkeySparkSigner } from "./turnkeySigner";
import { turnkeyTransfer } from "./turnkeyTransfer";
import { turnkeyClaim } from "./turnkeyClaim";
import { turnkeyWithdraw } from "./turnkeyWithdraw";
import { installTurnkeySwapService } from "./turnkeySwap";

export interface TurnkeyAccountInit {
  turnkeyClient: TurnkeyServerSDK;
  sparkAddress: string;
  ecdsaAddress: string;
  identityPublicKeyHex: string;
  network: NetworkType;
}

type SparkTransaction = { to: string; value: number | bigint };
type TransactionResult = { hash: string; fee: bigint };
type WithdrawOptions = Omit<WithdrawParams, "feeQuote">;

/**
 * Patch SparkWallet.prototype.claimTransfer to route through turnkeyClaim.
 *
 * The SDK's native claim path calls signer.decryptEcies() which requires
 * the identity private key client-side. Turnkey keeps that key in the
 * enclave, so we intercept claims (including the SDK's background
 * auto-claim that fires inside initialize()) and run them through the
 * enclave-based flow.
 */
function patchClaimTransferProto(signer: TurnkeySparkSigner): () => void {
  const proto = SparkWallet.prototype as any;
  const original = proto.claimTransfer;

  proto.claimTransfer = async function (
    this: any,
    { transfer, emit }: { transfer: any; emit?: boolean },
  ) {
    const result = await this.claimTransferMutex.runExclusive(() =>
      turnkeyClaim(this, signer, transfer),
    );
    return this.processClaimedTransferResults(result, transfer, emit);
  };

  return () => {
    proto.claimTransfer = original;
  };
}

function installInstanceClaimOverride(
  wallet: SparkWallet,
  signer: TurnkeySparkSigner,
): void {
  const w = wallet as any;
  w.claimTransfer = async function ({
    transfer,
    emit,
  }: {
    transfer: any;
    emit?: boolean;
  }) {
    const result = await w.claimTransferMutex.runExclusive(() =>
      turnkeyClaim(wallet, signer, transfer),
    );
    return w.processClaimedTransferResults(result, transfer, emit);
  };
}

/**
 * The WDK declares `WalletAccountSpark` with private fields and abstract
 * inherited methods that don't appear in its JS, which makes a clean TS
 * subclass impossible. Cast the base to `any` so we can extend it without
 * fighting the package's incomplete type declarations.
 */
const WalletAccountSparkUntyped = WalletAccountSpark as unknown as new (
  ...args: any[]
) => any;

export default class TurnkeyWalletAccountSpark extends WalletAccountSparkUntyped {
  /** Underlying Turnkey-backed signer. Exposed so atomic flows (deposits,
   *  swap, low-level overrides) can be invoked outside the WDK surface. */
  public readonly turnkeySigner: TurnkeySparkSigner;

  /** Underlying SparkWallet — escape hatch for code that needs SDK access
   *  (e.g. transferService internals during regtest E2E). */
  public readonly sparkWallet: SparkWallet;

  private constructor(
    wallet: SparkWallet,
    signer: TurnkeySparkSigner,
    network: NetworkType,
  ) {
    super(wallet, { network });
    this.turnkeySigner = signer;
    this.sparkWallet = wallet;
  }

  /**
   * Construct an account whose Spark identity is held by Turnkey.
   *
   * Replaces `WalletAccountSpark.at(seed, index, config)`.
   */
  static async fromTurnkey(
    init: TurnkeyAccountInit,
  ): Promise<TurnkeyWalletAccountSpark> {
    const signer = new TurnkeySparkSigner(
      init.turnkeyClient,
      init.sparkAddress,
      init.ecdsaAddress,
      init.identityPublicKeyHex,
    );

    const restore = patchClaimTransferProto(signer);
    let wallet: SparkWallet;
    try {
      ({ wallet } = await SparkWallet.initialize({
        signer: signer as any,
        options: {
          network: init.network,
          signerWithPreExistingKeys: true,
        },
      }));
    } finally {
      restore();
    }

    installInstanceClaimOverride(wallet, signer);
    installTurnkeySwapService(wallet, signer);

    return new TurnkeyWalletAccountSpark(wallet, signer, init.network);
  }

  // ---------------------------------------------------------------------------
  // Overrides for methods that don't fit the enclave-resident key model
  // ---------------------------------------------------------------------------

  /**
   * The WDK base exposes the signer's raw private keys here. With Turnkey,
   * those keys never leave the enclave, so this getter is unsafe.
   */
  get keyPair(): never {
    throw new Error(
      "TurnkeyWalletAccountSpark does not expose private keys — they live in the Turnkey enclave.",
    );
  }

  /**
   * The WDK base derives the path from the BIP-44 signer's index. With
   * Turnkey, the identity key is provisioned by an organization-level
   * path, not a per-account BIP-44 derivation.
   */
  get path(): never {
    throw new Error(
      "TurnkeyWalletAccountSpark has no BIP-44 path — Turnkey provisions the identity key via its own derivation.",
    );
  }

  get index(): never {
    throw new Error(
      "TurnkeyWalletAccountSpark has no BIP-44 index — use TurnkeyWalletManagerSpark.getAccount(i) for the per-manager slot.",
    );
  }

  /**
   * Atomic transfer via Turnkey's SPARK_PREPARE_AND_SIGN — replaces the
   * SDK's per-leaf `subtractSplitAndEncrypt` flow.
   */
  async sendTransaction(tx: SparkTransaction): Promise<TransactionResult> {
    const result = await turnkeyTransfer(this.sparkWallet, this.turnkeySigner, {
      amountSats: Number(tx.value),
      receiverSparkAddress: tx.to,
    });
    // WDK's TransactionResult expects { hash, fee }. The SDK's transfer id
    // is the closest analog to a transaction hash; Spark transfers have no
    // on-chain fee.
    return { hash: result.id, fee: 0n };
  }

  /**
   * Cooperative exit via Turnkey atomic flow. Mirrors the WDK signature
   * (no feeQuote in options) by fetching the quote internally first.
   */
  async withdraw(options: WithdrawOptions): Promise<unknown> {
    if (options.amountSats === undefined) {
      throw new Error(
        "TurnkeyWalletAccountSpark.withdraw requires options.amountSats",
      );
    }
    const exitSpeed = options.exitSpeed as "FAST" | "MEDIUM" | "SLOW";
    const feeQuote = await this.sparkWallet.getWithdrawalFeeQuote({
      amountSats: options.amountSats,
      withdrawalAddress: options.onchainAddress,
    });
    if (!feeQuote) {
      throw new Error(
        "Failed to obtain withdrawal fee quote from Spark service provider",
      );
    }

    return turnkeyWithdraw(this.sparkWallet, this.turnkeySigner, {
      onchainAddress: options.onchainAddress,
      amountSats: options.amountSats,
      exitSpeed,
      feeQuote: feeQuote as never,
    });
  }
}
