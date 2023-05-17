import { TurnkeyApi } from "@turnkey/http";
import {
  encodeSecp256k1Signature,
  rawSecp256k1PubkeyToRawAddress,
} from "@cosmjs/amino";
import { fromHex, toBech32 } from "@cosmjs/encoding";
import { Secp256k1, sha256 } from "@cosmjs/crypto";
import {
  type OfflineDirectSigner,
  type AccountData,
  type DirectSignResponse,
  makeSignBytes,
} from "@cosmjs/proto-signing";
import type { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";

// Largely based off `DirectSecp256k1Wallet`:
// https://github.com/cosmos/cosmjs/blob/e8e65aa0c145616ccb58625c32bffe08b46ff574/packages/proto-signing/src/directsecp256k1wallet.ts#LL14C14-L14C35
export class TurnkeyDirectWallet implements OfflineDirectSigner {
  public static async fromTurnkeyPrivateKey(input: {
    privateKeyId: string;
    prefix?: string;
  }): Promise<TurnkeyDirectWallet> {
    const { privateKeyId, prefix = "cosmos" } = input;

    const { compressedPublicKey } = await fetchCompressedPublicKey({
      privateKeyId,
    });

    return new TurnkeyDirectWallet({
      privateKeyId,
      compressedPublicKey,
      prefix,
    });
  }

  readonly privateKeyId: string;
  readonly compressedPublicKey: Uint8Array;
  readonly prefix: string;

  constructor(input: {
    privateKeyId: string;
    compressedPublicKey: Uint8Array;
    prefix: string;
  }) {
    const { privateKeyId, compressedPublicKey, prefix } = input;

    this.privateKeyId = privateKeyId;
    this.compressedPublicKey = compressedPublicKey;
    this.prefix = prefix;
  }

  public async getAccounts(): Promise<readonly AccountData[]> {
    return [
      {
        algo: "secp256k1",
        address: this.address,
        pubkey: this.compressedPublicKey,
      },
    ];
  }

  public async signDirect(
    address: string,
    signDoc: SignDoc
  ): Promise<DirectSignResponse> {
    const signBytes = makeSignBytes(signDoc);
    if (address !== this.address) {
      throw new Error(`Address ${address} not found in wallet`);
    }

    const hashedMessage = sha256(signBytes);

    // TODO: actually implement signing
    console.log(hashedMessage);
    return null as any;
  }

  private get address(): string {
    return toBech32(
      this.prefix,
      rawSecp256k1PubkeyToRawAddress(this.compressedPublicKey)
    );
  }
}

export async function fetchCompressedPublicKey(input: {
  privateKeyId: string;
}): Promise<{ compressedPublicKey: Uint8Array }> {
  const { privateKeyId } = input;

  const keyInfo = await TurnkeyApi.postGetPrivateKey({
    body: {
      organizationId: process.env.ORGANIZATION_ID!,
      privateKeyId,
    },
  });

  const uncompressedPublicKey = keyInfo.privateKey.publicKey;
  const compressedPublicKey = Secp256k1.compressPubkey(
    fromHex(uncompressedPublicKey)
  );

  return { compressedPublicKey };
}
