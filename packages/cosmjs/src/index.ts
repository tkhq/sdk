import {
  encodeSecp256k1Signature,
  rawSecp256k1PubkeyToRawAddress,
} from "@cosmjs/amino";
import { ExtendedSecp256k1Signature, Secp256k1, sha256 } from "@cosmjs/crypto";
import { fromHex, toBech32, toHex } from "@cosmjs/encoding";
import {
  makeSignBytes,
  type AccountData,
  type DirectSignResponse,
  type OfflineDirectSigner,
} from "@cosmjs/proto-signing";
import {
  TurnkeyClient,
  TurnkeyActivityError,
  TurnkeyRequestError,
} from "@turnkey/http";
import type { TurnkeyBrowserClient } from "@turnkey/sdk-browser";
import type { TurnkeyServerClient } from "@turnkey/sdk-server";
import type { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";

type TConfig = {
  /**
   * Turnkey client
   */
  client: TurnkeyClient | TurnkeyBrowserClient | TurnkeyServerClient;
  /**
   * Turnkey organization ID
   */
  organizationId: string;
  /**
   * Turnkey wallet account public key or private key ID
   */
  signWith: string;
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
    const { client, signWith } = config;

    let compressedPublicKey: Uint8Array;

    // If sign with is a UUID corresponding to a private key, fetch its public key.
    // Otherwise, it should be an uncompressed public key, which we need to compress
    if (isValidUuid(signWith)) {
      const { compressedPublicKey: fetchedPublicKey } =
        await fetchCompressedPublicKey({
          client,
          privateKeyId: signWith,
          organizationId: config.organizationId,
        });

      compressedPublicKey = fetchedPublicKey;
    } else {
      compressedPublicKey = Secp256k1.compressPubkey(fromHex(signWith));
    }

    return new TurnkeyDirectWallet({
      config,
      compressedPublicKey,
      prefix,
    });
  }

  public static initWithPublicKey(input: {
    config: TConfig;
    prefix?: string | undefined;
  }): TurnkeyDirectWallet {
    const { config, prefix } = input;
    const { signWith } = config;

    const compressedPublicKey = Secp256k1.compressPubkey(fromHex(signWith));

    return new TurnkeyDirectWallet({
      config,
      compressedPublicKey,
      prefix,
    });
  }

  public readonly prefix: string;
  public readonly organizationId: string;
  public readonly signWith: string;

  private readonly client:
    | TurnkeyClient
    | TurnkeyBrowserClient
    | TurnkeyServerClient;

  private readonly compressedPublicKey: Uint8Array;

  private constructor(input: {
    config: TConfig;
    prefix?: string | undefined;
    compressedPublicKey: Uint8Array;
  }) {
    const { compressedPublicKey, prefix, config } = input;
    const { client, organizationId, signWith } = config;

    this.prefix = prefix ?? DEFAULT_PREFIX;
    this.compressedPublicKey = compressedPublicKey;
    this.organizationId = organizationId;
    this.signWith = signWith;
    this.client = client;
  }

  private get address(): string {
    return toBech32(
      this.prefix,
      rawSecp256k1PubkeyToRawAddress(this.compressedPublicKey)
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
    const message = sha256(signBytes);

    if (address !== this.address) {
      throw new Error(`Address ${address} not found in wallet`);
    }

    const signature = await this._signImpl(message);

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
    const messageHex = toHex(message);
    let result;

    if (this.client instanceof TurnkeyClient) {
      const { activity } = await this.client.signRawPayload({
        type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
        organizationId: this.organizationId,
        timestampMs: String(Date.now()),
        parameters: {
          signWith: this.signWith,
          payload: messageHex,
          encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
          hashFunction: "HASH_FUNCTION_SHA256",
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

      result = refineNonNull(activity?.result?.signRawPayloadResult);
    } else {
      result = await this.client.signRawPayload({
        signWith: this.signWith,
        payload: messageHex,
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction: "HASH_FUNCTION_NO_OP",
      });
    }

    return new ExtendedSecp256k1Signature(
      fromHex(result.r!),
      fromHex(result.s!),
      parseInt(result.v!, 16)
    );
  }
}

export async function fetchCompressedPublicKey(input: {
  client: TurnkeyClient | TurnkeyBrowserClient | TurnkeyServerClient;
  privateKeyId: string;
  organizationId: string;
}): Promise<{ compressedPublicKey: Uint8Array }> {
  const { client, privateKeyId, organizationId } = input;

  const keyInfo = await client.getPrivateKey({
    organizationId,
    privateKeyId,
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

function isValidUuid(s: string): boolean {
  const regex = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  return regex.test(s);
}
