import {
  encodeSecp256k1Signature,
  rawSecp256k1PubkeyToRawAddress,
} from "@cosmjs/amino";
import { ExtendedSecp256k1Signature, Secp256k1 } from "@cosmjs/crypto";
import { fromBech32, fromHex, toBech32, toHex } from "@cosmjs/encoding";
import {
  makeSignBytes,
  type AccountData,
  type DirectSignResponse,
  type OfflineDirectSigner,
} from "@cosmjs/proto-signing";
import {
  init as httpInit,
  TurnkeyActivityError,
  TurnkeyRequestError,
  TurnkeyApi,
} from "@turnkey/http";
import type { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";

type TConfig = {
  /**
   * Turnkey API public key
   */
  apiPublicKey: string;
  /**
   * Turnkey API private key
   */
  apiPrivateKey: string;
  /**
   * Turnkey API base URL
   */
  baseUrl: string;
  /**
   * Turnkey organization ID
   */
  organizationId: string;
  /**
   * Turnkey wallet account address, private key address, or private key ID
   */
  signWith: string;
  /**
   * A public key corresponding to a Turnkey wallet account address or private key.
   * If left undefined, it will be fetched from the Turnkey API.
   * We recommend setting this if you're using a passkey client, so that your users are not prompted for a passkey signature any time their public key is needed.
   * You may leave this undefined if using an API key client.
   */
  pubKey?: string;
};

const DEFAULT_PREFIX = "cosmos";

// Largely based off `DirectSecp256k1Wallet`:
// https://github.com/cosmos/cosmjs/blob/e8e65aa0c145616ccb58625c32bffe08b46ff574/packages/proto-signing/src/directsecp256k1wallet.ts#LL14C14-L14C35
export class TurnkeyDirectWallet implements OfflineDirectSigner {
  public static async init(input: {
    config: TConfig;
    prefix?: string | undefined;
  }): Promise<TurnkeyDirectWallet> {
    const { config, prefix } = input;
    const { apiPublicKey, apiPrivateKey, baseUrl, pubKey, signWith } = config;

    httpInit({
      apiPublicKey: apiPublicKey,
      apiPrivateKey: apiPrivateKey,
      baseUrl: baseUrl,
    });

    if 

    const { compressedPublicKey } = await fetchCompressedPublicKey({
      privateKeyId,
      organizationId: config.organizationId,
    });

    return new TurnkeyDirectWallet({
      config,
      signWith,
      prefix,
    });
  }

  public readonly prefix: string;
  public readonly organizationId: string;
  public readonly signWith: string;

  // private readonly compressedPublicKey: Uint8Array;

  private constructor(input: {
    config: TConfig;
    signWith: string;
    prefix?: string | undefined;
    // compressedPublicKey: Uint8Array;
  }) {
    const { config } = input;
    const { organizationId, signWith } = config;

    this.prefix = prefix ?? DEFAULT_PREFIX;
    // this.compressedPublicKey = compressedPublicKey;
    this.organizationId = organizationId;
    this.signWith = signWith;
  }

  private get address(): string {
    // fetch from Turnkey API
    const compressedPublicKey = "";

    return toBech32(
      this.prefix,
      rawSecp256k1PubkeyToRawAddress(compressedPublicKey)
    );
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

    const signature = await this._signImpl(signBytes);

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

  // Largely based off `Secp256k1.createSignature(...)`
  // https://github.com/cosmos/cosmjs/blob/e8e65aa0c145616ccb58625c32bffe08b46ff574/packages/crypto/src/secp256k1.ts#L67
  private async _signImpl(
    message: Uint8Array
  ): Promise<ExtendedSecp256k1Signature> {
    const { activity } = await TurnkeyApi.signRawPayload({
      body: {
        type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
        organizationId: this.organizationId,
        timestampMs: String(Date.now()),
        parameters: {
          signWith: this.signWith,
          payload: toHex(message),
          encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
          hashFunction: "HASH_FUNCTION_SHA256",
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

    const { r, s, v } = result;

    return new ExtendedSecp256k1Signature(
      fromHex(r),
      fromHex(s),
      parseInt(v, 16)
    );
  }
}

async function fetchCompressedPublicKey(input: {
  privateKeyId: string;
  organizationId: string;
}): Promise<{ compressedPublicKey: Uint8Array }> {
  const { privateKeyId, organizationId } = input;

  const keyInfo = await TurnkeyApi.getPrivateKey({
    body: {
      organizationId,
      privateKeyId,
    },
  });

  const uncompressedPublicKey = keyInfo.privateKey.publicKey;
  const compressedPublicKey = Secp256k1.compressPubkey(
    fromHex(uncompressedPublicKey)
  );

  return { compressedPublicKey };
}

export { TurnkeyActivityError, TurnkeyRequestError };

function refineNonNull<T>(
  input: T | null | undefined,
  errorMessage?: string
): T {
  if (input == null) {
    throw new Error(errorMessage ?? `Unexpected ${JSON.stringify(input)}`);
  }

  return input;
}
