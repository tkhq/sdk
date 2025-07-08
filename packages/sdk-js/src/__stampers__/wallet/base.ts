import { isWeb, isReactNative } from "@utils";
import {
  EthereumWallet,
  SolanaWallet,
  WalletInterface,
  WalletProvider,
  WalletRpcProvider,
  WalletStamper,
  WalletType,
} from "@turnkey/wallet-stamper";
import { TStamp, TStamper } from "../..";

export type TWalletStamperConfig = {
  ethereum?: boolean;
  solana?: boolean;
};

interface WalletContext {
  wallet: WalletInterface;
  stamper: WalletStamper;

  // we set this later using setProvider()
  provider?: WalletRpcProvider;
}

type ContextMap = Partial<Record<WalletType, WalletContext>>;

export class CrossPlatformWalletStamper implements TStamper {
  private readonly ctx: ContextMap = {};
  private activeChain?: WalletType;

  constructor(private readonly cfg: TWalletStamperConfig) {}

  async init(): Promise<void> {
    if (!isWeb()) {
      if (isReactNative()) {
        throw new Error("WalletStamper isn’t available on React Native (yet)");
      }
      throw new Error("Unsupported runtime");
    }

    const add = (chain: WalletType, wallet: WalletInterface) => {
      this.ctx[chain] = {
        wallet,
        stamper: new WalletStamper(wallet),
      };
    };

    if (this.cfg.ethereum) add(WalletType.Ethereum, new EthereumWallet());
    if (this.cfg.solana) add(WalletType.Solana, new SolanaWallet());

    if (!Object.keys(this.ctx).length) {
      throw new Error("No chains enabled in CrossPlatformWalletStamper config");
    }
  }

  async stamp(
    payload: string,
    chain: WalletType = this.defaultChain(),
    provider?: WalletRpcProvider,
  ): Promise<TStamp> {
    const c = this.getCtx(chain);
    const p = provider ?? c.provider;

    if (!p) {
      throw new Error(`Could not find a provider for chain '${chain}'.`);
    }

    return c.stamper.stamp(payload, p);
  }

  async getPublicKey(
    chain: WalletType = this.defaultChain(),
    provider: WalletRpcProvider,
  ): Promise<string> {
    const c = this.getCtx(chain);
    return c.wallet.getPublicKey(provider);
  }

  getProviders(chain?: WalletType): WalletProvider[] {
    if (chain) {
      return this.getCtx(chain).wallet.getProviders();
    }
    return Object.values(this.ctx).flatMap((c) => c.wallet.getProviders());
  }

  setProvider(chain: WalletType, provider: WalletRpcProvider): void {
    this.getCtx(chain).provider = provider;
    this.activeChain = chain;
  }

  getWalletInterface(chain: WalletType = this.defaultChain()): WalletInterface {
    return this.getCtx(chain).wallet;
  }

  // ETH wins tie-break
  private defaultChain(): WalletType {
    if (this.activeChain) return this.activeChain;
    if (this.cfg.ethereum) return WalletType.Ethereum;
    if (this.cfg.solana) return WalletType.Solana;
    throw new Error("No chains enabled");
  }

  private getCtx(chain: WalletType): WalletContext {
    const c = this.ctx[chain];
    if (!c) throw new Error(`Chain '${chain}' not initialised`);
    return c;
  }
}
