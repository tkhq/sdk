import {
  recoverPublicKey,
  hashMessage,
  Hex,
  Address,
  EIP1193Provider,
  toHex,
} from "viem";
import { Transaction } from "ethers";
import { compressRawPublicKey } from "@turnkey/crypto";
import {
  Chain,
  EthereumWalletInterface,
  SignIntent,
  SwitchableChain,
  WalletInterfaceType,
  WalletProvider,
  WalletProviderInfo,
  WalletRpcProvider,
} from "@types";
import {
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
} from "@turnkey/encoding";

/**
 * Abstract base class for Ethereum wallet implementations.
 *
 * Provides shared logic for:
 * - Provider discovery via EIP-6963
 * - Connecting and disconnecting wallets
 * - Recovering compressed public keys
 */
export abstract class BaseEthereumWallet implements EthereumWalletInterface {
  readonly interfaceType = WalletInterfaceType.Ethereum;

  /**
   * Signs a message using the specified wallet provider.
   *
   * @param message - The message to be signed, as a string or hex.
   * @param provider - The wallet provider to use for signing.
   * @param intent - The intent of the signature (e.g. message signing or transaction sending).
   * @returns A promise resolving to a hex-encoded signature string.
   */
  abstract sign(
    message: string | Hex,
    provider: WalletProvider,
    intent: SignIntent,
  ): Promise<Hex>;

  /**
   * Retrieves the compressed public key by signing a known message.
   *
   * @param provider - The wallet provider to use.
   * @returns A promise that resolves to the compressed public key (hex-encoded).
   */
  getPublicKey = async (provider: WalletProvider): Promise<string> => {
    const message = "GET_PUBLIC_KEY";
    const signature = await this.sign(
      message,
      provider,
      SignIntent.SignMessage,
    );
    return getCompressedPublicKey(signature, message);
  };

  /**
   * Discovers EIP-1193 providers using the EIP-6963 standard.
   *
   * @returns A promise that resolves to a list of available wallet providers.
   */
  getProviders = async (): Promise<WalletProvider[]> => {
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

        // we default to Ethereum mainnet
        let chainId = "0x1";

        try {
          const accounts = await (provider as any).request?.({
            method: "eth_accounts",
          });
          if (Array.isArray(accounts)) connectedAddresses = accounts;

          chainId = await (provider as any).request({
            method: "eth_chainId",
          });
        } catch {
          // fail silently
        }

        discovered.push({
          interfaceType: WalletInterfaceType.Ethereum,
          chainInfo: {
            namespace: Chain.Ethereum,
            chainId,
          },
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
  };

  /**
   * Ensures the wallet account is connected.
   *
   * @param provider - The wallet provider to use.
   * @returns A promise that resolves once the account is connected.
   */
  connectWalletAccount = async (provider: WalletProvider): Promise<void> => {
    const wallet = asEip1193(provider);
    await getAccount(wallet);
  };

  /**
   * Disconnects the wallet account by revoking permissions.
   *
   * @param provider - The wallet provider to disconnect.
   * @returns A promise that resolves once the permissions are revoked.
   */
  disconnectWalletAccount = async (provider: WalletProvider): Promise<void> => {
    const wallet = asEip1193(provider);
    await wallet.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
  };

  async switchChain(
    provider: WalletProvider,
    chainOrId: string | SwitchableChain,
  ): Promise<void> {
    if (provider.chainInfo.namespace !== Chain.Ethereum) {
      throw new Error("Only EVM wallets can switch chains");
    }

    const wallet = asEip1193(provider);
    const chainId = typeof chainOrId === "string" ? chainOrId : chainOrId.id;

    try {
      // first we just try switching
      await wallet.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId }],
      });
    } catch (err: any) {
      // if the error is not “chain not found”
      // we just re-throw it
      if (err.code !== 4902) {
        throw err;
      }

      // no metadata was provided so we throw an error
      // telling them to pass it in
      if (typeof chainOrId === "string") {
        throw new Error(
          `Chain ${chainId} not recognized. ` +
            `If you want to add it, call switchChain with a SwitchableChain object.`,
        );
      }

      // we have full metadata and can add the chain and switch
      const { name, rpcUrls, blockExplorerUrls, iconUrls, nativeCurrency } =
        chainOrId;

      // add the chain
      await wallet.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId,
            chainName: name,
            rpcUrls,
            blockExplorerUrls,
            iconUrls,
            nativeCurrency,
          },
        ],
      });

      // then switch again
      await wallet.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId }],
      });
    }
  }
}

/**
 * EthereumWallet implementation using EIP-1193 compatible providers.
 *
 * Handles message signing and transaction submission.
 */
export class EthereumWallet extends BaseEthereumWallet {
  /**
   * Signs a message or sends a transaction depending on intent.
   *
   * @param message - The message or raw transaction to be signed.
   * @param provider - The wallet provider to use.
   * @param intent - Signing intent (SignMessage or SignAndSendTransaction).
   * @returns A promise that resolves to a hex string (signature or tx hash).
   */
  sign = async (
    message: string,
    provider: WalletProvider,
    intent: SignIntent,
  ): Promise<Hex> => {
    const selectedProvider = asEip1193(provider);
    const account = await getAccount(selectedProvider);

    switch (intent) {
      case SignIntent.SignMessage:
        return await selectedProvider.request({
          method: "personal_sign",
          params: [message as Hex, account],
        });

      case SignIntent.SignAndSendTransaction:
        const tx = Transaction.from(message);
        const txParams = {
          from: account,
          to: tx.to?.toString() as Hex,
          value: toHex(tx.value),
          gas: toHex(tx.gasLimit),
          maxFeePerGas: toHex(tx.maxFeePerGas ?? 0n),
          maxPriorityFeePerGas: toHex(tx.maxPriorityFeePerGas ?? 0n),
          nonce: toHex(tx.nonce),
          chainId: toHex(tx.chainId),
          data: (tx.data?.toString() as Hex) ?? "0x",
        };

        return await selectedProvider.request({
          method: "eth_sendTransaction",
          params: [txParams],
        });

      default:
        throw new Error(`Unsupported sign intent: ${intent}`);
    }
  };
}

/**
 * Retrieves the active Ethereum account from a provider.
 *
 * @param provider - EIP-1193 compliant provider.
 * @returns A promise resolving to the connected Ethereum address.
 * @throws If no connected account is found.
 */
const getAccount = async (provider: EIP1193Provider): Promise<Address> => {
  const [connectedAccount] = await provider.request({
    method: "eth_requestAccounts",
  });
  if (!connectedAccount) throw new Error("No connected account found");
  return connectedAccount;
};

/**
 * Recovers and compresses the public key from a signed message.
 *
 * @param signature - The signature as a hex string.
 * @param message - The original signed message.
 * @returns A promise resolving to the compressed public key (hex-encoded).
 */
const getCompressedPublicKey = async (
  signature: string,
  message: string,
): Promise<string> => {
  const secp256k1PublicKey = await recoverPublicKey({
    hash: hashMessage(message),
    signature: signature as Hex,
  });
  const publicKeyHex = secp256k1PublicKey.startsWith("0x")
    ? secp256k1PublicKey.slice(2)
    : secp256k1PublicKey;

  const publicKeyBytes = uint8ArrayFromHexString(publicKeyHex);
  const publicKeyBytesCompressed = compressRawPublicKey(publicKeyBytes);

  return uint8ArrayToHexString(publicKeyBytesCompressed);
};

/**
 * Validates and casts a WalletRpcProvider to an EIP-1193 provider.
 *
 * @param p - The wallet RPC provider.
 * @returns A valid EIP1193 provider.
 * @throws If the provider does not implement the request() method.
 */
const asEip1193 = (p: WalletProvider): EIP1193Provider => {
  if (p.provider && typeof (p.provider as any).request === "function") {
    return p.provider as EIP1193Provider;
  }
  throw new Error("Expected an EIP-1193 provider (Ethereum wallet)");
};
