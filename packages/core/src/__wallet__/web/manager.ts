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
   *
   * - Enables native Ethereum and/or Solana wallet support if configured.
   * - Enables WalletConnect support for Ethereum and/or Solana chains if namespaces are provided.
   * - Sets up `CrossPlatformWalletStamper` and `CrossPlatformWalletConnector` if auth or connecting features are enabled.
   *
   * @param cfg - Wallet manager configuration.
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

    if (cfg.features?.connecting) {
      this.connector = new CrossPlatformWalletConnector(this.wallets);
    }
  }

  /**
   * Initializes WalletConnect components and any registered wallet interfaces.
   *
   * - Initializes the low-level WalletConnect client with the provided config.
   * - Runs any registered async wallet initializers (currently only `WalletConnectWallet`).
   *
   * @param cfg - Wallet manager configuration used for initializing the WalletConnect client.
   */
  async init(cfg: TWalletManagerConfig): Promise<void> {
    if (this.wcClient) {
      await this.wcClient.init(cfg.walletConnect!);
    }

    // we initialize the high-level WalletConnectWallet
    // we do this because we can't init this inside the constructor since it's async
    await Promise.all(this.initializers.map((fn) => fn()));
  }

  /**
   * Retrieves available wallet providers, optionally filtered by chain.
   *
   * - If a chain is specified, filters wallet interfaces that support that chain.
   * - Aggregates providers across all wallet interfaces and filters WalletConnect results accordingly.
   *
   * @param chain - Optional chain to filter providers by (e.g., Ethereum, Solana).
   * @returns A promise that resolves to an array of `WalletProvider` objects.
   * @throws {Error} If no wallet interface is registered for the given chain.
   */
  async getProviders(chain?: Chain): Promise<WalletProvider[]> {
    if (chain) {
      const interfaceTypes = this.chainToInterfaces[chain];
      if (!interfaceTypes || interfaceTypes.length === 0)
        throw new Error(`No wallet supports chain: ${chain}`);

      const walletsToQuery = interfaceTypes
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
   * Registers a wallet interface type as supporting a specific blockchain chain.
   *
   * @param chain - Chain (e.g., Ethereum, Solana).
   * @param interfaceType - Wallet interface type to associate with the chain.
   */
  private addChainInterface = (
    chain: Chain,
    interfaceType: WalletInterfaceType,
  ) => {
    if (!this.chainToInterfaces[chain]) this.chainToInterfaces[chain] = [];
    this.chainToInterfaces[chain]!.push(interfaceType);
  };
}
