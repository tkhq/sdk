export type TStamp = {
  stampHeaderName: string;
  stampHeaderValue: string;
};

export interface TStamper {
  stamp: (input: string) => Promise<TStamp>;
}

export interface WalletInterface {
  signMessage: (message: string) => Promise<string>;
  recoverPublicKey: (signature: string, message: string) => string;
}

export class WalletStamper implements TStamper {
  private wallet: WalletInterface;

  constructor(wallet: WalletInterface) {
    this.wallet = wallet;
  }

  async stamp(input: string): Promise<TStamp> {
    const signature = await this.wallet.signMessage(input);
    const publicKey = this.wallet.recoverPublicKey(signature, input);

    const stamp = {
      publicKey,
      scheme: 'SIGNATURE_SCHEME_TK_API_P256',
      signature: signature,
    };

    return {
      stampHeaderName: 'X-Stamp',
      stampHeaderValue: signature,
    };
  }
}
