import { CrossPlatformWalletStamper } from "../stamper";
import { CrossPlatformWalletConnector } from "../connector";
import { EthereumWallet } from "./native/ethereum";
import { SolanaWallet } from "./native/solana";
import {
  TWalletManagerConfig,
  WalletInterface,
  WalletProvider,
  WalletInterfaceType,
  Chain,
} from "@types";
import { WalletConnectClient } from "../wallet-connect/client";
import { WalletConnectWallet } from "../wallet-connect/base";

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
  readonly stamper?: CrossPlatformWalletStamper;

  // handles signature flows for authentication
  readonly connector?: CrossPlatformWalletConnector;

  /**
   * Constructs a WebWalletManager instance based on the provided configuration.
   * Sets up native wallets and WalletConnect support.
   *
   * @param cfg - Wallet manager configuration including enabled chains and WalletConnect setup.
   */
  constructor(cfg: TWalletManagerConfig) {
    const enableNativeEvm = cfg.chains.ethereum?.native ?? false;
    const enableNativeSol = cfg.chains.solana?.native ?? false;

    const ethereumNamespaces =
      cfg.chains.ethereum?.walletConnectNamespaces ?? [];
    const solanaNamespaces = cfg.chains.solana?.walletConnectNamespaces ?? [];

    const enableWalletConnectEvm = ethereumNamespaces.length > 0;
    const enableWalletConnectSol = solanaNamespaces.length > 0;

    const enableWalletConnect =
      enableWalletConnectEvm || enableWalletConnectSol;

    // set up native Ethereum wallet support
    if (enableNativeEvm) {
      this.wallets[WalletInterfaceType.Ethereum] = new EthereumWallet();
      this.addChainInterface(Chain.Ethereum, WalletInterfaceType.Ethereum);
    }

    // set up native Solana wallet support
    if (enableNativeSol) {
      this.wallets[WalletInterfaceType.Solana] = new SolanaWallet();
      this.addChainInterface(Chain.Solana, WalletInterfaceType.Solana);
    }

    // if WalletConnect is configured, set it up
    if (cfg.walletConnect && enableWalletConnect) {
      this.wcClient = new WalletConnectClient();
      const wcUnified = new WalletConnectWallet(this.wcClient);

      this.wallets[WalletInterfaceType.WalletConnect] = wcUnified;

      // add async init step to the initializer queue
      this.initializers.push(() =>
        wcUnified.init({ ethereumNamespaces, solanaNamespaces }),
      );

      // register WalletConnect as a wallet interface for each enabled chain
      if (enableWalletConnectEvm)
        this.addChainInterface(
          Chain.Ethereum,
          WalletInterfaceType.WalletConnect,
        );
      if (enableWalletConnectSol)
        this.addChainInterface(Chain.Solana, WalletInterfaceType.WalletConnect);
    }

    if (cfg.features?.auth) {
      this.stamper = new CrossPlatformWalletStamper(this.wallets);
    }

    console.log("config: ", cfg);
    if (cfg.features?.connecting) {
      this.connector = new CrossPlatformWalletConnector(this.wallets);
    }
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
    await this.stamper?.init();
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

      // we still need to filter by chain because WalletConnect can return providers for multiple chains
      return providersArrays
        .flat()
        .filter((p) => p.chainInfo.namespace === chain);
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
