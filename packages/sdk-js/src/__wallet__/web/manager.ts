import { WebWalletStamper } from "./stamper";
import { WebWalletConnector } from "./signer";
import { EthereumWallet } from "./connector/ethereum";
import { SolanaWallet } from "./connector/solana";
import {
  TWalletManagerConfig,
  WalletInterface,
  WalletProvider,
  WalletInterfaceType,
  Chain,
} from "@types";
import { WalletConnectClient } from "./connector/wallet-connect/client";
import { WalletConnectWallet } from "./connector/wallet-connect/base";

export class WebWalletManager {
  private initializers: Array<() => Promise<void>> = [];
  private wcClient?: WalletConnectClient;

  readonly wallets: Partial<Record<WalletInterfaceType, WalletInterface>> = {};
  private chainToInterface: Partial<Record<Chain, WalletInterfaceType>> = {};

  readonly stamper: WebWalletStamper;
  readonly connector: WebWalletConnector;

  constructor(cfg: TWalletManagerConfig) {
    const enableEvm = cfg.ethereum ?? false;
    const enableSol = cfg.solana ?? false;

    if (enableEvm) {
      this.wallets[WalletInterfaceType.Ethereum] = new EthereumWallet();
      this.chainToInterface[Chain.Ethereum] = WalletInterfaceType.Ethereum;
    }

    if (enableSol) {
      this.wallets[WalletInterfaceType.Solana] = new SolanaWallet();
      this.chainToInterface[Chain.Solana] = WalletInterfaceType.Solana;
    }

    if (cfg.walletConnect) {
      this.wcClient = new WalletConnectClient();

      const wcUnified = new WalletConnectWallet(this.wcClient);
      this.wallets[WalletInterfaceType.WalletConnect] = wcUnified;
      this.initializers.push(() =>
        wcUnified.init({ ethereum: enableEvm, solana: enableSol }),
      );

      if (enableEvm)
        this.chainToInterface[Chain.Ethereum] =
          WalletInterfaceType.WalletConnect;
      if (enableSol)
        this.chainToInterface[Chain.Solana] = WalletInterfaceType.WalletConnect;
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
  async getProviders(chain?: Chain): Promise<WalletProvider[]> {
    if (chain) {
      const ifaceType = this.chainToInterface[chain];
      if (!ifaceType) throw new Error(`No wallet supports chain: ${chain}`);
      const wallet = this.wallets[ifaceType];
      if (!wallet) throw new Error(`Wallet for ${chain} not initialized`);
      return await wallet.getProviders();
    }

    const providersArrays = await Promise.all(
      Object.values(this.wallets).map((wallet) => wallet.getProviders()),
    );

    return providersArrays.flat();
  }
}
