import {
  WalletRpcProvider,
  SolanaWalletInterface,
  WalletType,
  WalletProvider,
  WalletProviderInfo,
  SignIntent,
} from "./types";

import { WalletStamperError } from "./errors";
import { Wallet as SWSWallet } from "@wallet-standard/base";
import { getWallets } from "@wallet-standard/app";
import { asSolana } from "./utils";
import bs58 from "bs58";
import { uint8ArrayToHexString } from "@turnkey/encoding";

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
  abstract sign(
    message: string | Uint8Array,
    provider: WalletRpcProvider,
    intent: SignIntent,
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
    await connectAccount(wallet);
    const account = wallet.accounts[0];
    if (!account) {
      throw new WalletStamperError("No account in wallet");
    }

    // Convert from Base58 to hex
    const rawBytes = bs58.decode(account.address);
    const publicKeyHex = uint8ArrayToHexString(rawBytes);

    return publicKeyHex;
  }

  /**
   * Retrieves available Solana wallet providers using Wallet Standard.
   *
   * @returns An array of WalletProvider objects representing Solana wallets.
   */
  async getProviders(): Promise<WalletProvider[]> {
    const discovered: WalletProvider[] = [];
    const walletsApi = getWallets();
    const providers = walletsApi
      .get()
      .filter((w) => w.chains.some((c) => c.startsWith("solana:")));

    const providerPromises: Promise<void>[] = [];

    for (const wallet of providers) {
      const promise = (async () => {
        let connectedAddresses: string[] = [];

        try {
          connectedAddresses =
            wallet.accounts?.map((a: any) => a.address) ?? [];
        } catch {
          // we silentlyt fail and just use empty array if not connected or errored
          connectedAddresses = [];
        }

        const info: WalletProviderInfo = {
          name: wallet.name,
          icon: wallet.icon,
        };

        discovered.push({
          type: WalletType.Solana,
          info,
          provider: wallet as WalletRpcProvider,
          connectedAddresses,
        });
      })();

      providerPromises.push(promise);
    }

    await Promise.all(providerPromises);
    return discovered;
  }

  /**
   * Ensures the wallet is connected using Wallet Standard's `standard:connect` feature.
   *
   * @param w - The Wallet Standard wallet instance.
   * @returns A promise that resolves once the wallet is connected.
   *
   * Throws an error if no account is connected and the wallet doesn't support `standard:connect`.
   */
  async connectWalletAccount(provider: WalletRpcProvider): Promise<void> {
    const wallet = asSolana(provider);
    await connectAccount(wallet);
  }

  async disconnectWalletAccount(provider: WalletRpcProvider): Promise<void> {
    const wallet = asSolana(provider);
    const disconnectFeature = wallet.features["standard:disconnect"] as
      | { disconnect: () => Promise<void> }
      | undefined;
    if (disconnectFeature) {
      await disconnectFeature.disconnect();
    } else {
      throw new WalletStamperError(
        "Wallet does not support standard:disconnect",
      );
    }
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
  async sign(
    message: string,
    provider: WalletRpcProvider,
    intent: SignIntent,
  ): Promise<string> {
    const wallet = asSolana(provider);
    await connectAccount(wallet);

    const account = wallet.accounts[0];
    if (!account) throw new WalletStamperError("No account available");

    switch (intent) {
      case SignIntent.SignMessage: {
        const signFeature = wallet.features["solana:signMessage"] as
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

        if (!signFeature) {
          throw new WalletStamperError(
            "Provider does not support solana:signMessage",
          );
        }

        const data = new TextEncoder().encode(message);
        const results = await signFeature.signMessage({
          account,
          message: data,
        });
        if (!results?.length || !results[0]?.signature) {
          throw new WalletStamperError(
            "No signature returned from signMessage",
          );
        }

        return Buffer.from(results[0].signature).toString("hex");
      }

      case SignIntent.SignTransaction: {
        const signFeature = wallet.features["solana:signTransaction"] as
          | {
              signTransaction: (args: {
                account: (typeof wallet.accounts)[0];
                transaction: Uint8Array;
              }) => Promise<
                readonly {
                  signature: Uint8Array;
                }[]
              >;
            }
          | undefined;

        if (!signFeature) {
          throw new WalletStamperError(
            "Provider does not support solana:signTransaction",
          );
        }

        const data = uint8ArrayFromHexString(message);
        const results = await signFeature.signTransaction({
          account,
          transaction: data,
        });

        if (!results?.length || !results[0]?.signature) {
          throw new WalletStamperError(
            "No signature returned from signTransaction",
          );
        }

        return Buffer.from(results[0].signature).toString("hex");
      }

      case SignIntent.SignAndSendTransaction: {
        const sendFeature = wallet.features["solana:sendTransaction"] as
          | {
              sendTransaction: (args: {
                account: (typeof wallet.accounts)[0];
                transaction: Uint8Array;
              }) => Promise<
                readonly {
                  signature: string;
                }[]
              >;
            }
          | undefined;

        if (!sendFeature) {
          throw new WalletStamperError(
            "Provider does not support solana:sendTransaction",
          );
        }

        const data = uint8ArrayFromHexString(message);
        const results = await sendFeature.sendTransaction({
          account,
          transaction: data,
        });

        if (!results?.length || !results[0]?.signature) {
          throw new WalletStamperError(
            "No signature returned from sendTransaction",
          );
        }

        return results[0].signature;
      }

      default:
        throw new WalletStamperError(`Unsupported sign intent: ${intent}`);
    }
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
async function connectAccount(w: SWSWallet): Promise<void> {
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
