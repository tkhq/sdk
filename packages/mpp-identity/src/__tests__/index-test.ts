import { describe, expect, it, jest } from "@jest/globals";
import { uint8ArrayToHexString } from "@turnkey/encoding";
import {
  createTurnkeySigner,
  ed25519PublicKeyToJwk,
  jwkThumbprint,
  type SignRawPayloadInput,
  type SignRawPayloadResult,
  type TurnkeyRawSigner,
} from "../index";

// RFC 8037 Appendix A.3.
const RFC8037_PUBLIC_KEY_HEX =
  "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a";
const RFC8037_X = "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo";
const RFC8037_THUMBPRINT = "kPrK_qmxVWaYVA9wwBF6Iuo3vVzz7TxHCTwXBygrS4k";

const ORGANIZATION_ID = "org-id";
const SIGN_WITH = "private-key-id";

type KeyPair = { privateKey: CryptoKey; publicKey: CryptoKey };

async function generateKeyPair(): Promise<{
  keyPair: KeyPair;
  publicKeyHex: string;
}> {
  const keyPair = (await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ])) as KeyPair;
  const raw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  return { keyPair, publicKeyHex: uint8ArrayToHexString(new Uint8Array(raw)) };
}

function mockClient(
  respond: (input: SignRawPayloadInput) => Promise<SignRawPayloadResult>,
) {
  const signRawPayload = jest.fn(respond);
  const client: TurnkeyRawSigner = { signRawPayload };
  return { client, signRawPayload };
}

function signingClient(
  privateKey: CryptoKey,
  activity: SignRawPayloadResult["activity"] = {
    id: "activity-id",
    status: "ACTIVITY_STATUS_COMPLETED",
  },
) {
  return mockClient(async ({ payload }) => {
    const bytes = Uint8Array.from(Buffer.from(payload, "hex"));
    const signature = uint8ArrayToHexString(
      new Uint8Array(await crypto.subtle.sign("Ed25519", privateKey, bytes)),
    );
    return {
      r: signature.slice(0, 64),
      s: signature.slice(64),
      ...(activity ? { activity } : {}),
    };
  });
}

describe("createTurnkeySigner", () => {
  it("sends the exact bytes with hex encoding and no hashing", async () => {
    const { keyPair, publicKeyHex } = await generateKeyPair();
    const { client, signRawPayload } = signingClient(keyPair.privateKey);
    const signer = createTurnkeySigner({
      client,
      organizationId: ORGANIZATION_ID,
      signWith: SIGN_WITH,
      publicKey: publicKeyHex,
    });

    const data = new Uint8Array([0x00, 0x01, 0xfe, 0xff, 0x40]);
    await signer.sign(data);

    expect(signer.algorithm).toBe("ed25519");
    expect(signRawPayload).toHaveBeenCalledTimes(1);
    expect(signRawPayload).toHaveBeenCalledWith({
      organizationId: ORGANIZATION_ID,
      signWith: SIGN_WITH,
      payload: "0001feff40",
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
    });
  });

  it("returns a 64-byte signature that verifies and reports the activity", async () => {
    const { keyPair, publicKeyHex } = await generateKeyPair();
    const { client } = signingClient(keyPair.privateKey);
    const onActivity = jest.fn();
    const signer = createTurnkeySigner({
      client,
      organizationId: ORGANIZATION_ID,
      signWith: SIGN_WITH,
      publicKey: `0x${publicKeyHex}`,
      onActivity,
    });

    const data = new TextEncoder().encode('"@authority": api.example');
    const signature = await signer.sign(data);

    expect(signature).toHaveLength(64);
    await expect(
      crypto.subtle.verify("Ed25519", keyPair.publicKey, signature, data),
    ).resolves.toBe(true);
    expect(onActivity).toHaveBeenCalledWith("activity-id");
  });

  it("accepts a result without activity metadata", async () => {
    const { keyPair, publicKeyHex } = await generateKeyPair();
    const { client } = signingClient(keyPair.privateKey, undefined);
    const signer = createTurnkeySigner({
      client,
      organizationId: ORGANIZATION_ID,
      signWith: SIGN_WITH,
      publicKey: publicKeyHex,
    });

    await expect(signer.sign(new Uint8Array([1]))).resolves.toHaveLength(64);
  });

  it("rejects a signature from a different key", async () => {
    const configured = await generateKeyPair();
    const other = await generateKeyPair();
    const { client } = signingClient(other.keyPair.privateKey);
    const onActivity = jest.fn();
    const signer = createTurnkeySigner({
      client,
      organizationId: ORGANIZATION_ID,
      signWith: SIGN_WITH,
      publicKey: configured.publicKeyHex,
      onActivity,
    });

    await expect(signer.sign(new Uint8Array([1, 2, 3]))).rejects.toThrow(
      "does not verify against the configured public key",
    );
    expect(onActivity).not.toHaveBeenCalled();
  });

  it.each(["ACTIVITY_STATUS_PENDING", "ACTIVITY_STATUS_FAILED"])(
    "rejects activity status %s",
    async (status) => {
      const { keyPair, publicKeyHex } = await generateKeyPair();
      const { client } = signingClient(keyPair.privateKey, {
        id: "activity-id",
        status,
      });
      const signer = createTurnkeySigner({
        client,
        organizationId: ORGANIZATION_ID,
        signWith: SIGN_WITH,
        publicKey: publicKeyHex,
      });

      await expect(signer.sign(new Uint8Array([1]))).rejects.toThrow(status);
    },
  );

  it("keeps the client error as cause behind a generic message", async () => {
    const { publicKeyHex } = await generateKeyPair();
    const failure = new Error("secret upstream detail");
    const { client } = mockClient(async () => {
      throw failure;
    });
    const signer = createTurnkeySigner({
      client,
      organizationId: ORGANIZATION_ID,
      signWith: SIGN_WITH,
      publicKey: publicKeyHex,
    });

    const error = await signer.sign(new Uint8Array([1])).catch((e) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Turnkey raw payload signing failed.");
    expect(error.message).not.toContain("secret upstream detail");
    expect(error.cause).toBe(failure);
  });

  it.each([
    { r: "ab".repeat(31), s: "cd".repeat(32) },
    { r: "ab".repeat(32), s: "cd".repeat(33) },
    { r: "zz".repeat(32), s: "cd".repeat(32) },
    { r: `0x${"ab".repeat(31)}`, s: "cd".repeat(32) },
  ])("rejects malformed r/s %#", async (result) => {
    const { publicKeyHex } = await generateKeyPair();
    const { client } = mockClient(async () => result);
    const signer = createTurnkeySigner({
      client,
      organizationId: ORGANIZATION_ID,
      signWith: SIGN_WITH,
      publicKey: publicKeyHex,
    });

    await expect(signer.sign(new Uint8Array([1]))).rejects.toThrow(
      "malformed Ed25519 signature",
    );
  });

  it("throws TypeError for invalid configuration", () => {
    const { client } = mockClient(async () => ({ r: "", s: "" }));
    const base = {
      client,
      organizationId: ORGANIZATION_ID,
      signWith: SIGN_WITH,
      publicKey: RFC8037_PUBLIC_KEY_HEX,
    };

    expect(() => createTurnkeySigner({ ...base, organizationId: "" })).toThrow(
      TypeError,
    );
    expect(() => createTurnkeySigner({ ...base, signWith: "" })).toThrow(
      TypeError,
    );
    expect(() =>
      createTurnkeySigner({
        ...base,
        publicKey: RFC8037_PUBLIC_KEY_HEX + "00",
      }),
    ).toThrow(TypeError);
  });
});

describe("ed25519PublicKeyToJwk", () => {
  it("matches the JWK that WebCrypto exports", async () => {
    const { keyPair, publicKeyHex } = await generateKeyPair();
    const exported = await crypto.subtle.exportKey("jwk", keyPair.publicKey);

    expect(ed25519PublicKeyToJwk(publicKeyHex)).toEqual({
      kty: exported.kty,
      crv: exported.crv,
      x: exported.x,
    });
  });

  it("encodes the RFC 8037 Appendix A.3 key", () => {
    expect(ed25519PublicKeyToJwk(`0x${RFC8037_PUBLIC_KEY_HEX}`)).toEqual({
      kty: "OKP",
      crv: "Ed25519",
      x: RFC8037_X,
    });
  });

  it("rejects input that is not 32 bytes of hex", () => {
    expect(() => ed25519PublicKeyToJwk("abcd")).toThrow(TypeError);
    expect(() => ed25519PublicKeyToJwk("zz".repeat(32))).toThrow(TypeError);
  });
});

describe("jwkThumbprint", () => {
  it("matches the RFC 8037 Appendix A.3 thumbprint", async () => {
    await expect(
      jwkThumbprint({ kty: "OKP", crv: "Ed25519", x: RFC8037_X }),
    ).resolves.toBe(RFC8037_THUMBPRINT);
  });

  it("rejects a private JWK", async () => {
    const jwk = { kty: "OKP", crv: "Ed25519", x: RFC8037_X, d: RFC8037_X };

    await expect(
      jwkThumbprint(jwk as Parameters<typeof jwkThumbprint>[0]),
    ).rejects.toThrow(TypeError);
  });
});
