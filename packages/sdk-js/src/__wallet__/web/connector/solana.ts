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
 * Casts a WalletRpcProvider to a Wallet Standard Solana provider.
 *
 * @param p - The wallet provider to cast.
 * @returns The casted Wallet Standard wallet.
 * @throws If the provider is not a Wallet Standard Solana wallet.
 */
const asSolana = (p: WalletProvider): SWSWallet => {
  if (
    p.provider &&
    "features" in p.provider &&
    "solana:signMessage" in (p.provider as any).features
  ) {
    return p.provider as SWSWallet;
  }
  throw new Error("Expected a Wallet-Standard provider (Solana wallet)");
};

/**
 * Connects the given Solana wallet account.
 *
 * @param w - The wallet to connect.
 * @returns A promise that resolves once the wallet is connected.
 * @throws If the wallet does not support standard:connect.
 */
const connectAccount = async (w: SWSWallet): Promise<void> => {
  if (w.accounts.length) return;

  const stdConnect = w.features["standard:connect"] as
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

/**
 * Abstract class representing a base Solana wallet.
 */
export abstract class BaseSolanaWallet implements SolanaWalletInterface {
  readonly interfaceType = WalletInterfaceType.Solana;

  abstract sign(
    message: string | Uint8Array,
    provider: WalletProvider,
    intent: SignIntent,
  ): Promise<string>;

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

  connectWalletAccount = async (provider: WalletProvider): Promise<void> => {
    const wallet = asSolana(provider);
    await connectAccount(wallet);
  };

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
 * SolanaWallet class implementing signing logic for Solana wallets.
 */
export class SolanaWallet extends BaseSolanaWallet {
  sign = async (
    message: string,
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

        const data = new TextEncoder().encode(message);
        const results = await signFeature.signMessage({
          account,
          message: data,
        });
        if (!results?.length || !results[0]?.signature) {
          throw new Error("No signature returned from signMessage");
        }

        return Buffer.from(results[0].signature).toString("hex");
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

        const data = uint8ArrayFromHexString(message);
        const results = await signFeature.signTransaction({
          account,
          transaction: data,
        });
        if (!results?.length || !results[0]?.signature) {
          throw new Error("No signature returned from signTransaction");
        }

        return Buffer.from(results[0].signature).toString("hex");
      }

      case SignIntent.SignAndSendTransaction: {
        const sendFeature = wallet.features["solana:sendTransaction"] as
          | {
              sendTransaction: (args: {
                account: typeof account;
                transaction: Uint8Array;
              }) => Promise<readonly { signature: string }[]>;
            }
          | undefined;

        if (!sendFeature)
          throw new Error("Provider does not support solana:sendTransaction");

        const data = uint8ArrayFromHexString(message);
        const results = await sendFeature.sendTransaction({
          account,
          transaction: data,
        });
        if (!results?.length || !results[0]?.signature) {
          throw new Error("No signature returned from sendTransaction");
        }

        return results[0].signature;
      }

      default:
        throw new Error(`Unsupported sign intent: ${intent}`);
    }
  };
}
