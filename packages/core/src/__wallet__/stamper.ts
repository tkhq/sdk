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
import { isEthereumProvider, isSolanaProvider } from "@utils";

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

  /**
   * Constructs a CrossPlatformWalletStamper.
   *
   * - Validates that at least one wallet interface is provided.
   * - For each wallet interface, creates an internal `WalletStamper` bound to it.
   * - Ensures the stamper instance is always initialized in a usable state.
   *
   * @param wallets - A partial mapping of wallet interfaces by type.
   * @throws {Error} If no wallet interfaces are provided.
   */
  constructor(wallets: Partial<Record<WalletInterfaceType, WalletInterface>>) {
    const walletEntries = Object.entries(wallets).filter(([, w]) =>
      Boolean(w),
    ) as Array<[string, WalletInterface]>;

    if (walletEntries.length === 0) {
      throw new Error(
        "Cannot create WalletStamper: no wallet interfaces provided",
      );
    }

    for (const [interfaceType, wallet] of walletEntries) {
      const typed = interfaceType as WalletInterfaceType;
      this.ctx[typed] = { wallet, stamper: new WalletStamper(wallet) };
    }
  }

  /**
   * Stamps a payload using the specified wallet interface and provider.
   *
   * - Uses the explicitly provided interface and provider if given.
   * - Falls back to the default interface and stored provider otherwise.
   *
   * @param payload - The string payload to sign.
   * @param interfaceType - Optional wallet interface type (defaults to the active or first available).
   * @param provider - Optional provider (defaults to the one set via `setProvider`).
   * @returns A `TStamp` object containing the stamp header name and encoded value.
   * @throws {Error} If no provider is available for the selected interface.
   */
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

  /**
   * Retrieves the public key for the given provider.
   *
   * @param interfaceType - Optional wallet interface type (defaults to the active or first available).
   * @param provider - Wallet provider for which to fetch the public key.
   * @returns A promise resolving to the public key in hex format.
   */
  async getPublicKey(
    interfaceType: WalletInterfaceType = this.defaultInterface(),
    provider: WalletProvider,
  ): Promise<string> {
    return this.getCtx(interfaceType).wallet.getPublicKey(provider);
  }

  /**
   * Sets the active provider for a given wallet interface.
   *
   * - The active provider is used as a fallback in `stamp` if none is passed explicitly.
   *
   * @param interfaceType - Wallet interface type.
   * @param provider - Provider instance to associate with the interface.
   */
  setProvider(
    interfaceType: WalletInterfaceType,
    provider: WalletProvider,
  ): void {
    this.getCtx(interfaceType).provider = provider;
    this.activeInterfaceType = interfaceType;
  }

  /**
   * Determines the default wallet interface to use when none is specified.
   *
   * - Preference order: Active provider > Ethereum > Solana > WalletConnect.
   *
   * @returns The default wallet interface type.
   * @throws {Error} If no wallet interfaces are initialized.
   */
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

  /**
   * Retrieves the internal context for a given wallet interface.
   *
   * @param interfaceType - Wallet interface type.
   * @returns The context including wallet, stamper, and optional provider.
   * @throws {Error} If the interface is not initialized.
   */
  private getCtx(interfaceType: WalletInterfaceType): WalletContext {
    const ctx = this.ctx[interfaceType];

    if (!ctx) {
      throw new Error(`Interface '${interfaceType}' not initialised`);
    }

    return ctx;
  }
}

export class WalletStamper {
  /**
   * Constructs a WalletStamper bound to a single wallet interface.
   *
   * @param wallet - The wallet interface used for signing.
   */
  constructor(private readonly wallet: WalletInterface) {}

  /**
   * Signs a payload and returns a standardized stamp header.
   *
   * - For Ethereum:
   *   - Signs using EIP-191.
   *   - Recovers and compresses the public key.
   *   - Converts the signature into DER format.
   * - For Solana:
   *   - Signs using Ed25519.
   *   - Fetches the public key directly from the wallet.
   *
   * @param payload - The payload to sign.
   * @param provider - The wallet provider used for signing.
   * @returns A `TStamp` containing the header name and base64url-encoded JSON value.
   * @throws {Error} If signing or public key recovery fails.
   */
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

    const scheme = isSolanaProvider(provider)
      ? SIGNATURE_SCHEME_TK_API_ED25519
      : SIGNATURE_SCHEME_TK_API_SECP256K1_EIP191;

    try {
      if (isEthereumProvider(provider)) {
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
