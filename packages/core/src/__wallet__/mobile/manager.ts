import { CrossPlatformWalletStamper } from "../stamper";
import { CrossPlatformWalletConnector } from "../connector";
import {
  TWalletManagerConfig,
  WalletInterface,
  WalletProvider,
  WalletInterfaceType,
  Chain,
} from "@types";
import { WalletConnectClient } from "../wallet-connect/client";
import { WalletConnectWallet } from "../wallet-connect/base";

export class MobileWalletManager {
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
   * Constructs a MobileWalletManager that only uses WalletConnect.
   *
   * - Determines enabled chains based on provided namespaces for Ethereum and Solana.
   * - Initializes WalletConnect wallet interface and maps it to supported chains.
   * - Optionally enables stamping and connecting flows based on feature flags that live in the cfg.
   * - Sets up `CrossPlatformWalletStamper` and `CrossPlatformWalletConnector` if auth or connecting features are enabled.
   *
   * @param cfg - Wallet manager configuration (we only use WalletConnect fields).
   */
  constructor(cfg: TWalletManagerConfig) {
    const ethereumNamespaces =
      cfg.chains.ethereum?.walletConnectNamespaces ?? [];
    const solanaNamespaces = cfg.chains.solana?.walletConnectNamespaces ?? [];

    const enableWalletConnectEvm = ethereumNamespaces.length > 0;
    const enableWalletConnectSol = solanaNamespaces.length > 0;

    const enableWalletConnect =
      enableWalletConnectEvm || enableWalletConnectSol;

    if (cfg.walletConnect && enableWalletConnect) {
      this.wcClient = new WalletConnectClient();
      const wcUnified = new WalletConnectWallet(this.wcClient);

      this.wallets[WalletInterfaceType.WalletConnect] = wcUnified;

      // add async init step to the initializer queue
      this.initializers.push(() =>
        wcUnified.init({ ethereumNamespaces, solanaNamespaces }),
      );

      // register WalletConnect as a wallet interface for each enabled chain
      if (enableWalletConnectEvm) {
        this.addChainInterface(
          Chain.Ethereum,
          WalletInterfaceType.WalletConnect,
        );
      }
      if (enableWalletConnectSol) {
        this.addChainInterface(Chain.Solana, WalletInterfaceType.WalletConnect);
      }
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
   * - First initializes the low-level WalletConnect client with the provided config.
   * - Then initializes higher-level wallet interface `WalletConnectWallet` using registered async initializers.
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
   * - Aggregates providers across all registered wallet interfaces.
   * - Filters WalletConnect results to match the specified chain.
   *
   * @param chain - Optional chain to filter providers by.
   * @returns A promise that resolves to an array of `WalletProvider` objects.
   * @throws {Error} If no wallet interface is registered for the given chain.
   */
  async getProviders(chain?: Chain): Promise<WalletProvider[]> {
    if (chain) {
      const interfaceType = this.chainToInterfaces[chain];
      if (!interfaceType || interfaceType.length === 0) {
        throw new Error(`No wallet supports chain: ${chain}`);
      }

      const walletsToQuery = interfaceType
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
