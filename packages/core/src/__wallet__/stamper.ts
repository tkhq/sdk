import {
  SignIntent,
  type WalletInterface,
  type TStamp,
  type TStamper,
  type WalletProvider,
  WalletInterfaceType,
} from "@types";
import {
  stringToBase64urlString,
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
} from "@turnkey/encoding";
import type { Hex } from "viem";
import { isEthereumWallet, isSolanaWallet } from "@utils";

const SIGNATURE_SCHEME_TK_API_SECP256K1_EIP191 =
  "SIGNATURE_SCHEME_TK_API_SECP256K1_EIP191";
const SIGNATURE_SCHEME_TK_API_ED25519 = "SIGNATURE_SCHEME_TK_API_ED25519";
const STAMP_HEADER_NAME = "X-Stamp";

interface WalletContext {
  wallet: WalletInterface;
  stamper: WalletStamper;
  provider?: WalletProvider;
}

type ContextMap = Partial<Record<WalletInterfaceType, WalletContext>>;

export class CrossPlatformWalletStamper implements TStamper {
  private readonly ctx: ContextMap = {};
  private activeInterfaceType?: WalletInterfaceType;

  constructor(wallets: Partial<Record<WalletInterfaceType, WalletInterface>>) {
    for (const [interfaceType, wallet] of Object.entries(wallets)) {
      const typedInterface = interfaceType as WalletInterfaceType;
      this.ctx[typedInterface] = {
        wallet,
        stamper: new WalletStamper(wallet),
      };
    }
  }

  async init(): Promise<void> {
    if (!Object.keys(this.ctx).length) {
      throw new Error("No interfaces initialized in WalletStamper");
    }
  }

  async stamp(
    payload: string,
    interfaceType: WalletInterfaceType = this.defaultInterface(),
    provider?: WalletProvider,
  ): Promise<TStamp> {
    const ctx = this.getCtx(interfaceType);
    const selectedProvider = provider ?? ctx.provider;

    if (!selectedProvider) {
      throw new Error(
        `Could not find a provider for interface '${interfaceType}'.`,
      );
    }

    return ctx.stamper.stamp(payload, selectedProvider);
  }

  async getPublicKey(
    interfaceType: WalletInterfaceType = this.defaultInterface(),
    provider: WalletProvider,
  ): Promise<string> {
    return this.getCtx(interfaceType).wallet.getPublicKey(provider);
  }

  setProvider(
    interfaceType: WalletInterfaceType,
    provider: WalletProvider,
  ): void {
    this.getCtx(interfaceType).provider = provider;
    this.activeInterfaceType = interfaceType;
  }

  getWalletInterface(
    interfaceType: WalletInterfaceType = this.defaultInterface(),
  ): WalletInterface {
    return this.getCtx(interfaceType).wallet;
  }

  private defaultInterface(): WalletInterfaceType {
    if (this.activeInterfaceType) {
      return this.activeInterfaceType;
    }

    const initializedInterfaces = Object.keys(
      this.ctx,
    ) as WalletInterfaceType[];

    if (initializedInterfaces.includes(WalletInterfaceType.Ethereum)) {
      return WalletInterfaceType.Ethereum;
    }

    if (initializedInterfaces.includes(WalletInterfaceType.Solana)) {
      return WalletInterfaceType.Solana;
    }

    if (initializedInterfaces.includes(WalletInterfaceType.WalletConnect)) {
      return WalletInterfaceType.WalletConnect;
    }

    throw new Error("No interfaces initialized");
  }

  private getCtx(interfaceType: WalletInterfaceType): WalletContext {
    const ctx = this.ctx[interfaceType];

    if (!ctx) {
      throw new Error(`Interface '${interfaceType}' not initialised`);
    }

    return ctx;
  }
}

export class WalletStamper {
  constructor(private readonly wallet: WalletInterface) {}

  async stamp(payload: string, provider: WalletProvider): Promise<TStamp> {
    let signature: string;
    let publicKey: string;

    try {
      signature = await this.wallet.sign(
        payload,
        provider,
        SignIntent.SignMessage,
      );
    } catch (error) {
      throw new Error(`Failed to sign the message: ${error}`);
    }

    const scheme = isSolanaWallet(provider)
      ? SIGNATURE_SCHEME_TK_API_ED25519
      : SIGNATURE_SCHEME_TK_API_SECP256K1_EIP191;

    try {
      if (isEthereumWallet(provider)) {
        const { recoverPublicKey, hashMessage } = await import("viem");
        const { compressRawPublicKey, toDerSignature } = await import(
          "@turnkey/crypto"
        );

        const rawPublicKey = await recoverPublicKey({
          hash: hashMessage(payload),
          signature: signature as Hex,
        });

        const publicKeyHex = rawPublicKey.startsWith("0x")
          ? rawPublicKey.slice(2)
          : rawPublicKey;

        const publicKeyBytes = uint8ArrayFromHexString(publicKeyHex);
        const publicKeyBytesCompressed = compressRawPublicKey(publicKeyBytes);

        publicKey = uint8ArrayToHexString(publicKeyBytesCompressed);
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
