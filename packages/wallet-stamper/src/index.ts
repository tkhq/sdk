import { stringToBase64urlString } from '@turnkey/encoding';

export type TStamp = {
  stampHeaderName: string;
  stampHeaderValue: string;
};

export interface TStamper {
  stamp: (input: string) => Promise<TStamp>;
}

// Base interface for wallet functionalities common across different blockchain technologies.
export interface BaseWalletInterface {
  signMessage: (message: string) => Promise<string>;
}

// Solana wallets can directly access the public key without needing a signed message.
export interface SolanaWalletInterface extends BaseWalletInterface {
  recoverPublicKey: () => string; // Direct public key recovery without parameters.
  type: 'solana';
}

// EVM wallets require a signed message to derive the public key, reflecting their security model.
export interface EvmWalletInterface extends BaseWalletInterface {
  recoverPublicKey: (signature: string, message: string) => string; // Public key recovery from signature and message.
  type: 'evm';
}

// Union type for wallet interfaces, supporting both Solana and EVM wallets.
export type WalletInterface = SolanaWalletInterface | EvmWalletInterface;

// WalletStamper class implements the TStamper interface to use wallet's signature and public key
// to authenticate requests to Turnkey.
export class WalletStamper implements TStamper {
  private wallet: WalletInterface;

  constructor(wallet: WalletInterface) {
    this.wallet = wallet;
  }

  async stamp(input: string): Promise<TStamp> {
    const signature = await this.wallet.signMessage(input);
    console.log({ signature, input }); // Logging the signature and input for debugging purposes.

    // Determine the signature scheme based on the wallet type.
    const scheme =
      this.wallet.type === 'evm'
        ? 'SIGNATURE_SCHEME_TK_API_P256'
        : 'SIGNATURE_SCHEME_TK_API_ED25519';

    // Recover the public key using the appropriate method based on the wallet type.
    const publicKey =
      this.wallet.type === 'evm'
        ? this.wallet.recoverPublicKey(signature, input)
        : this.wallet.recoverPublicKey();

    const stamp = {
      publicKey,
      scheme,
      signature,
    };

    // Return the stamp as a base64url encoded JSON string in the header format.
    return {
      stampHeaderName: 'X-Stamp',
      stampHeaderValue: stringToBase64urlString(JSON.stringify(stamp)),
    };
  }
}
