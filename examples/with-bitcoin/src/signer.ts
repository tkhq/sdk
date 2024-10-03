import type { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

/**
 * Signer which supports P2TR and P2WPKH addresses.
 * Taproot uses Schnorr signatures and tweaks (see below), while P2WPKH uses standard ECDSA.
 *
 * ---------- TAPROOT SPECIFIC EXPLAINER ALERT ----------
 * This is how you'd sign a taproot tx using a local mnemonic. Note the tweakChildNode!
 *   import BIP32Factory from 'bip32';
 *   import * as bip39 from 'bip39';
 *   const mnemonic ='your twelve words mnemonic';
 *   const bip32Path = `m/86'/0'/0'/0/0`;
 *   const seed = await bip39.mnemonicToSeed(mnemonic);
 *   const bip32 = BIP32Factory(ecc);
 *   const rootKey = bip32.fromSeed(seed);
 *   const childNode = rootKey.derivePath(bip32Path);
 *   const tweakedChildNode = childNode.tweak(
 *     bitcoin.crypto.taggedHash('TapTweak', xOnlyPublicKey),
 *   );
 *   psbt.signInput(0, tweakedChildNode);
 * Luckily you won't have to worry about this with Turnkey. Our API tweaks the private key correctly
 * at signing time if the address type is P2TR. See BIP141 for a more thorough explainer on taproot!
 * -------------------------------------------------------
 */
export class TurnkeySigner {
  client: TurnkeyServerSDK;
  publicKey: Buffer;
  address: string;

  /**
   * @param client The turnkey SDK client
   * @param address The Turnkey-derived address in bech32 format (e.g. bc1pdyzj6qxu6q40jdkcslh0uqmnppx4vtg0l0a7kfdccr5833wfjwqqnp949w)
   * @param publicKey public key buffer. To sign P2TR outputs it needs to be the decoded address (`bitcoin.address.fromBech32(address).data`).
   *                  For P2WPKH it should be the key pair's underlying public key buffer, uncompressed.
   */
  constructor(client: TurnkeyServerSDK, address: string, publicKey: Buffer) {
    this.client = client;
    this.address = address;
    this.publicKey = publicKey;
  }

  async sign(hash: Buffer, _lowrR: boolean): Promise<Buffer> {
    const { r, s } = await this.client.apiClient().signRawPayload({
      signWith: this.address,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NO_OP",
      payload: hash.toString("hex"),
    });
    return Buffer.from(r + s, "hex");
  }

  async signSchnorr(hash: Buffer): Promise<Buffer> {
    const { r, s } = await this.client.apiClient().signRawPayload({
      signWith: this.address,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NO_OP",
      payload: hash.toString("hex"),
    });

    return Buffer.from(r + s, "hex");
  }
}
