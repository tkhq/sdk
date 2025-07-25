import type {
  SignIntent,
  WalletType,
  WalletInterface,
  WalletProvider,
} from "@turnkey/wallet-stamper";

export interface WalletSignerInterface {
  sign(
    message: string | Uint8Array,
    walletProvider: WalletProvider,
    intent: SignIntent,
  ): Promise<string>;
}

export class CrossPlatformWalletSigner implements WalletSignerInterface {
  constructor(
    private readonly wallets: Partial<Record<WalletType, WalletInterface>>,
  ) {}

  async connectWalletAccount(provider: WalletProvider): Promise<void> {
    const wallet = this.wallets[provider.type];
    if (!wallet) throw new Error(`Wallet for ${provider.type} not initialized`);
    await wallet.connectWalletAccount(provider.provider);
  }

  async disconnectWalletAccount(provider: WalletProvider): Promise<void> {
    const wallet = this.wallets[provider.type];
    if (!wallet) throw new Error(`Wallet for ${provider.type} not initialized`);
    await wallet.disconnectWalletAccount(provider.provider);
  }

  async sign(
    message: string,
    walletProvider: WalletProvider,
    intent: SignIntent,
  ): Promise<string> {
    const wallet = this.wallets[walletProvider.type];
    if (!wallet)
      throw new Error(`Wallet for ${walletProvider.type} not initialized`);
    return wallet.sign(message, walletProvider.provider, intent);
  }
}

export interface ConnectedWalletInfo {
  provider: WalletProvider;
  addresses: string[];
}
