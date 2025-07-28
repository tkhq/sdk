import {
  SignIntent,
  WalletProvider,
  WalletRpcProvider,
  WalletType,
} from "@types";

/**
 * Base interface for wallet functionalities common across different blockchain chains.
 * @interface BaseWalletInterface
 * @property {function(string): Promise<string>} signMessage - Signs a message and returns the hex signature as a string.
 * @property {function(): Promise<string>} getPublicKey - Retrieves the public key as a string.
 */
export interface BaseWalletInterface {
  type: WalletType;
  sign: (
    message: string,
    provider: WalletRpcProvider,
    intent: SignIntent,
  ) => Promise<string>;
  getPublicKey: (provider: WalletRpcProvider) => Promise<string>;
  getProviders: () => Promise<WalletProvider[]>;
  connectWalletAccount: (provider: WalletRpcProvider) => Promise<void>;
  disconnectWalletAccount: (provider: WalletRpcProvider) => Promise<void>;
}

/**
 * Solana wallets can directly access the public key without needing a signed message.
 * @interface SolanaWalletInterface
 * @extends BaseWalletInterface
 * @property {function(): string} getPublicKey - Returns the public key, which is the ED25519 hex encoded public key from your Solana wallet public key.
 * @property {'solana'} type - The type of the wallet.
 */
export interface SolanaWalletInterface extends BaseWalletInterface {
  type: WalletType.Solana;
}

/**
 * Ethereum wallets require a signed message to derive the public key.
 *
 * @remarks This is the SECP256K1 public key of the Ethereum wallet, not the address.
 * This requires that the wallet signs a message in order to derive the public key.
 *
 * @interface EthereumWalletInterface
 * @extends BaseWalletInterface
 * @property {function(): Promise<string>} getPublicKey - Returns the public key, which is the SECP256K1 hex encoded public key from your Ethereum wallet.
 * @property {'ethereum'} type - The type of the wallet.
 */
export interface EthereumWalletInterface extends BaseWalletInterface {
  type: WalletType.Ethereum;
}

export interface SolanaWalletInterface extends BaseWalletInterface {
  type: WalletType.Solana;
}

/**
 * Union type for wallet interfaces, supporting both Solana and Ethereum wallets.
 * @typedef {SolanaWalletInterface | EthereumWalletInterface} WalletInterface
 */
export type WalletInterface = SolanaWalletInterface | EthereumWalletInterface;
