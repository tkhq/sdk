import { CrossPlatformWalletStamper } from "./stamper";
import { CrossPlatformWalletSigner } from "./signer";
import {
  EthereumWallet,
  SolanaWallet,
  WalletInterface,
  WalletProvider,
  WalletType,
} from "@turnkey/wallet-stamper";

export type TWalletManagerConfig = {
  ethereum?: boolean;
  solana?: boolean;
};

export class CrossPlatformWalletManager {
  readonly wallets: Partial<Record<WalletType, WalletInterface>> = {};

  readonly stamper: CrossPlatformWalletStamper;
  readonly signer: CrossPlatformWalletSigner;

  constructor(cfg: TWalletManagerConfig) {
    if (cfg.ethereum) {
      this.wallets[WalletType.Ethereum] = new EthereumWallet();
    }
    if (cfg.solana) {
      this.wallets[WalletType.Solana] = new SolanaWallet();
    }

    this.stamper = new CrossPlatformWalletStamper(this.wallets);
    this.signer = new CrossPlatformWalletSigner(this.wallets);
  }

  async init(): Promise<void> {
    await this.stamper.init();
  }

  async getProviders(chain?: WalletType): Promise<WalletProvider[]> {
    if (chain) {
      const wallet = this.wallets[chain];
      if (!wallet) throw new Error(`Wallet for ${chain} not initialized`);
      return await wallet.getProviders();
    }

    const providersArrays = await Promise.all(
      Object.values(this.wallets).map((wallet) => wallet.getProviders()),
    );
    return providersArrays.flat();
  }
}
