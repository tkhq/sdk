import { webcrypto } from "node:crypto";
import { beforeAll, expect, test } from "@jest/globals";
import {
  createTurnkeyBotSigner,
  createWebBotAuthProver,
  jwkThumbprint,
} from "../index";
import type { Ed25519PublicJwk, TurnkeyRawSigner } from "../index";

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
});

async function fixture() {
  const keys = await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ]);
  const publicKeyJwk = (await crypto.subtle.exportKey(
    "jwk",
    keys.publicKey,
  )) as Ed25519PublicJwk;
  const prover = await createWebBotAuthProver({
    publicKeyJwk,
    sign: async (bytes) =>
      new Uint8Array(
        await crypto.subtle.sign(
          "Ed25519",
          keys.privateKey,
          Uint8Array.from(bytes),
        ),
      ),
    signatureAgent: "https://bot.example",
    scope: ["https://api.example"],
  });
  return { keys, publicKeyJwk, prover };
}

test("creates fresh redirect-safe request signatures without a context provider", async () => {
  const { prover, publicKeyJwk } = await fixture();
  const request = new Request("https://api.example/resource");
  const first = await prover.prove(request);
  const second = await prover.prove(request);
  expect(first.redirect).toBe("error");
  expect(first.headers.get("Signature-Agent")).toBe(
    'webbot="https://bot.example"',
  );
  expect(first.headers.get("Signature-Input")).toContain(
    `keyid="${await jwkThumbprint(publicKeyJwk)}"`,
  );
  expect(first.headers.get("Signature")).not.toBe(
    second.headers.get("Signature"),
  );
});

test("does not call the signer for an origin outside the configured scope", async () => {
  const { publicKeyJwk } = await fixture();
  let calls = 0;
  const prover = await createWebBotAuthProver({
    publicKeyJwk,
    sign: async () => {
      calls++;
      return new Uint8Array(64);
    },
    signatureAgent: "https://bot.example",
    scope: ["https://api.example"],
  });
  await expect(
    prover.prove(new Request("https://other.example")),
  ).rejects.toThrow("outside");
  expect(calls).toBe(0);
});

test("refuses private JWKs, wrong-key signatures, invalid lifetimes and label collisions", async () => {
  const { publicKeyJwk, prover } = await fixture();
  const config = {
    publicKeyJwk,
    sign: async () => new Uint8Array(64),
    signatureAgent: "https://bot.example",
    scope: ["https://api.example"],
  };
  await expect(
    createWebBotAuthProver({
      ...config,
      publicKeyJwk: { ...publicKeyJwk, d: "private" } as Ed25519PublicJwk,
    }),
  ).rejects.toThrow("public");
  await expect(
    createWebBotAuthProver({ ...config, expiresIn: 61 }),
  ).rejects.toThrow("60");
  const wrongKey = await createWebBotAuthProver(config);
  await expect(
    wrongKey.prove(new Request("https://api.example")),
  ).rejects.toThrow("does not match");
  const request = new Request("https://api.example", {
    headers: { "Signature-Agent": 'webbot="https://existing.example"' },
  });
  await expect(prover.prove(request)).rejects.toThrow("already exists");
});

test("injected Turnkey client receives exact bytes and Ed25519 raw-signing options", async () => {
  let submitted: unknown;
  const activities: string[] = [];
  const client: TurnkeyRawSigner = {
    async signRawPayload(input) {
      submitted = input;
      return {
        r: "01".repeat(32),
        s: "02".repeat(32),
        activity: { id: "activity-1", status: "ACTIVITY_STATUS_COMPLETED" },
      };
    },
  };
  const sign = createTurnkeyBotSigner({
    client,
    organizationId: "org",
    signWith: "key",
    onActivity: (id) => activities.push(id),
  });
  const signature = await sign(new Uint8Array([0, 10, 255]));
  expect(submitted).toEqual({
    organizationId: "org",
    signWith: "key",
    payload: "000aff",
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
  });
  expect(Buffer.from(signature).toString("hex")).toBe(
    "01".repeat(32) + "02".repeat(32),
  );
  expect(activities).toEqual(["activity-1"]);
});

test("denied and pending activities fail closed without exposing client errors", async () => {
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
    { signRawPayload: async () => ({ r: "bad", s: "bad" }) },
  ]) {
    const sign = createTurnkeyBotSigner({
      client,
      organizationId: "org",
      signWith: "key",
    });
    await expect(sign(new Uint8Array([1]))).rejects.toThrow(/Turnkey/);
    await expect(sign(new Uint8Array([1]))).rejects.not.toThrow("sensitive");
  }
});

test("uses a configured label and Signature-Agent key and exposes no sensitive headers", async () => {
  const { keys, publicKeyJwk } = await fixture();
  const prover = await createWebBotAuthProver({
    publicKeyJwk,
    sign: async (bytes) =>
      new Uint8Array(
        await crypto.subtle.sign(
          "Ed25519",
          keys.privateKey,
          Uint8Array.from(bytes),
        ),
      ),
    signatureAgent: "https://bot.example",
    scope: ["https://api.example"],
    label: "bot1",
    signatureAgentKey: "agent1",
  });
  expect("headers" in prover).toBe(false);
  const signed = await prover.prove(new Request("https://api.example"), {
    created: 1_700_000_000,
    nonce: "AAAAAAAAAAAAAAAAAAAAAA",
  });
  expect(signed.headers.get("Signature-Agent")).toBe(
    'agent1="https://bot.example"',
  );
  expect(signed.headers.get("Signature-Input")).toMatch(
    /^bot1=\("@authority" "signature-agent";key="agent1"\);created=1700000000;expires=1700000060;/,
  );
  expect(signed.headers.get("Signature")).toMatch(/^bot1=:/);
});

test("throws TypeError for invalid config and inputs and RangeError for out-of-range numbers", async () => {
  const { publicKeyJwk, prover } = await fixture();
  const config = {
    publicKeyJwk,
    sign: async () => new Uint8Array(64),
    signatureAgent: "https://bot.example",
    scope: ["https://api.example"],
  };
  for (const bad of [
    { scope: "*" as unknown as string[] },
    { scope: [] },
    { scope: ["http://api.example"] },
    { signatureAgent: "http://localhost" },
    { signatureAgent: "not a url" },
    { expiresIn: 1.5 },
    { label: "Bad Label" },
    { signatureAgentKey: "" },
  ]) {
    await expect(
      createWebBotAuthProver({ ...config, ...bad }),
    ).rejects.toBeInstanceOf(TypeError);
  }
  for (const expiresIn of [0, 61]) {
    await expect(
      createWebBotAuthProver({ ...config, expiresIn }),
    ).rejects.toBeInstanceOf(RangeError);
  }
  const request = new Request("https://api.example");
  await expect(
    prover.prove(request, { created: 1.5, nonce: "AAAAAAAAAAAA" }),
  ).rejects.toBeInstanceOf(TypeError);
  await expect(
    prover.prove(request, { created: -1, nonce: "AAAAAAAAAAAA" }),
  ).rejects.toBeInstanceOf(RangeError);
  await expect(
    prover.prove(request, { created: 1, nonce: "short" }),
  ).rejects.toBeInstanceOf(TypeError);
});
