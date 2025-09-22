import type { v1Wallet, v1WalletAccount } from "@turnkey/sdk-types";
import type { EIP1193Provider as EthereumProvider } from "viem";
import type { Wallet as SolanaProvider } from "@wallet-standard/base";
import type { CrossPlatformWalletStamper } from "../__wallet__/stamper";
import type { CrossPlatformWalletConnector } from "../__wallet__/connector";
import type {
  Chain,
  SignIntent,
  WalletInterfaceType,
  WalletSource,
} from "./enums";

/** @internal */
export type SwitchableChain = {
  id: string;
  name: string;
  rpcUrls: string[];
  blockExplorerUrls?: string[];
  iconUrls?: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
};

/** @internal */
export type EvmChainInfo = {
  namespace: Chain.Ethereum;
  chainId: string;
};

/** @internal */
export type SolanaChainInfo = {
  namespace: Chain.Solana;
};

/** @internal */
export type ChainInfo = EvmChainInfo | SolanaChainInfo;

/** @internal */
export interface WalletProviderInfo {
  name: string;
  uuid?: string;
  icon?: string;
  rdns?: string;
}

/** @internal */
export interface WalletConnectProvider {
  request(args: { method: string; params?: any[] }): Promise<unknown>;
  features: {
    "standard:events": {
      on: (event: string, callback: (evt: any) => void) => () => void;
    };
  };
}

/** @internal */
export type WalletRpcProvider =
  | EthereumProvider
  | SolanaProvider
  | WalletConnectProvider;

/** @internal */
export interface WalletProvider {
  interfaceType: WalletInterfaceType;
  chainInfo: ChainInfo;
  info: WalletProviderInfo;
  provider: WalletRpcProvider;
  connectedAddresses: string[];
  uri?: string;
}

/** @internal */
export interface WalletManagerBase {
  getProviders: (chain?: Chain) => Promise<WalletProvider[]>;
  stamper?: CrossPlatformWalletStamper;
  connector?: CrossPlatformWalletConnector;
}

/**
 * Base interface for wallet functionality shared across chains.
 * @internal
 */
export interface BaseWalletInterface {
  interfaceType: WalletInterfaceType;

  /**
   * Sign a payload with the given provider and intent.
   */
  sign: (
    payload: string,
    provider: WalletProvider,
    intent: SignIntent,
  ) => Promise<string>;

  /**
   * Derive or fetch the public key from the given provider.
   */
  getPublicKey: (provider: WalletProvider) => Promise<string>;

  /**
   * Discover providers available to this interface.
   */
  getProviders: () => Promise<WalletProvider[]>;

  /**
   * Connects the specified wallet account.
   */
  connectWalletAccount: (provider: WalletProvider) => Promise<string>;

  /**
   * Disconnects the specified wallet account.
   */
  disconnectWalletAccount: (provider: WalletProvider) => Promise<void>;

  /**
   * Optionally switch the chain for a provider.
   */
  switchChain?: (
    provider: WalletProvider,
    chainOrId: string | SwitchableChain,
  ) => Promise<void>;
}

/**
 * @internal
 * Solana wallets can fetch public key directly (ED25519).
 */
export interface SolanaWalletInterface extends BaseWalletInterface {
  interfaceType: WalletInterfaceType.Solana;
}

/**
 * @internal
 * Ethereum wallets require a signed message to derive the SECP256K1 public key.
 */
export interface EthereumWalletInterface extends BaseWalletInterface {
  interfaceType: WalletInterfaceType.Ethereum;
}

/** @internal */
export interface WalletConnectInterface extends BaseWalletInterface {
  interfaceType: WalletInterfaceType.WalletConnect;
  init: (opts: {
    ethereumNamespaces: string[];
    solanaNamespaces: string[];
  }) => Promise<void>;
}

/**
 * Union of supported wallet behavior interfaces.
 * @internal
 */
export type WalletInterface =
  | SolanaWalletInterface
  | EthereumWalletInterface
  | WalletConnectInterface;

/**
 * Embedded wallet account.
 * @internal
 */
export interface EmbeddedWalletAccount extends v1WalletAccount {
  source: WalletSource.Embedded;
}

/**
 * Connected Ethereum account.
 * @internal
 */
export interface ConnectedEthereumWalletAccount extends v1WalletAccount {
  source: WalletSource.Connected;
  chainInfo: EvmChainInfo;
  isAuthenticator: boolean;
  signMessage: (message: string) => Promise<string>;
  signAndSendTransaction: (unsignedTransaction: string) => Promise<string>;
}

/**
 * Connected Solana account.
 * @internal
 */
export interface ConnectedSolanaWalletAccount extends v1WalletAccount {
  source: WalletSource.Connected;
  chainInfo: SolanaChainInfo;
  isAuthenticator: boolean;
  signMessage: (message: string) => Promise<string>;
  signTransaction: (unsignedTransaction: string) => Promise<string>;
}

/** @internal */
export type ConnectedWalletAccount =
  | ConnectedEthereumWalletAccount
  | ConnectedSolanaWalletAccount;

/** @internal */
export type WalletAccount = EmbeddedWalletAccount | ConnectedWalletAccount;

/**
 * Embedded wallet.
 * @internal
 */
export interface EmbeddedWallet extends v1Wallet {
  source: WalletSource.Embedded;
  accounts: WalletAccount[];
}

/**
 * Connected (external) wallet — MetaMask, Rabby, Phantom, etc.
 * @internal
 */
export interface ConnectedWallet extends v1Wallet {
  source: WalletSource.Connected;
  accounts: WalletAccount[];
}

/** @internal */
export type Wallet = EmbeddedWallet | ConnectedWallet;
