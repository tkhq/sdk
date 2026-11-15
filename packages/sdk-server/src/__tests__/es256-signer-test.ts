import { createPublicKey, verify as nodeVerify, webcrypto } from "node:crypto";
import { Buffer as NodeBuffer } from "node:buffer";
import { afterAll, beforeAll, expect, test } from "@jest/globals";
import {
  createTurnkeyEs256Signer,
  jwkThumbprint,
  p256PublicKeyToJwk,
} from "../bot-signer";
import type { P256PublicJwk, TurnkeyEs256SigningClient } from "../bot-signer";

const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto");
beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
});
afterAll(() => {
  if (originalCrypto)
    Object.defineProperty(globalThis, "crypto", originalCrypto);
  else Reflect.deleteProperty(globalThis, "crypto");
});

async function fixture() {
  const keys = await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const inputs: Parameters<TurnkeyEs256SigningClient["signRawPayload"]>[0][] =
    [];
  const activities: string[] = [];
  const client: TurnkeyEs256SigningClient = {
    async signRawPayload(input) {
      inputs.push(input);
      const sig = NodeBuffer.from(
        await webcrypto.subtle.sign(
          { name: "ECDSA", hash: "SHA-256" },
          keys.privateKey,
          NodeBuffer.from(input.payload, "hex"),
        ),
      );
      return {
        r: sig.subarray(0, 32).toString("hex"),
        s: sig.subarray(32).toString("hex"),
        activity: { id: "es256-activity", status: "ACTIVITY_STATUS_COMPLETED" },
      };
    },
  };
  const config = {
    client,
    organizationId: "org",
    signWith: "p256-key",
    publicKey: keys.publicKey,
    onActivity: (id: string) => activities.push(id),
  };
  return { keys, inputs, activities, config };
}

test("sends original bytes for SHA-256 signing and returns a P1363 signature", async () => {
  const { config, inputs, activities } = await fixture();
  const bytes = Uint8Array.from([99, 0, 10, 255, 99]).subarray(1, 4);
  const signer = createTurnkeyEs256Signer(config);
  const signature = await signer.sign({ payload: bytes });
  expect(signer.algorithm).toBe("ecdsa-p256-sha256");
  expect(inputs).toEqual([
    {
      organizationId: "org",
      signWith: "p256-key",
      payload: "000aff",
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_SHA256",
    },
  ]);
  expect(signature.length).toBe(64);
  expect(
    await webcrypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      config.publicKey,
      signature,
      bytes,
    ),
  ).toBe(true);
  expect(activities).toEqual(["es256-activity"]);
});

test("signs an ES256 JWS input that node:crypto verifies as IEEE P1363", async () => {
  const { config, keys } = await fixture();
  const header = NodeBuffer.from(
    JSON.stringify({ alg: "ES256", typ: "JWT" }),
  ).toString("base64url");
  const payload = NodeBuffer.from(
    JSON.stringify({ sub: "example", aud: "https://service.example" }),
  ).toString("base64url");
  const input = NodeBuffer.from(`${header}.${payload}`);
  const signature = await createTurnkeyEs256Signer(config).sign({
    payload: input,
  });
  const jwk = await webcrypto.subtle.exportKey("jwk", keys.publicKey);
  const key = createPublicKey({
    key: { kty: "EC", crv: "P-256", x: jwk.x!, y: jwk.y! },
    format: "jwk",
  });
  expect(
    nodeVerify("sha256", input, { key, dsaEncoding: "ieee-p1363" }, signature),
  ).toBe(true);
  expect(
    nodeVerify(
      "sha256",
      NodeBuffer.from(`${header}.changed`),
      { key, dsaEncoding: "ieee-p1363" },
      signature,
    ),
  ).toBe(false);
});

test("pads short ECDSA scalars to 32 bytes before verification and return", async () => {
  // Public fixture generated with a software key. No private key is retained.
  const publicKey = await webcrypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: "Q76jmT5b24iyX6ac5iK3x5VDl4FGOo00DiiOp8kuEnk",
      y: "RaQ7PD7S8TURnNe012_54ZYqBmZNk48K7-CjVkvpGaU",
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const signer = createTurnkeyEs256Signer({
    organizationId: "org",
    signWith: "key",
    publicKey,
    client: {
      signRawPayload: async () => ({
        r: "35c1227731d51d6d126395de7b9a11c92567917b4c67631c97a6a8b1fb8e01f9",
        s: "c17c9821045eb1fdbff904f178538882fe32c96c85decf6b43f300e4bdda14",
        activity: { status: "ACTIVITY_STATUS_COMPLETED" },
      }),
    },
  });
  const signature = await signer.sign({
    payload: new TextEncoder().encode("ES256 scalar padding fixture"),
  });
  expect(signature).toHaveLength(64);
  expect(
    await webcrypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      signature,
      new TextEncoder().encode("ES256 scalar padding fixture"),
    ),
  ).toBe(true);
});

test("rejects private, Ed25519 and P-384 verification keys before signing", async () => {
  const { config, keys, inputs } = await fixture();
  const ed = (await webcrypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ])) as webcrypto.CryptoKeyPair;
  const p384 = await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-384" },
    true,
    ["sign", "verify"],
  );
  for (const publicKey of [keys.privateKey, ed.publicKey, p384.publicKey])
    expect(() => createTurnkeyEs256Signer({ ...config, publicKey })).toThrow(
      "P-256 public verification key",
    );
  expect(inputs).toEqual([]);
});

test("verifies every remote signature against the configured P-256 public key", async () => {
  const { config, activities } = await fixture();
  const other = await fixture();
  const signer = createTurnkeyEs256Signer(config);
  await signer.sign({ payload: new Uint8Array([1]) });
  config.client.signRawPayload = other.config.client.signRawPayload;
  await expect(signer.sign({ payload: new Uint8Array([1]) })).rejects.toThrow(
    "does not match",
  );
  expect(activities).toEqual(["es256-activity"]);
});

test("denied, pending and failed ES256 activities expose no upstream error", async () => {
  const { config, activities } = await fixture();
  for (const client of [
    {
      signRawPayload: async () => {
        throw new Error("sensitive upstream request");
      },
    },
    {
      signRawPayload: async () => ({
        r: "01",
        s: "02",
        activity: { status: "ACTIVITY_STATUS_CONSENSUS_NEEDED" },
      }),
    },
    {
      signRawPayload: async () => ({
        r: "01",
        s: "02",
        activity: { status: "ACTIVITY_STATUS_FAILED" },
      }),
    },
  ]) {
    await expect(
      createTurnkeyEs256Signer({ ...config, client }).sign({
        payload: new Uint8Array([1]),
      }),
    ).rejects.toThrow("did not complete");
    await expect(
      createTurnkeyEs256Signer({ ...config, client }).sign({
        payload: new Uint8Array([1]),
      }),
    ).rejects.not.toThrow("sensitive");
  }
  expect(activities).toEqual([]);
});

test.each(["", "f".repeat(65), "zz", "-1", "0x01"])(
  "rejects malformed ES256 scalar %s",
  async (value) => {
    const { config, activities } = await fixture();
    for (const result of [
      { r: value, s: "01" },
      { r: "01", s: value },
    ]) {
      const client = {
        signRawPayload: async () => ({
          ...result,
          activity: { status: "ACTIVITY_STATUS_COMPLETED" },
        }),
      };
      await expect(
        createTurnkeyEs256Signer({ ...config, client }).sign({
          payload: new Uint8Array([1]),
        }),
      ).rejects.toThrow("invalid ES256");
    }
    expect(activities).toEqual([]);
  },
);

test("snapshots ES256 signing input while the request is pending", async () => {
  const { config } = await fixture();
  let complete: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const client: TurnkeyEs256SigningClient = {
    async signRawPayload(input) {
      await pending;
      return config.client.signRawPayload(input);
    },
  };
  const bytes = new Uint8Array([1]);
  const signing = createTurnkeyEs256Signer({ ...config, client }).sign({
    payload: bytes,
  });
  bytes[0] = 2;
  complete!();
  expect(
    await webcrypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      config.publicKey,
      await signing,
      new Uint8Array([1]),
    ),
  ).toBe(true);
});

test("ES256 signing and public-key helpers work without the Node Buffer global", async () => {
  const { config } = await fixture();
  const original = Object.getOwnPropertyDescriptor(globalThis, "Buffer")!;
  try {
    Object.defineProperty(globalThis, "Buffer", {
      value: undefined,
      configurable: true,
    });
    expect(
      await createTurnkeyEs256Signer(config).sign({
        payload: new Uint8Array([1]),
      }),
    ).toHaveLength(64);
    expect(p256PublicKeyToJwk(GENERATOR_COMPRESSED)).toEqual(GENERATOR_JWK);
    expect(await jwkThumbprint(GENERATOR_JWK)).toBe(GENERATOR_THUMBPRINT);
  } finally {
    Object.defineProperty(globalThis, "Buffer", original);
  }
});

test("requires Web Crypto before sending an ES256 signing request", async () => {
  const { config, inputs } = await fixture();
  try {
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    });
    expect(() => createTurnkeyEs256Signer(config)).toThrow(
      "Web Crypto is required",
    );
  } finally {
    Object.defineProperty(globalThis, "crypto", {
      value: webcrypto,
      configurable: true,
    });
  }
  expect(inputs).toEqual([]);
});

// Standard P-256 generator point; only public key material.
const GENERATOR_X =
  "6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296";
const GENERATOR_Y =
  "4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5";
const GENERATOR_COMPRESSED = "03" + GENERATOR_X;
const GENERATOR_JWK: P256PublicJwk = {
  kty: "EC",
  crv: "P-256",
  x: "axfR8uEsQkf4vOblY6RA8ncDfYEt6zOg9KE5RdiYwpY",
  y: "T-NC4v4af5uO5-tKfA-eFivOM1drMV7Oy7ZAaDe_UfU",
};
const GENERATOR_THUMBPRINT = "xx0BcA-wMohw8atYDJOe6peGModklG2wRHBlXHMvl0M";

test("converts compressed/uncompressed P-256 points to the JWK Web Crypto exports", async () => {
  expect(p256PublicKeyToJwk(GENERATOR_COMPRESSED)).toEqual(GENERATOR_JWK);
  expect(p256PublicKeyToJwk("0x04" + GENERATOR_X + GENERATOR_Y)).toEqual(
    GENERATOR_JWK,
  );
  const { keys } = await fixture();
  const raw = new Uint8Array(
    await webcrypto.subtle.exportKey("raw", keys.publicKey),
  );
  const compressed = new Uint8Array([
    2 | (raw[64]! & 1),
    ...raw.subarray(1, 33),
  ]);
  const expected = await webcrypto.subtle.exportKey("jwk", keys.publicKey);
  const jwk = p256PublicKeyToJwk(NodeBuffer.from(compressed).toString("hex"));
  expect(jwk).toEqual({
    kty: expected.kty,
    crv: expected.crv,
    x: expected.x,
    y: expected.y,
  });
  const imported = await webcrypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const signature = await webcrypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keys.privateKey,
    new Uint8Array([1]),
  );
  expect(
    await webcrypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      imported,
      signature,
      new Uint8Array([1]),
    ),
  ).toBe(true);
});

test.each([
  "",
  "04",
  "02" + "ff".repeat(32),
  "04" + "00".repeat(64),
  "05" + GENERATOR_X,
  "zz".repeat(33),
])("rejects malformed or off-curve P-256 key %s", (key) => {
  expect(() => p256PublicKeyToJwk(key)).toThrow(TypeError);
});

test("computes a P-256 RFC 7638 thumbprint from required members only", async () => {
  await expect(jwkThumbprint(GENERATOR_JWK)).resolves.toBe(
    GENERATOR_THUMBPRINT,
  );
  await expect(
    jwkThumbprint({
      ...GENERATOR_JWK,
      alg: "ES256",
      use: "sig",
      kid: "ignored",
    } as P256PublicJwk),
  ).resolves.toBe(GENERATOR_THUMBPRINT);
  await expect(
    jwkThumbprint({ ...GENERATOR_JWK, d: GENERATOR_JWK.x } as P256PublicJwk),
  ).rejects.toThrow(TypeError);
  await expect(jwkThumbprint({ ...GENERATOR_JWK, y: "short" })).rejects.toThrow(
    TypeError,
  );
  await expect(
    jwkThumbprint({
      ...GENERATOR_JWK,
      crv: "secp256k1",
    } as unknown as P256PublicJwk),
  ).rejects.toThrow(TypeError);
});
