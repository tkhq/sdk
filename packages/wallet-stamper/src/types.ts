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
 * Base interface for wallet functionalities common across different blockchain technologies.
 * @interface BaseWalletInterface
 * @property {function(string): Promise<string>} signMessage - Signs a message and returns the hex signature as a string.
 */
export interface BaseWalletInterface {
  signMessage: (message: string) => Promise<string>;
}

/**
 * Solana wallets can directly access the public key without needing a signed message.
 * @interface SolanaWalletInterface
 * @extends BaseWalletInterface
 * @property {function(): string} recoverPublicKey - Recovers the public key, which is the ED25519 hex encoded public key from your Solana wallet public key.
 * @property {'solana'} type - The type of the wallet.
 */
export interface SolanaWalletInterface extends BaseWalletInterface {
  recoverPublicKey: () => string;
  type: "solana";
}

/**
 * EVM wallets require a signed message to derive the public key.
 * @interface EvmWalletInterface
 * @extends BaseWalletInterface
 * @property {function(string, string): Promise<string>} recoverPublicKey - Public key recovery from signature and message, returning a hex encoded SECP256K1 public key as a string.
 * @property {'evm'} type - The type of the wallet.
 */
export interface EvmWalletInterface extends BaseWalletInterface {
  recoverPublicKey: (message: string, signature: string) => Promise<string>;
  type: "evm";
}

/**
 * Union type for wallet interfaces, supporting both Solana and EVM wallets.
 * @typedef {SolanaWalletInterface | EvmWalletInterface} WalletInterface
 */
export type WalletInterface = SolanaWalletInterface | EvmWalletInterface;
