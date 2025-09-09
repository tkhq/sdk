import type { Wallet as SWSWallet } from "@wallet-standard/base";
import { getWallets } from "@wallet-standard/app";
import bs58 from "bs58";

import {
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
} from "@turnkey/encoding";
import {
  Chain,
  SignIntent,
  SolanaWalletInterface,
  WalletInterfaceType,
  WalletProvider,
  WalletRpcProvider,
} from "@types";

/**
 * Abstract base class for Solana wallet implementations using Wallet Standard.
 *
 * Provides shared logic for:
 * - Provider discovery via `@wallet-standard/app` (`getWallets()`).
 * - Connecting via `standard:connect` and disconnecting via `standard:disconnect`.
 * - Public key retrieval from the wallet's account address (base58 → hex).
 */
export abstract class BaseSolanaWallet implements SolanaWalletInterface {
  readonly interfaceType = WalletInterfaceType.Solana;

  abstract sign(
    message: string | Uint8Array,
    provider: WalletProvider,
    intent: SignIntent,
  ): Promise<string>;

  /**
   * Retrieves the ed25519 public key for the active account as hex (no 0x prefix).
   *
   * - Ensures the wallet is connected (calls `standard:connect` if needed).
   * - Decodes the Wallet Standard account address (base58) to raw bytes.
   *
   * @param provider - The wallet provider to use.
   * @returns Hex-encoded ed25519 public key (no 0x prefix).
   * @throws {Error} If no account is available.
   */
  getPublicKey = async (provider: WalletProvider): Promise<string> => {
    const wallet = asSolana(provider);
    await connectAccount(wallet);
    const account = wallet.accounts[0];
    if (!account) {
      throw new Error("No account in wallet");
    }
    const rawBytes = bs58.decode(account.address);
    return uint8ArrayToHexString(rawBytes);
  };

  /**
   * Discovers Solana-capable Wallet Standard providers.
   *
   * - Uses `getWallets().get()` and filters wallets with at least one `chains` entry
   *   starting with `"solana:"`.
   * - For each wallet, collects branding info and any currently connected addresses.
   *
   * @returns A list of discovered Solana `WalletProvider`s (may be empty).
   */
  getProviders = async (): Promise<WalletProvider[]> => {
    const discovered: WalletProvider[] = [];
    const walletsApi = getWallets();
    const providers = walletsApi
      .get()
      .filter((w) => w.chains.some((c) => c.startsWith("solana:")));

    await Promise.all(
      providers.map(async (wallet) => {
        let connectedAddresses: string[] = [];
        try {
          connectedAddresses =
            wallet.accounts?.map((a: any) => a.address) ?? [];
        } catch {
          connectedAddresses = [];
        }

        discovered.push({
          interfaceType: WalletInterfaceType.Solana,
          chainInfo: {
            namespace: Chain.Solana,
          },
          info: { name: wallet.name, icon: wallet.icon },
          provider: wallet as WalletRpcProvider,
          connectedAddresses,
        });
      }),
    );

    return discovered;
  };

  /**
   * Connects the wallet account, prompting the user if necessary.
   *
   * - Calls `standard:connect` only if no accounts are present. This will prompt the user to connect their wallet.
   *
   * @param provider - The wallet provider to connect.
   * @returns A promise that resolves once the wallet has ≥ 1 account.
   * @throws {Error} If the wallet does not implement `standard:connect`.
   */
  connectWalletAccount = async (provider: WalletProvider): Promise<void> => {
    const wallet = asSolana(provider);
    await connectAccount(wallet);
  };

  /**
   * Disconnects the wallet account using Wallet Standard.
   *
   * - Calls `standard:disconnect` if implemented.
   * - Throws if the wallet does not implement `standard:disconnect`.
   *
   * @param provider - The wallet provider to disconnect.
   * @returns A promise that resolves once the wallet disconnects.
   * @throws {Error} If `standard:disconnect` is not supported by the wallet.
   */
  disconnectWalletAccount = async (provider: WalletProvider): Promise<void> => {
    const wallet = asSolana(provider);
    const disconnectFeature = wallet.features["standard:disconnect"] as
      | { disconnect: () => Promise<void> }
      | undefined;
    if (disconnectFeature) {
      await disconnectFeature.disconnect();
    } else {
      throw new Error("Wallet does not support standard:disconnect");
    }
  };
}

/**
 * Signs a message or transaction with the connected Solana wallet.
 *
 * - Ensures the wallet is connected (may prompt via `standard:connect` if its not).
 * - `SignMessage` → `solana:signMessage` (returns hex signature).
 * - `SignTransaction` → `solana:signTransaction` (returns hex signature).
 *
 * @param payload - UTF-8 string (for message) or hex string (for transaction bytes).
 * @param provider - The wallet provider to use.
 * @param intent - The signing intent.
 * @returns Hex-encoded signature (no 0x prefix).
 * @throws {Error} If the provider lacks required features or intent is unsupported.
 */
export class SolanaWallet extends BaseSolanaWallet {
  sign = async (
    payload: string,
    provider: WalletProvider,
    intent: SignIntent,
  ): Promise<string> => {
    const wallet = asSolana(provider);
    await connectAccount(wallet);
    const account = wallet.accounts[0];
    if (!account) throw new Error("No account available");

    switch (intent) {
      case SignIntent.SignMessage: {
        const signFeature = wallet.features["solana:signMessage"] as
          | {
              signMessage: (args: {
                account: typeof account;
                message: Uint8Array;
              }) => Promise<
                readonly { signedMessage: Uint8Array; signature: Uint8Array }[]
              >;
            }
          | undefined;

        if (!signFeature)
          throw new Error("Provider does not support solana:signMessage");

        const data = new TextEncoder().encode(payload);
        const results = await signFeature.signMessage({
          account,
          message: data,
        });
        if (!results?.length || !results[0]?.signature) {
          throw new Error("No signature returned from signMessage");
        }

        return uint8ArrayToHexString(results[0].signature);
      }

      case SignIntent.SignTransaction: {
        const signFeature = wallet.features["solana:signTransaction"] as
          | {
              signTransaction: (args: {
                account: typeof account;
                transaction: Uint8Array;
              }) => Promise<readonly { signature: Uint8Array }[]>;
            }
          | undefined;

        if (!signFeature)
          throw new Error("Provider does not support solana:signTransaction");

        const data = uint8ArrayFromHexString(payload);
        const results = await signFeature.signTransaction({
          account,
          transaction: data,
        });
        if (!results?.length || !results[0]?.signature) {
          throw new Error("No signature returned from signTransaction");
        }

        return uint8ArrayToHexString(results[0].signature);
      }

      default:
        throw new Error(`Unsupported sign intent: ${intent}`);
    }
  };
}

/**
 * Casts a WalletRpcProvider to a Wallet Standard Solana wallet.
 *
 * - Validates presence of the Wallet Standard `features` map and `solana:signMessage`.
 * - Use this before calling Solana-specific features (signMessage, signTransaction, etc.).
 *
 * @param provider - The wallet provider to cast.
 * @returns The Wallet Standard wallet object.
 * @throws {Error} If the provider is not a Wallet Standard Solana wallet.
 */
const asSolana = (provider: WalletProvider): SWSWallet => {
  if (
    provider.provider &&
    "features" in provider.provider &&
    "solana:signMessage" in (provider.provider as any).features
  ) {
    return provider.provider as SWSWallet;
  }
  throw new Error("Expected a Wallet-Standard provider (Solana wallet)");
};

/**
 * Ensures the given Wallet Standard wallet has at least one connected account.
 *
 * - If accounts already exist, resolves immediately.
 * - If not, attempts `standard:connect`, which may prompt the user.
 *
 * @param wallet - The Wallet Standard wallet to connect.
 * @returns A promise that resolves once the wallet has ≥ 1 account.
 * @throws {Error} If the wallet does not implement `standard:connect`.
 */
const connectAccount = async (wallet: SWSWallet): Promise<void> => {
  if (wallet.accounts.length) return;

  const stdConnect = wallet.features["standard:connect"] as
    | { connect: () => Promise<{ accounts: readonly unknown[] }> }
    | undefined;

  if (stdConnect) {
    await stdConnect.connect();
    return;
  }

  throw new Error(
    "Wallet is not connected and does not implement standard:connect",
  );
};
