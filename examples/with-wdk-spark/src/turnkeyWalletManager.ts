/**
 * TurnkeyWalletManagerSpark — analog of Tether's WalletManagerSpark for
 * Turnkey-custodied identities.
 *
 * The base WDK manager takes a BIP-39 seed and derives a BIP-44 account
 * tree. Turnkey identity keys aren't seed-derived — each account is
 * provisioned by Turnkey under its own organization/wallet/path. So this
 * class doesn't extend WalletManagerSpark; it mimics the lazy
 * `getAccount(index)` shape while accepting an explicit list of Turnkey
 * account configs.
 */

import type { NetworkType } from "@buildonspark/spark-sdk";
import type { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

import TurnkeyWalletAccountSpark from "./turnkeyWalletAccount";

export interface TurnkeyAccountConfig {
  sparkAddress: string;
  ecdsaAddress: string;
  identityPublicKeyHex: string;
}

export interface TurnkeyWalletManagerOptions {
  turnkeyClient: TurnkeyServerSDK;
  accounts: TurnkeyAccountConfig[];
  network?: NetworkType;
}

export default class TurnkeyWalletManagerSpark {
  private readonly options: TurnkeyWalletManagerOptions;
  private readonly cache = new Map<number, TurnkeyWalletAccountSpark>();

  constructor(options: TurnkeyWalletManagerOptions) {
    this.options = options;
  }

  /**
   * Returns the account at the given slot (mirrors WalletManagerSpark.getAccount).
   * Each slot maps 1:1 to the corresponding entry in `options.accounts`.
   */
  async getAccount(index = 0): Promise<TurnkeyWalletAccountSpark> {
    const cached = this.cache.get(index);
    if (cached) return cached;

    const cfg = this.options.accounts[index];
    if (!cfg) {
      throw new Error(
        `TurnkeyWalletManagerSpark: no account configured at index ${index} ` +
          `(have ${this.options.accounts.length})`,
      );
    }

    const account = await TurnkeyWalletAccountSpark.fromTurnkey({
      turnkeyClient: this.options.turnkeyClient,
      sparkAddress: cfg.sparkAddress,
      ecdsaAddress: cfg.ecdsaAddress,
      identityPublicKeyHex: cfg.identityPublicKeyHex,
      network: this.options.network ?? "MAINNET",
    });
    this.cache.set(index, account);
    return account;
  }

  /**
   * Spark has no on-chain fee market — mirrors the WDK base which always
   * returns zero.
   */
  async getFeeRates(): Promise<{ normal: bigint; fast: bigint }> {
    return { normal: 0n, fast: 0n };
  }

  async dispose(): Promise<void> {
    for (const account of this.cache.values()) {
      account.sparkWallet.cleanupConnections();
    }
    this.cache.clear();
  }
}
