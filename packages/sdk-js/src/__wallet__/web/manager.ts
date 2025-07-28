import { WebWalletStamper } from "./stamper";
import { WebWalletSigner } from "./signer";
import { EthereumWallet } from "./connector/ethereum";
import { SolanaWallet } from "./connector/solana";
import {
  TWalletManagerConfig,
  WalletInterface,
  WalletProvider,
  WalletType,
} from "@types";

export class WebWalletManager {
  readonly wallets: Partial<Record<WalletType, WalletInterface>> = {};

  readonly stamper: WebWalletStamper;
  readonly signer: WebWalletSigner;

  constructor(cfg: TWalletManagerConfig) {
    if (cfg.ethereum) {
      this.wallets[WalletType.Ethereum] = new EthereumWallet();
    }

    if (cfg.solana) {
      this.wallets[WalletType.Solana] = new SolanaWallet();
    }

    this.stamper = new WebWalletStamper(this.wallets);
    this.signer = new WebWalletSigner(this.wallets);
  }

  async init(): Promise<void> {
    await this.stamper.init();
  }

  /**
   * Retrieves available wallet providers based on the configured chains.
   *
   * @param chain - Optional wallet type to filter providers by.
   * @returns A promise that resolves to an array of wallet providers.
   */
  async getProviders(chain?: WalletType): Promise<WalletProvider[]> {
    if (chain) {
      const wallet = this.wallets[chain];

      if (!wallet) {
        throw new Error(`Wallet for ${chain} not initialized`);
      }

      return await wallet.getProviders();
    }

    const providersArrays = await Promise.all(
      Object.values(this.wallets).map((wallet) => wallet.getProviders()),
    );

    return providersArrays.flat();
  }
}
