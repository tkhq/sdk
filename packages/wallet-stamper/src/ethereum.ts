import {
  EthereumWalletInterface,
  WalletProvider,
  WalletProviderInfo,
  WalletRpcProvider,
  WalletType,
} from "./types";
import {
  recoverPublicKey,
  hashMessage,
  Hex,
  Address,
  EIP1193Provider,
} from "viem";
import "viem/window";
import { WalletStamperError } from "./errors";

import { compressRawPublicKey } from "@turnkey/crypto";
import { asEip1193 } from "./utils";
import { decodeBase64urlToString } from "@turnkey/encoding";

/**
 * Abstract class representing a base Ethereum wallet.
 * This class is used for stamping requests with an Ethereum wallet.
 *
 * To use this class, extend it and implement the `signMessage` method
 * to provide a custom signing function. The `signMessage` method should
 * return a promise that resolves to a hexadecimal string representing
 * the signature of the provided message.
 */
export abstract class BaseEthereumWallet implements EthereumWalletInterface {
  readonly type: WalletType.Ethereum = WalletType.Ethereum;

  /**
   * Abstract method to sign a message.
   * Must be implemented by subclasses to provide a custom signing function.
   *
   * @param message - The message to be signed, either as a string or a Hex.
   * @param provider - Optional Ethereum provider to use for signing.
   * @returns A promise that resolves to a Hex string representing the signature.
   */
  abstract signMessage(
    message: string | Hex,
    provider: WalletRpcProvider,
  ): Promise<Hex>;

  /**
   * Retrieves the public key associated with the wallet.
   *
   * @param provider - Optional Ethereum provider to use for signing.
   * @returns A promise that resolves to a string representing the compressed public key.
   */
  async getPublicKey(provider: WalletRpcProvider): Promise<string> {
    const message = "GET_PUBLIC_KEY";
    const signature = await this.signMessage(message, provider);
    return getCompressedPublicKey(signature, message);
  }

  /**
   * Retrieves the Ethereum provider from the window object.
   *
   * @returns The WalletProvider instance.
   *
   * This method checks if the Ethereum provider is available in the
   * window object and throws an error if not found.
   */
  async getProviders(): Promise<WalletProvider[]> {
    const discovered: WalletProvider[] = [];

    type AnnounceEvent = CustomEvent<{
      info: WalletProviderInfo;
      provider: WalletRpcProvider;
    }>;

    const providerPromises: Promise<void>[] = [];

    const handler = (ev: AnnounceEvent): void => {
      const { provider, info } = ev.detail;

      const promise = (async () => {
        let connectedAddresses: string[] = [];

        try {
          const accounts = await (provider as any).request?.({
            method: "eth_accounts",
          });

          if (Array.isArray(accounts)) {
            connectedAddresses = accounts;
          }
        } catch {
          // we silentlyt fail and just use empty array if not connected or errored
        }

        discovered.push({
          type: WalletType.Ethereum,
          info,
          provider,
          connectedAddresses,
        });
      })();

      providerPromises.push(promise);
    };

    window.addEventListener(
      "eip6963:announceProvider",
      handler as EventListener,
    );
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    window.removeEventListener(
      "eip6963:announceProvider",
      handler as EventListener,
    );

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
    const wallet = asEip1193(provider);
    await getAccount(wallet);
  }

  async disconnectWalletAccount(provider: WalletRpcProvider): Promise<void> {
    const wallet = asEip1193(provider);
    await wallet.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
  }
}

/**
 * EthereumWallet class extends the BaseEthereumWallet to provide
 * specific implementations for Ethereum-based wallets.
 *
 * This class is responsible for signing messages using the Ethereum
 * provider available in the browser (e.g., MetaMask). It interacts
 * with the Ethereum provider to request account access and sign
 * messages.
 */
export class EthereumWallet extends BaseEthereumWallet {
  /**
   * Signs a message using the Ethereum provider.
   *
   * @param message - The message to be signed, either as a string or a Hex.
   * @param provider - Optional Ethereum provider to use.
   * @returns A promise that resolves to a Hex string representing the signature.
   *
   * This method uses the 'personal_sign' method of the Ethereum provider
   * to sign the message with the user's account.
   */
  async signMessage(message: string | Hex, provider: WalletRpcProvider) {
    const selectedProvider = asEip1193(provider);
    const account = await getAccount(selectedProvider);

    const signature = await selectedProvider.request({
      method: "personal_sign" as const,
      params: [message as Hex, account],
    });

    return signature;
  }
}

/**
 * Requests the user's Ethereum account from the provider.
 *
 * @param provider - The EIP1193 provider to request accounts from.
 * @returns A promise that resolves to the user's Ethereum address.
 *
 * This method uses the 'eth_requestAccounts' method of the Ethereum
 * provider to request access to the user's account. It throws an error
 * if no account is connected.
 */
async function getAccount(provider: EIP1193Provider): Promise<Address> {
  const [connectedAccount] = await provider.request({
    method: "eth_requestAccounts",
  });

  if (!connectedAccount) {
    throw new WalletStamperError("No connected account found");
  }

  return connectedAccount;
}

/**
 * Recovers and compresses the SECP256K1 public key from a signed message.
 *
 * @param signature - Hex string of the signature.
 * @param message - The original signed message.
 * @returns A promise that resolves to the compressed public key as a hex string.
 */
export const getCompressedPublicKey = async (
  signature: string,
  message: string,
) => {
  const secp256k1PublicKey = await recoverPublicKey({
    hash: hashMessage(message),
    signature: signature as Hex,
  });
  const publicKey = secp256k1PublicKey.replace("0x", "");
  const publicKeyBytes = Uint8Array.from(Buffer.from(publicKey, "hex"));
  return Buffer.from(compressRawPublicKey(publicKeyBytes)).toString("hex");
};

/**
 * Extracts the public key from a Turnkey stamp header value.
 * @param stampHeaderValue - The base64url encoded stamp header value
 * @returns The public key as a hex string
 */
export function getPublicKeyFromStampHeader(stampHeaderValue: string): string {
  try {
    // we decode the base64url string to get the JSON stamp
    const stampJson = decodeBase64urlToString(stampHeaderValue);

    // we parse the JSON to get the stamp object
    const stamp = JSON.parse(stampJson) as {
      publicKey: string;
      scheme: string;
      signature: string;
    };

    return stamp.publicKey;
  } catch (error) {
    throw new Error(
      `Failed to extract public key from stamp header: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
