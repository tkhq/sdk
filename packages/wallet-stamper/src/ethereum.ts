import { EthereumWalletInterface, WalletType } from "./types";
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
  type: WalletType.Ethereum = WalletType.Ethereum;

  /**
   * Abstract method to sign a message.
   * Must be implemented by subclasses to provide a custom signing function.
   *
   * @param message - The message to be signed, either as a string or a Hex.
   * @returns A promise that resolves to a Hex string representing the signature.
   */
  abstract signMessage(message: string | Hex): Promise<Hex>;

  /**
   * Retrieves the public key associated with the wallet.
   *
   * @returns A promise that resolves to a string representing the compressed public key.
   */
  async getPublicKey(): Promise<string> {
    const message = "GET_PUBLIC_KEY";
    const signature = await this.signMessage(message);
    return getCompressedPublicKey(signature, message);
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
   * @returns A promise that resolves to a Hex string representing the signature.
   *
   * This method uses the 'personal_sign' method of the Ethereum provider
   * to sign the message with the user's account.
   */
  async signMessage(message: string | Hex) {
    const account = await this.getAccount();

    const signature = await this.getProvider().request({
      method: "personal_sign" as const,
      params: [message as Hex, account],
    });

    return signature;
  }

  /**
   * Retrieves the Ethereum provider from the window object.
   *
   * @returns The EIP1193Provider instance.
   *
   * This method checks if the Ethereum provider is available in the
   * window object and throws an error if not found.
   */
  private getProvider(): EIP1193Provider {
    if (!window?.ethereum) {
      throw new WalletStamperError("No ethereum provider found");
    }

    return window.ethereum;
  }

  /**
   * Requests the user's Ethereum account from the provider.
   *
   * @returns A promise that resolves to the user's Ethereum address.
   *
   * This method uses the 'eth_requestAccounts' method of the Ethereum
   * provider to request access to the user's account. It throws an error
   * if no account is connected.
   */
  private async getAccount(): Promise<Address> {
    const provider = this.getProvider();

    const [connectedAccount] = await provider.request({
      method: "eth_requestAccounts",
    });

    if (!connectedAccount) {
      throw new WalletStamperError("No connected account found");
    }

    return connectedAccount;
  }
}

export const getCompressedPublicKey = async (
  signature: Hex,
  message: string
) => {
  const secp256k1PublicKey = await recoverPublicKey({
    hash: hashMessage(message),
    signature: signature as Hex,
  });
  const publicKey = secp256k1PublicKey.replace("0x", "");
  const publicKeyBytes = Uint8Array.from(Buffer.from(publicKey, "hex"));
  return Buffer.from(compressRawPublicKey(publicKeyBytes)).toString("hex");
};
