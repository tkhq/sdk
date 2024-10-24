import { stringToBase64urlString } from "@turnkey/encoding";
import { WalletStamperError } from "./errors";
import type { TStamper, WalletInterface, TStamp } from "./types";
import {
  SIGNATURE_SCHEME_TK_API_SECP256K1,
  SIGNATURE_SCHEME_TK_API_ED25519,
  WALLET_TYPE_SOLANA,
  STAMP_HEADER_NAME,
} from "./constants";

// WalletStamper class implements the TStamper interface to use wallet's signature and public key
// to authenticate requests to Turnkey.
export class WalletStamper implements TStamper {
  private wallet: WalletInterface;

  constructor(wallet: WalletInterface) {
    this.wallet = wallet;
  }

  async stamp(payload: string): Promise<TStamp> {
    let signature: string;
    try {
      signature = await this.wallet.signMessage(payload);
    } catch (error) {
      throw new WalletStamperError("Failed to sign the message", error);
    }

    // Determine the signature scheme based on the wallet type.
    const scheme =
      this.wallet.type === WALLET_TYPE_SOLANA
        ? SIGNATURE_SCHEME_TK_API_ED25519
        : SIGNATURE_SCHEME_TK_API_SECP256K1;

    let publicKey: string;
    try {
      publicKey = await this.wallet.getPublicKey();
    } catch (error) {
      throw new WalletStamperError("Failed to recover public key", error);
    }

    const stamp = {
      publicKey,
      scheme,
      signature,
    };

    // Return the stamp as a base64url encoded JSON string in the header format.
    return {
      stampHeaderName: STAMP_HEADER_NAME,
      stampHeaderValue: stringToBase64urlString(JSON.stringify(stamp)),
    };
  }
}
