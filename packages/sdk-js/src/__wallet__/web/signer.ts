import {
  SignIntent,
  WalletProvider,
  WalletType,
  WalletInterface,
} from "@types";

export interface WebWalletSignerInterface {
  sign(
    message: string | Uint8Array,
    walletProvider: WalletProvider,
    intent: SignIntent,
  ): Promise<string>;
}

export class WebWalletSigner implements WebWalletSignerInterface {
  constructor(
    private readonly wallets: Partial<Record<WalletType, WalletInterface>>,
  ) {}

  /**
   * Connects the wallet account for the given provider.
   *
   * @param provider - The wallet provider to connect.
   * @returns A promise that resolves once the wallet account is connected.
   */
  async connectWalletAccount(provider: WalletProvider): Promise<void> {
    const wallet = this.wallets[provider.type];

    if (!wallet) {
      throw new Error(`Wallet for ${provider.type} not initialized`);
    }

    await wallet.connectWalletAccount(provider.provider);
  }

  /**
   * Disconnects the wallet account for the given provider.
   *
   * @param provider - The wallet provider to disconnect.
   * @returns A promise that resolves once the wallet account is disconnected.
   */
  async disconnectWalletAccount(provider: WalletProvider): Promise<void> {
    const wallet = this.wallets[provider.type];

    if (!wallet) {
      throw new Error(`Wallet for ${provider.type} not initialized`);
    }

    await wallet.disconnectWalletAccount(provider.provider);
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
    const wallet = this.wallets[walletProvider.type];

    if (!wallet) {
      throw new Error(`Wallet for ${walletProvider.type} not initialized`);
    }

    return wallet.sign(message, walletProvider.provider, intent);
  }
}
