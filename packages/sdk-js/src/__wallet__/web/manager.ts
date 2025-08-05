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
  // queue of async initialization functions
  private initializers: Array<() => Promise<void>> = [];

  // WalletConnect client instance
  private wcClient?: WalletConnectClient;

  // mapping of wallet interface types to their wallet instances
  readonly wallets: Partial<Record<WalletInterfaceType, WalletInterface>> = {};

  // maps a blockchain chain to its corresponding wallet interface types
  private chainToInterfaces: Partial<Record<Chain, WalletInterfaceType[]>> = {};

  // responsible for stamping messages using wallets
  readonly stamper: WebWalletStamper;

  // handles signature flows for authentication
  readonly connector: WebWalletConnector;

  /**
   * Constructs a WebWalletManager instance based on the provided configuration.
   * Sets up native wallets and WalletConnect support.
   *
   * @param cfg - Wallet manager configuration including enabled chains and WalletConnect setup.
   */
  constructor(cfg: TWalletManagerConfig) {
    const enableEvm = cfg.ethereum ?? false;
    const enableSol = cfg.solana ?? false;

    // set up native Ethereum wallet support
    if (enableEvm) {
      this.wallets[WalletInterfaceType.Ethereum] = new EthereumWallet();
      this.addChainInterface(Chain.Ethereum, WalletInterfaceType.Ethereum);
    }

    // set up native Solana wallet support
    if (enableSol) {
      this.wallets[WalletInterfaceType.Solana] = new SolanaWallet();
      this.addChainInterface(Chain.Solana, WalletInterfaceType.Solana);
    }

    // if WalletConnect is configured, set it up
    if (cfg.walletConnect) {
      this.wcClient = new WalletConnectClient();
      const wcUnified = new WalletConnectWallet(this.wcClient);

      this.wallets[WalletInterfaceType.WalletConnect] = wcUnified;

      // add async init step to the initializer queue
      this.initializers.push(() =>
        wcUnified.init({ ethereum: enableEvm, solana: enableSol }),
      );

      // register WalletConnect as a wallet interface for each enabled chain
      if (enableEvm)
        this.addChainInterface(
          Chain.Ethereum,
          WalletInterfaceType.WalletConnect,
        );
      if (enableSol)
        this.addChainInterface(Chain.Solana, WalletInterfaceType.WalletConnect);
    }

    this.stamper = new WebWalletStamper(this.wallets);
    this.connector = new WebWalletConnector(this.wallets);
  }

  /**
   * Initializes the wallet manager and all wallet connectors.
   *
   * @param cfg - Wallet manager configuration.
   * @returns A promise that resolves once all wallet initializers have completed.
   */
  async init(cfg: TWalletManagerConfig): Promise<void> {
    if (this.wcClient) {
      await this.wcClient.init(cfg.walletConnect!);
    }

    // Run all wallet-specific initializers
    await Promise.all(this.initializers.map((fn) => fn()));
    await this.stamper.init();
  }

  /**
   * Retrieves available wallet providers based on the configured chains.
   *
   * @param chain - Optional chain to filter providers by.
   * @returns A promise that resolves to an array of wallet providers.
   * @throws If no wallet interface is registered for the given chain.
   */
  async getProviders(chain?: Chain): Promise<WalletProvider[]> {
    if (chain) {
      const ifaceTypes = this.chainToInterfaces[chain];
      if (!ifaceTypes || ifaceTypes.length === 0)
        throw new Error(`No wallet supports chain: ${chain}`);

      const walletsToQuery = ifaceTypes
        .map((iface) => this.wallets[iface])
        .filter(Boolean) as WalletInterface[];

      const providersArrays = await Promise.all(
        walletsToQuery.map((wallet) => wallet.getProviders()),
      );

      return providersArrays.flat();
    }

    // collect all providers from all initialized wallets
    const providersArrays = await Promise.all(
      Object.values(this.wallets).map((wallet) => wallet.getProviders()),
    );

    return providersArrays.flat();
  }

  /**
   * Registers a wallet interface as supporting a specific blockchain chain.
   *
   * @param chain - The blockchain chain (e.g., Ethereum, Solana).
   * @param iface - The wallet interface type (e.g., native, WalletConnect).
   */
  private addChainInterface = (chain: Chain, iface: WalletInterfaceType) => {
    if (!this.chainToInterfaces[chain]) this.chainToInterfaces[chain] = [];
    this.chainToInterfaces[chain]!.push(iface);
  };
}
