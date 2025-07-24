import type {
  SignMode,
  WalletType,
  WalletInterface,
  WalletProvider,
} from "@turnkey/wallet-stamper";

export interface WalletSignerInterface {
  signMessage(
    message: string | Uint8Array,
    walletProvider: WalletProvider,
    mode: SignMode,
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

  async signMessage(
    message: string,
    walletProvider: WalletProvider,
    mode: SignMode,
  ): Promise<string> {
    const wallet = this.wallets[walletProvider.type];
    if (!wallet)
      throw new Error(`Wallet for ${walletProvider.type} not initialized`);
    return wallet.signMessage(message, walletProvider.provider, mode);
  }
}

export interface ConnectedWalletInfo {
  provider: WalletProvider;
  addresses: string[];
}
