import {
  WalletType,
  WalletProvider,
  WalletRpcProvider,
  SolanaWalletInterface,
} from "./types";

import { WalletStamperError } from "./errors";
import { Wallet as SWSWallet } from "@wallet-standard/base";
import { getWallets } from "@wallet-standard/app";
import { asSolana } from "./utils";
import { PublicKey } from "@solana/web3.js";

declare global {
  interface Window {
    solana?: SWSWallet;
  }

  interface Navigator {
    wallets?: {
      get: () => SWSWallet[];
    };
  }
}

/**
 * Abstract class representing a base Solana wallet.
 * This class is used for stamping requests with a Solana wallet.
 *
 * To use this class, extend it and implement the `signMessage` method
 * to provide a custom signing function. The `signMessage` method should
 * return a promise that resolves to a hexadecimal string representing
 * the signature of the provided message.
 */
export abstract class BaseSolanaWallet implements SolanaWalletInterface {
  readonly type: WalletType.Solana = WalletType.Solana;

  /**
   * Abstract method to sign a message.
   * Must be implemented by subclasses to provide a custom signing function.
   *
   * @param message - The message to be signed, either as a string or Uint8Array.
   * @param provider - Optional Solana provider to use for signing.
   * @returns A promise that resolves to a hex string representing the signature.
   */
  abstract signMessage(
    message: string | Uint8Array,
    provider: WalletRpcProvider,
  ): Promise<string>;

  /**
   * Retrieves the public key associated with the wallet.
   *
   * @param provider - Optional Solana provider to use.
   * @returns A promise that resolves to the base58-encoded public key string.
   *
   * This method accesses the first available account on the wallet and returns its address.
   */
  async getPublicKey(provider: WalletRpcProvider): Promise<string> {
    const wallet = asSolana(provider);
    await ensureConnected(wallet);
    const account = wallet.accounts[0];
    if (!account) {
      throw new WalletStamperError("No account in wallet");
    }

    // Convert from Base58 to hex
    const publicKeyBytes = new PublicKey(account.address).toBytes();
    const publicKeyHex = Buffer.from(publicKeyBytes).toString("hex");

    return publicKeyHex;
  }

  /**
   * Retrieves available Solana wallet providers using Wallet Standard.
   *
   * @returns An array of WalletProvider objects representing Solana wallets.
   */
  getProviders(): WalletProvider[] {
    const walletsApi = getWallets();
    return walletsApi
      .get()
      .filter((w) => w.chains.some((c) => c.startsWith("solana:")))
      .map((w) => ({
        type: WalletType.Solana,
        info: { name: w.name, icon: w.icon },
        provider: w,
      }));
  }
}

/**
 * SolanaWallet class extends the BaseSolanaWallet to provide
 * specific implementations for Solana-based wallets.
 *
 * This class is responsible for signing messages using the
 * Solana provider available in the browser. It interacts with
 * the Wallet Standard provider to connect and sign messages.
 */
export class SolanaWallet extends BaseSolanaWallet {
  /**
   * Signs a message using the Solana provider.
   *
   * @param message - The message to be signed, either as a string or Uint8Array.
   * @param provider - Optional Solana provider to use.
   * @returns A promise that resolves to a hex string representing the signature.
   *
   * This method uses the 'solana:signMessage' feature of the wallet to sign messages.
   */
  async signMessage(
    message: string | Uint8Array,
    provider: WalletRpcProvider,
  ): Promise<string> {
    const wallet = asSolana(provider);
    await ensureConnected(wallet);

    const data =
      typeof message === "string" ? new TextEncoder().encode(message) : message;

    const solanaSignMessage = wallet.features["solana:signMessage"] as
      | {
          signMessage: (args: {
            account: (typeof wallet.accounts)[0];
            message: Uint8Array;
          }) => Promise<
            readonly {
              signedMessage: Uint8Array;
              signature: Uint8Array;
            }[]
          >;
        }
      | undefined;

    if (!solanaSignMessage) {
      throw new WalletStamperError(
        "No supported signing methods found. Tried: solana:signMessage",
      );
    }

    const account = wallet.accounts[0];
    if (!account) throw new WalletStamperError("No account available");

    const results = await solanaSignMessage.signMessage({
      account,
      message: data,
    });

    if (!results?.length || !results[0]?.signature) {
      throw new WalletStamperError("No signature returned from signing");
    }

    return Array.from(results[0].signature)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}

/**
 * Ensures the wallet is connected using Wallet Standard's `standard:connect` feature.
 *
 * @param w - The Wallet Standard wallet instance.
 * @returns A promise that resolves once the wallet is connected.
 *
 * Throws an error if no account is connected and the wallet doesn't support `standard:connect`.
 */
async function ensureConnected(w: SWSWallet): Promise<void> {
  if (w.accounts.length) return;

  const stdConnect = w.features["standard:connect"] as
    | { connect: () => Promise<{ accounts: readonly unknown[] }> }
    | undefined;

  if (stdConnect) {
    await stdConnect.connect();
    return;
  }

  throw new WalletStamperError(
    "Wallet is not connected and does not implement standard:connect",
  );
}
