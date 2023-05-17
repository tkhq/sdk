import { TurnkeyActivityError, TurnkeyApi } from "@turnkey/http";
import {
  encodeSecp256k1Signature,
  rawSecp256k1PubkeyToRawAddress,
} from "@cosmjs/amino";
import { fromHex, toHex, toBech32 } from "@cosmjs/encoding";
import { Secp256k1, sha256, ExtendedSecp256k1Signature } from "@cosmjs/crypto";
import {
  type OfflineDirectSigner,
  type AccountData,
  type DirectSignResponse,
  makeSignBytes,
} from "@cosmjs/proto-signing";
import type { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { refineNonNull } from "./shared";

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
    const signature = await this._signImpl(hashedMessage);

    const signatureBytes = new Uint8Array([
      ...signature.r(32),
      ...signature.s(32),
    ]);
    const stdSignature = encodeSecp256k1Signature(
      this.compressedPublicKey,
      signatureBytes
    );

    return {
      signed: signDoc,
      signature: stdSignature,
    };
  }

  private get address(): string {
    return toBech32(
      this.prefix,
      rawSecp256k1PubkeyToRawAddress(this.compressedPublicKey)
    );
  }

  // Largely based off `Secp256k1.createSignature(...)`
  // https://github.com/cosmos/cosmjs/blob/e8e65aa0c145616ccb58625c32bffe08b46ff574/packages/crypto/src/secp256k1.ts#L67
  private async _signImpl(
    messageHash: Uint8Array
  ): Promise<ExtendedSecp256k1Signature> {
    if (messageHash.length === 0) {
      throw new Error("Message hash must not be empty");
    }
    if (messageHash.length > 32) {
      throw new Error("Message hash length must not exceed 32 bytes");
    }

    const { activity } = await TurnkeyApi.postSignRawPayload({
      body: {
        type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD",
        organizationId: process.env.ORGANIZATION_ID!,
        timestampMs: String(Date.now()),
        parameters: {
          privateKeyId: this.privateKeyId,
          payload: toHex(messageHash),
          encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
          hashFunction: "HASH_FUNCTION_NO_OP",
        },
      },
    });

    const { id, status, type } = activity;

    if (activity.status !== "ACTIVITY_STATUS_COMPLETED") {
      throw new TurnkeyActivityError({
        message: `Invalid activity status: ${activity.status}`,
        activityId: id,
        activityStatus: status,
        activityType: type,
      });
    }

    const result = refineNonNull(activity?.result?.signRawPayloadResult);

    const { r, s } = result;

    return new ExtendedSecp256k1Signature(
      fromHex(r),
      fromHex(s),
      0 // TODO: do we need to include `v` here? If so, we need to convert it from string to number
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
