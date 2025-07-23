import { isWeb, isReactNative } from "@utils";
import {
  WalletInterface,
  WalletRpcProvider,
  WalletStamper,
  WalletType,
} from "@turnkey/wallet-stamper";
import { TStamp, TStamper } from "../..";

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

  constructor(wallets: Partial<Record<WalletType, WalletInterface>>) {
    for (const [chain, wallet] of Object.entries(wallets)) {
      const typedChain = chain as WalletType;
      this.ctx[typedChain] = {
        wallet,
        stamper: new WalletStamper(wallet),
      };
    }
  }

  async init(): Promise<void> {
    if (!isWeb()) {
      if (isReactNative())
        throw new Error("WalletStamper isn’t available on React Native (yet)");
      throw new Error("Unsupported runtime");
    }

    if (!Object.keys(this.ctx).length) {
      throw new Error("No chains initialized in WalletStamper");
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

    const initializedChains = Object.keys(this.ctx) as WalletType[];

    if (initializedChains.includes(WalletType.Ethereum)) {
      return WalletType.Ethereum;
    }

    if (initializedChains.includes(WalletType.Solana)) {
      return WalletType.Solana;
    }

    throw new Error("No chains initialized");
  }

  private getCtx(chain: WalletType): WalletContext {
    const c = this.ctx[chain];
    if (!c) throw new Error(`Chain '${chain}' not initialised`);
    return c;
  }
}
