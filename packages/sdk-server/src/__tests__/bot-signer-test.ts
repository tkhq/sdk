import { webcrypto } from "node:crypto";
import { Buffer as NodeBuffer } from "node:buffer";
import { afterAll, beforeAll, expect, test } from "@jest/globals";
import {
  createTurnkeyBotSigner,
  ed25519PublicKeyToJwk,
  jwkThumbprint,
  TurnkeySigningError,
} from "../bot-signer";
import type { TurnkeyBotSigningClient } from "../bot-signer";

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
  const keys = (await webcrypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ])) as webcrypto.CryptoKeyPair;
  const inputs: Parameters<TurnkeyBotSigningClient["signRawPayload"]>[0][] = [];
  const activities: string[] = [];
  const client: TurnkeyBotSigningClient = {
    async signRawPayload(input) {
      inputs.push(input);
      const signature = NodeBuffer.from(
        await webcrypto.subtle.sign(
          "Ed25519",
          keys.privateKey,
          NodeBuffer.from(input.payload, "hex"),
        ),
      ).toString("hex");
      return {
        r: signature.slice(0, 64),
        s: signature.slice(64),
        activity: { id: "activity", status: "ACTIVITY_STATUS_COMPLETED" },
      };
    },
  };
  const config = {
    client,
    organizationId: "org",
    signWith: "key",
    publicKey: keys.publicKey,
    onActivity: (id: string) => activities.push(id),
  };
  return { keys, inputs, activities, client, config };
}

test("signs exact bytes without prehashing and returns a checked Ed25519 key", async () => {
  const { config, inputs, activities } = await fixture();
  const signer = createTurnkeyBotSigner(config);
  const bytes = Uint8Array.from([99, 0, 10, 255, 99]).subarray(1, 4);
  const signature = await signer.sign({ payload: bytes });
  expect(signer.algorithm).toBe("ed25519");
  expect(signer.publicKey).toBe(config.publicKey);
  expect(inputs).toEqual([
    {
      organizationId: "org",
      signWith: "key",
      payload: "000aff",
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
    },
  ]);
  expect(
    await webcrypto.subtle.verify(
      "Ed25519",
      config.publicKey,
      signature,
      bytes,
    ),
  ).toBe(true);
  expect(activities).toEqual(["activity"]);
});

test("signs using Web Crypto when the Node Buffer global is absent", async () => {
  const { config } = await fixture();
  const originalBuffer = Object.getOwnPropertyDescriptor(globalThis, "Buffer")!;
  let signature: Uint8Array;
  try {
    Object.defineProperty(globalThis, "Buffer", {
      value: undefined,
      configurable: true,
    });
    signature = await createTurnkeyBotSigner(config).sign({
      payload: new Uint8Array([1]),
    });
  } finally {
    Object.defineProperty(globalThis, "Buffer", originalBuffer);
  }
  expect(signature!.length).toBe(64);
});

test("requires Web Crypto before making a remote signing request", async () => {
  const { config, inputs } = await fixture();
  try {
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    });
    expect(() => createTurnkeyBotSigner(config)).toThrow(
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

test("checks every signature and reports no success for a mismatched public key", async () => {
  const { config, activities } = await fixture();
  const other = await fixture();
  const signer = createTurnkeyBotSigner(config);
  await signer.sign({ payload: new Uint8Array([1]) });
  config.client.signRawPayload = other.client.signRawPayload;
  await expect(signer.sign({ payload: new Uint8Array([1]) })).rejects.toThrow(
    "does not match",
  );
  expect(activities).toEqual(["activity"]);
});

test("rejects unusable public keys before a signing call", async () => {
  const { keys, config, inputs } = await fixture();
  expect(() =>
    createTurnkeyBotSigner({ ...config, publicKey: keys.privateKey }),
  ).toThrow("public verification key");
  const ec = await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  expect(() =>
    createTurnkeyBotSigner({ ...config, publicKey: ec.publicKey }),
  ).toThrow("public verification key");
  expect(inputs).toEqual([]);
});

test("denied, pending and malformed signing results fail without exposing upstream errors", async () => {
  const { config, activities } = await fixture();
  for (const client of [
    {
      signRawPayload: async () => {
        throw new Error("sensitive upstream request");
      },
    },
    {
      signRawPayload: async () => ({
        r: "01".repeat(32),
        s: "02".repeat(32),
        activity: { status: "ACTIVITY_STATUS_CONSENSUS_NEEDED" },
      }),
    },
    {
      signRawPayload: async () => ({
        r: "bad",
        s: "bad",
        activity: { status: "ACTIVITY_STATUS_COMPLETED" },
      }),
    },
  ]) {
    const signer = createTurnkeyBotSigner({ ...config, client });
    await expect(signer.sign({ payload: new Uint8Array([1]) })).rejects.toThrow(
      /Turnkey/,
    );
    await expect(
      signer.sign({ payload: new Uint8Array([1]) }),
    ).rejects.not.toThrow("sensitive");
  }
  expect(activities).toEqual([]);
});

test("failures carry a code and the activity ID for auditing", async () => {
  const { config, activities } = await fixture();
  const other = await fixture();
  const upstream = Object.assign(new Error("sensitive policy detail"), {
    activityId: "denied-activity",
    activityStatus: "ACTIVITY_STATUS_REJECTED",
  });
  const cases: [
    TurnkeyBotSigningClient["signRawPayload"],
    Partial<TurnkeySigningError>,
  ][] = [
    [
      async () => {
        throw upstream;
      },
      {
        code: "SIGNING_REQUEST_FAILED",
        activityId: "denied-activity",
        activityStatus: "ACTIVITY_STATUS_REJECTED",
        cause: upstream,
      },
    ],
    [
      async () => ({
        r: "",
        s: "",
        activity: {
          id: "pending-activity",
          status: "ACTIVITY_STATUS_CONSENSUS_NEEDED",
        },
      }),
      {
        code: "ACTIVITY_NOT_COMPLETED",
        activityId: "pending-activity",
        activityStatus: "ACTIVITY_STATUS_CONSENSUS_NEEDED",
      },
    ],
    [
      async () => ({
        r: "bad",
        s: "bad",
        activity: { id: "bad-activity", status: "ACTIVITY_STATUS_COMPLETED" },
      }),
      { code: "INVALID_SIGNATURE", activityId: "bad-activity" },
    ],
    [
      other.client.signRawPayload,
      { code: "SIGNATURE_MISMATCH", activityId: "activity" },
    ],
  ];
  for (const [signRawPayload, expected] of cases) {
    const error = await createTurnkeyBotSigner({
      ...config,
      client: { signRawPayload },
    })
      .sign({ payload: new Uint8Array([1]) })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TurnkeySigningError);
    expect(error).toMatchObject(expected);
    expect((error as Error).message).not.toContain("sensitive");
  }
  expect(activities).toEqual([]);
});

test("requires a completed activity status, not only a valid signature", async () => {
  const { config, activities } = await fixture();
  for (const activity of [undefined, {}, { id: "no-status" }]) {
    const client: TurnkeyBotSigningClient = {
      async signRawPayload(input) {
        const { r, s } = await config.client.signRawPayload(input);
        return activity ? { r, s, activity } : { r, s };
      },
    };
    await expect(
      createTurnkeyBotSigner({ ...config, client }).sign({
        payload: new Uint8Array([1]),
      }),
    ).rejects.toMatchObject({ code: "ACTIVITY_NOT_COMPLETED" });
  }
  expect(activities).toEqual([]);
});

test("snapshots the requested bytes across asynchronous remote signing", async () => {
  const { config } = await fixture();
  let complete: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const client: TurnkeyBotSigningClient = {
    async signRawPayload(input) {
      await pending;
      return config.client.signRawPayload(input);
    },
  };
  const signer = createTurnkeyBotSigner({ ...config, client });
  const bytes = new Uint8Array([1]);
  const signing = signer.sign({ payload: bytes });
  bytes[0] = 2;
  complete!();
  const signature = await signing;
  expect(
    await webcrypto.subtle.verify(
      "Ed25519",
      config.publicKey,
      signature,
      new Uint8Array([1]),
    ),
  ).toBe(true);
});

// RFC 8037 Appendix A.3.
const RFC8037_PUBLIC_KEY_HEX =
  "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a";
const RFC8037_X = "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo";
const RFC8037_THUMBPRINT = "kPrK_qmxVWaYVA9wwBF6Iuo3vVzz7TxHCTwXBygrS4k";

test("converts a hex public key to the JWK that Web Crypto exports", async () => {
  const { keys } = await fixture();
  const raw = new Uint8Array(
    await webcrypto.subtle.exportKey("raw", keys.publicKey),
  );
  const exported = await webcrypto.subtle.exportKey("jwk", keys.publicKey);
  expect(ed25519PublicKeyToJwk(NodeBuffer.from(raw).toString("hex"))).toEqual({
    kty: exported.kty,
    crv: exported.crv,
    x: exported.x,
  });
  expect(ed25519PublicKeyToJwk(`0x${RFC8037_PUBLIC_KEY_HEX}`)).toEqual({
    kty: "OKP",
    crv: "Ed25519",
    x: RFC8037_X,
  });
  expect(() => ed25519PublicKeyToJwk("abcd")).toThrow(TypeError);
  expect(() => ed25519PublicKeyToJwk("zz".repeat(32))).toThrow(TypeError);
});

test("computes the RFC 7638 thumbprint of a public Ed25519 JWK", async () => {
  await expect(
    jwkThumbprint({ kty: "OKP", crv: "Ed25519", x: RFC8037_X }),
  ).resolves.toBe(RFC8037_THUMBPRINT);
  const privateJwk = { kty: "OKP", crv: "Ed25519", x: RFC8037_X, d: RFC8037_X };
  await expect(
    jwkThumbprint(privateJwk as Parameters<typeof jwkThumbprint>[0]),
  ).rejects.toThrow(TypeError);
});
