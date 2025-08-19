import {
  SignIntent,
  WalletProvider,
  WalletInterface,
  WalletInterfaceType,
  SwitchableChain,
  Chain,
} from "@types";

export interface CrossPlatformWalletConnectorInterface {
  sign(
    message: string | Uint8Array,
    walletProvider: WalletProvider,
    intent: SignIntent,
  ): Promise<string>;
}

export class CrossPlatformWalletConnector
  implements CrossPlatformWalletConnectorInterface
{
  /**
   * Constructs a CrossPlatformWalletConnector.
   *
   * - Validates that at least one wallet interface is provided.
   * - Stores the provided mapping of wallet interfaces.
   *
   * @param wallets - A partial mapping of wallet interfaces by type.
   * @throws {Error} If no wallet interfaces are provided.
   */
  constructor(
    private readonly wallets: Partial<
      Record<WalletInterfaceType, WalletInterface>
    >,
  ) {
    if (!Object.keys(wallets).length) {
      throw new Error(
        "Cannot create WalletConnector: no wallet interfaces provided",
      );
    }
  }

  /**
   * Connects the wallet account for the given provider.
   *
   * @param provider - The wallet provider to connect.
   * @returns A promise that resolves once the wallet account is connected.
   */
  async connectWalletAccount(provider: WalletProvider): Promise<void> {
    const wallet = this.wallets[provider.interfaceType];

    if (!wallet) {
      throw new Error(`Wallet for ${provider.interfaceType} not initialized`);
    }

    await wallet.connectWalletAccount(provider);
  }

  /**
   * Disconnects the wallet account for the given provider.
   *
   * @param provider - The wallet provider to disconnect.
   * @returns A promise that resolves once the wallet account is disconnected.
   */
  async disconnectWalletAccount(provider: WalletProvider): Promise<void> {
    const wallet = this.wallets[provider.interfaceType];

    if (!wallet) {
      throw new Error(`Wallet for ${provider.interfaceType} not initialized`);
    }

    await wallet.disconnectWalletAccount(provider);
  }

  /**
   * Switches the chain for an EVM-compatible wallet provider (native or WalletConnect).
   *
   * - Only supported for wallet providers on the Ethereum namespace.
   * - Native (extension) wallets:
   *   - If `chainOrId` is a hex string and the wallet doesn't support it, the switch will fail.
   *   - If `chainOrId` is a `SwitchableChain` object, the wallet will attempt to switch; if the chain
   *     is unsupported, it will first add the chain (via `wallet_addEthereumChain`) and then retry switching.
   * - WalletConnect wallets:
   *   - Chain support is negotiated up front via namespaces. If the target chain isn't in the session's
   *     `ethereumNamespaces`, the switch will fail. To support a new chain, you must specify it in the walletConfig.
   *
   * @param provider - The EVM-compatible wallet provider to switch chains for.
   * @param chainOrId - The target chain ID (hex string) or full chain config (`SwitchableChain`).
   * @returns A promise that resolves once the chain switch is complete.
   * @throws {Error} If the provider is not Ethereum-based or doesn't support switching.
   */
  async switchChain(
    provider: WalletProvider,
    chainOrId: string | SwitchableChain,
  ): Promise<void> {
    if (provider.chainInfo.namespace !== Chain.Ethereum) {
      throw new Error("Only Ethereum wallets support chain switching");
    }

    const wallet = this.wallets[provider.interfaceType];
    if (!wallet?.switchChain) {
      throw new Error(
        `Wallet ${provider.interfaceType} doesn’t support switching chains`,
      );
    }

    return wallet.switchChain(provider, chainOrId);
  }

  /**
   * Signs a payload using the appropriate wallet based on the provider.
   *
   * @param payload - The payload to be signed.
   * @param walletProvider - The wallet provider used for signing.
   * @param intent - The signing intent (e.g., message, transaction).
   * @returns A promise that resolves to a hex string (signature or tx hash).
   * @throws {Error} If the wallet is not initialized.
   */
  async sign(
    payload: string,
    walletProvider: WalletProvider,
    intent: SignIntent,
  ): Promise<string> {
    const wallet = this.wallets[walletProvider.interfaceType];

    if (!wallet) {
      throw new Error(
        `Wallet for ${walletProvider.interfaceType} not initialized`,
      );
    }

    return wallet.sign(payload, walletProvider, intent);
  }
}
