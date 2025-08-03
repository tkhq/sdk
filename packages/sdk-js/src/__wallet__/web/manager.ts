import { WebWalletStamper } from "./stamper";
import { WebWalletConnector } from "./signer";
import { EthereumWallet } from "./connector/ethereum";
import { SolanaWallet } from "./connector/solana";
import {
  TWalletManagerConfig,
  WalletInterface,
  WalletProvider,
  WalletType,
} from "@types";
import { WalletConnectEthereumWallet } from "./connector/wallet-connect/ethereum";
import { WalletConnectSolanaWallet } from "./connector/wallet-connect/solana";
import { WalletConnectClient } from "./connector/wallet-connect/base";

export class WebWalletManager {
  private initializers: Array<() => Promise<void>> = [];
  private wcClient?: WalletConnectClient;

  readonly wallets: Partial<Record<WalletType, WalletInterface>> = {};
  readonly stamper: WebWalletStamper;
  readonly connector: WebWalletConnector;

  constructor(cfg: TWalletManagerConfig) {
    if (cfg.walletConnect) {
      this.wcClient = new WalletConnectClient();
    }

    if (cfg.ethereum) {
      this.wallets[WalletType.Ethereum] = new EthereumWallet();

      // if walletConnect is configured, add the WalletConnectEthereumWallet
      if (this.wcClient) {
        const ethWC = new WalletConnectEthereumWallet(this.wcClient);
        this.wallets[WalletType.EthereumWalletConnect] = ethWC;
        this.initializers.push(() => ethWC.init());
      }
    }

    if (cfg.solana) {
      this.wallets[WalletType.Solana] = new SolanaWallet();

      // if walletConnect is configured, add the WalletConnectSolanaWallet
      if (this.wcClient) {
        const solWC = new WalletConnectSolanaWallet(this.wcClient);
        this.wallets[WalletType.SolanaWalletConnect] = solWC;
        this.initializers.push(() => solWC.init());
      }
    }

    this.stamper = new WebWalletStamper(this.wallets);

    this.connector = new WebWalletConnector(this.wallets);
  }

  async init(cfg: TWalletManagerConfig): Promise<void> {
    if (this.wcClient) {
      await this.wcClient.init(cfg.walletConnect!);
    }

    await Promise.all(this.initializers.map((fn) => fn()));

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
