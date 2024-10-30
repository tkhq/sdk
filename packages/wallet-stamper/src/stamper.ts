import { stringToBase64urlString } from "@turnkey/encoding";
import { WalletStamperError } from "./errors";
import {
  type TStamper,
  type WalletInterface,
  type TStamp,
  WalletType,
} from "./types";
import {
  SIGNATURE_SCHEME_TK_API_SECP256K1,
  SIGNATURE_SCHEME_TK_API_ED25519,
  WALLET_TYPE_SOLANA,
  STAMP_HEADER_NAME,
} from "./constants";
import { hashMessage, keccak256, toHex, type Hex } from "viem";

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
      if (this.wallet.type === WalletType.Ethereum) {
        const { recoverPublicKey } = await import("viem");
        const { compressRawPublicKey, toDerSignature } = await import(
          "@turnkey/crypto"
        );
        const secp256k1PublicKey = await recoverPublicKey({
          hash: keccak256(toHex(payload)),
          signature: signature as Hex,
        });
        publicKey = secp256k1PublicKey.replace("0x", "");
        const publicKeyBytes = Uint8Array.from(Buffer.from(publicKey, "hex"));
        publicKey = Buffer.from(compressRawPublicKey(publicKeyBytes)).toString(
          "hex"
        );
        publicKey = await this.wallet.getPublicKey();
        signature = toDerSignature(signature.replace("0x", ""));
      } else {
        publicKey = await this.wallet.getPublicKey();
      }
    } catch (error) {
      throw new WalletStamperError("Failed to recover public key", error);
    }

    const stamp = {
      publicKey,
      scheme,
      signature,
    };
    console.log({
      stamp,
      walletType: this.wallet.type,
      payload,
      hashedPayload: keccak256(toHex(payload)),
    });
    // Return the stamp as a base64url encoded JSON string in the header format.
    return {
      stampHeaderName: STAMP_HEADER_NAME,
      stampHeaderValue: stringToBase64urlString(JSON.stringify(stamp)),
    };
  }
}
