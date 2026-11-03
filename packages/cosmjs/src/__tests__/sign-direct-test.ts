import { describe, it, expect } from "@jest/globals";
import { Secp256k1, Secp256k1Signature, sha256 } from "@cosmjs/crypto";
import { fromBase64, fromHex, toHex } from "@cosmjs/encoding";
import { makeSignBytes } from "@cosmjs/proto-signing";
import type { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";

import { TurnkeyDirectWallet } from "../";

const PRIVATE_KEY = fromHex(
  "1111111111111111111111111111111111111111111111111111111111111111",
);

const SIGN_DOC: SignDoc = {
  bodyBytes: Uint8Array.from([1, 2, 3]),
  authInfoBytes: Uint8Array.from([4, 5, 6]),
  chainId: "cosmoshub-4",
  accountNumber: BigInt(1),
};

/**
 * Stands in for a Turnkey client. It applies the requested `hashFunction`
 * before signing, the way the backend does, so a payload that is hashed twice
 * produces a signature over the wrong digest.
 */
async function signAsTurnkey(payload: string, hashFunction: string) {
  const bytes = fromHex(payload);
  const digest =
    hashFunction === "HASH_FUNCTION_SHA256" ? sha256(bytes) : bytes;
  const signature = await Secp256k1.createSignature(digest, PRIVATE_KEY);

  return {
    r: toHex(signature.r(32)),
    s: toHex(signature.s(32)),
    v: signature.recovery.toString(16),
  };
}

/** A `@turnkey/http` style client: `isHttpClient` keys off `name`. */
function fakeHttpClient() {
  return {
    name: "TurnkeyClient",
    signRawPayload: async ({ parameters }: any) => ({
      activity: {
        id: "activity-id",
        status: "ACTIVITY_STATUS_COMPLETED",
        type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
        result: {
          signRawPayloadResult: await signAsTurnkey(
            parameters.payload,
            parameters.hashFunction,
          ),
        },
      },
    }),
  };
}

/** An sdk/core style client, which returns the result directly. */
function fakeSdkClient() {
  return {
    signRawPayload: async ({ payload, hashFunction }: any) =>
      signAsTurnkey(payload, hashFunction),
  };
}

async function signDirectWith(client: unknown) {
  const publicKey = Secp256k1.uncompressPubkey(
    (await Secp256k1.makeKeypair(PRIVATE_KEY)).pubkey,
  );

  const wallet = TurnkeyDirectWallet.initWithPublicKey({
    config: {
      client: client as any,
      organizationId: "organization-id",
      signWith: toHex(publicKey),
    },
  });

  const [account] = await wallet.getAccounts();

  return wallet.signDirect(account!.address, SIGN_DOC);
}

describe.each([
  ["@turnkey/http client", fakeHttpClient],
  ["sdk client", fakeSdkClient],
])("signDirect with a %s", (_name, makeClient) => {
  it("signs the SHA-256 digest of the sign bytes exactly once", async () => {
    const { signature } = await signDirectWith(makeClient());

    const expectedDigest = sha256(makeSignBytes(SIGN_DOC));
    const keypair = await Secp256k1.makeKeypair(PRIVATE_KEY);

    await expect(
      Secp256k1.verifySignature(
        Secp256k1Signature.fromFixedLength(fromBase64(signature.signature)),
        expectedDigest,
        keypair.pubkey,
      ),
    ).resolves.toBe(true);
  });
});
