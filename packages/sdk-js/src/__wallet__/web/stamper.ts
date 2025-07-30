import {
  SignIntent,
  type WalletRpcProvider,
  WalletType,
  type WalletInterface,
  type TStamp,
  type TStamper,
} from "@types";
import { stringToBase64urlString } from "@turnkey/encoding";
import type { Hex } from "viem";

const SIGNATURE_SCHEME_TK_API_SECP256K1_EIP191 =
  "SIGNATURE_SCHEME_TK_API_SECP256K1_EIP191";
const SIGNATURE_SCHEME_TK_API_ED25519 = "SIGNATURE_SCHEME_TK_API_ED25519";
const STAMP_HEADER_NAME = "X-Stamp";

interface WalletContext {
  wallet: WalletInterface;
  stamper: WalletStamper;
  provider?: WalletRpcProvider;
}

type ContextMap = Partial<Record<WalletType, WalletContext>>;

export class WebWalletStamper implements TStamper {
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
    if (!Object.keys(this.ctx).length) {
      throw new Error("No chains initialized in WalletStamper");
    }
  }

  async stamp(
    payload: string,
    chain: WalletType = this.defaultChain(),
    provider?: WalletRpcProvider,
  ): Promise<TStamp> {
    const ctx = this.getCtx(chain);
    const selectedProvider = provider ?? ctx.provider;

    if (!selectedProvider) {
      throw new Error(`Could not find a provider for chain '${chain}'.`);
    }

    return ctx.stamper.stamp(payload, selectedProvider);
  }

  async getPublicKey(
    chain: WalletType = this.defaultChain(),
    provider: WalletRpcProvider,
  ): Promise<string> {
    return this.getCtx(chain).wallet.getPublicKey(provider);
  }

  setProvider(chain: WalletType, provider: WalletRpcProvider): void {
    this.getCtx(chain).provider = provider;
    this.activeChain = chain;
  }

  getWalletInterface(chain: WalletType = this.defaultChain()): WalletInterface {
    return this.getCtx(chain).wallet;
  }

  private defaultChain(): WalletType {
    if (this.activeChain) {
      return this.activeChain;
    }

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
    const ctx = this.ctx[chain];

    if (!ctx) {
      throw new Error(`Chain '${chain}' not initialised`);
    }

    return ctx;
  }
}

export class WalletStamper {
  constructor(private readonly wallet: WalletInterface) {}

  async stamp(payload: string, provider: WalletRpcProvider): Promise<TStamp> {
    let signature: string;

    try {
      signature = await this.wallet.sign(
        payload,
        provider,
        SignIntent.SignMessage,
      );
    } catch (error) {
      throw new Error(`Failed to sign the message: ${error}`);
    }

    let publicKey: string;
    const scheme =
      this.wallet.type === WalletType.Solana
        ? SIGNATURE_SCHEME_TK_API_ED25519
        : SIGNATURE_SCHEME_TK_API_SECP256K1_EIP191;

    try {
      if (this.wallet.type === WalletType.Ethereum) {
        const { recoverPublicKey, hashMessage } = await import("viem");
        const { compressRawPublicKey, toDerSignature } = await import(
          "@turnkey/crypto"
        );

        const rawPublicKey = await recoverPublicKey({
          hash: hashMessage(payload),
          signature: signature as Hex,
        });

        const publicKeyBytes = Uint8Array.from(
          Buffer.from(rawPublicKey.replace("0x", ""), "hex"),
        );
        publicKey = Buffer.from(compressRawPublicKey(publicKeyBytes)).toString(
          "hex",
        );

        signature = toDerSignature(signature.replace("0x", ""));
      } else {
        publicKey = await this.wallet.getPublicKey(provider);
      }
    } catch (error) {
      throw new Error(`Failed to recover public key: ${error}`);
    }

    return {
      stampHeaderName: STAMP_HEADER_NAME,
      stampHeaderValue: stringToBase64urlString(
        JSON.stringify({ publicKey, scheme, signature }),
      ),
    };
  }
}
