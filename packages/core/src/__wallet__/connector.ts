import {
  SignIntent,
  WalletProvider,
  WalletInterface,
  WalletInterfaceType,
  SwitchableChain,
  Chain,
} from "@types";

export interface WebWalletConnectorInterface {
  sign(
    message: string | Uint8Array,
    walletProvider: WalletProvider,
    intent: SignIntent,
  ): Promise<string>;
}

export class WebWalletConnector implements WebWalletConnectorInterface {
  constructor(
    private readonly wallets: Partial<
      Record<WalletInterfaceType, WalletInterface>
    >,
  ) {}

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
   * Signs a message using the appropriate wallet based on the provider.
   *
   * @param message - The message to be signed.
   * @param walletProvider - The wallet provider used for signing.
   * @param intent - The signing intent (e.g., message, transaction).
   * @returns A promise that resolves to the hex-encoded signature string.
   */
  async sign(
    message: string,
    walletProvider: WalletProvider,
    intent: SignIntent,
  ): Promise<string> {
    const wallet = this.wallets[walletProvider.interfaceType];

    if (!wallet) {
      throw new Error(
        `Wallet for ${walletProvider.interfaceType} not initialized`,
      );
    }

    return wallet.sign(message, walletProvider, intent);
  }
}
