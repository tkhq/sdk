import { stringToBase64urlString } from '@turnkey/encoding';

export type TStamp = {
  stampHeaderName: string;
  stampHeaderValue: string;
};

export interface TStamper {
  stamp: (input: string) => Promise<TStamp>;
}

interface BaseWalletInterface {
  signMessage: (message: string) => Promise<string>;
}

interface SolanaWalletInterface extends BaseWalletInterface {
  recoverPublicKey: () => string;
  type: 'solana';
}

interface EvmWalletInterface extends BaseWalletInterface {
  recoverPublicKey: (signature: string, message: string) => string;
  type: 'evm';
}

export type WalletInterface = SolanaWalletInterface | EvmWalletInterface;
export class WalletStamper implements TStamper {
  private wallet: WalletInterface;

  constructor(wallet: WalletInterface) {
    this.wallet = wallet;
  }

  async stamp(input: string): Promise<TStamp> {
    const signature = await this.wallet.signMessage(input);
    console.log({ signature, input });
    const scheme =
      this.wallet.type === 'evm'
        ? 'SIGNATURE_SCHEME_TK_API_P256'
        : 'SIGNATURE_SCHEME_TK_API_ED25519';

    const publicKey =
      this.wallet.type === 'evm'
        ? this.wallet.recoverPublicKey(signature, input)
        : this.wallet.recoverPublicKey();

    const stamp = {
      publicKey,
      scheme,
      signature,
    };

    return {
      stampHeaderName: 'X-Stamp',
      stampHeaderValue: stringToBase64urlString(JSON.stringify(stamp)),
    };
  }
}
