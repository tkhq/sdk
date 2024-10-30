/**
 * @typedef {Object} TStamp
 * @property {'X-Stamp'} stampHeaderName - The name of the stamp header.
 * @property {string} stampHeaderValue - The value of the stamp header.
 */
export type TStamp = {
  stampHeaderName: "X-Stamp";
  stampHeaderValue: string;
};

/**
 * @interface TStamper
 * @property {function(string): Promise<TStamp>} stamp - Function to stamp an input string.
 */
export interface TStamper {
  stamp: (input: string) => Promise<TStamp>;
}

/**
 * Base interface for wallet functionalities common across different blockchain chains.
 * @interface BaseWalletInterface
 * @property {function(string): Promise<string>} signMessage - Signs a message and returns the hex signature as a string.
 * @property {function(): Promise<string>} getPublicKey - Retrieves the public key as a string.
 */
export interface BaseWalletInterface {
  signMessage: (message: string) => Promise<string>;
  getPublicKey: () => Promise<string>;
}

/**
 * Solana wallets can directly access the public key without needing a signed message.
 * @interface SolanaWalletInterface
 * @extends BaseWalletInterface
 * @property {function(): string} getPublicKey - Returns the public key, which is the ED25519 hex encoded public key from your Solana wallet public key.
 * @property {'solana'} type - The type of the wallet.
 */
export interface SolanaWalletInterface extends BaseWalletInterface {
  type: "solana";
}

/**
 * EVM wallets require a signed message to derive the public key.
 *
 * @remarks This is the SECP256K1 public key of the EVM wallet, not the address.
 * This requires that the wallet signs a message in order to derive the public key.
 *
 * @interface EvmWalletInterface
 * @extends BaseWalletInterface
 * @property {function(): Promise<string>} getPublicKey - Returns the public key, which is the SECP256K1 hex encoded public key from your EVM wallet.
 * @property {'evm'} type - The type of the wallet.
 */
export interface EvmWalletInterface extends BaseWalletInterface {
  type: "evm";
}

/**
 * Union type for wallet interfaces, supporting both Solana and EVM wallets.
 * @typedef {SolanaWalletInterface | EvmWalletInterface} WalletInterface
 */
export type WalletInterface = SolanaWalletInterface | EvmWalletInterface;

/**
 * Enum representing the type of wallet the user is stamping with.
 */
export enum WalletType {
  Ethereum = "evm",
  Solana = "solana",
}
