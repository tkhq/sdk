import { describe, expect, test } from "@jest/globals";

import {
  BrowserSecretsError,
  authorize,
  connectSource,
  createSecretRef,
  manifestSource,
  requireSources,
  type ManifestEntry,
  type ManifestSourceOptions,
  type SecretRef,
  type TargetObservation,
} from "../index";
import { OPEN } from "./shared";

const canary = "op-canary-9d2a";

const shop: ManifestEntry = {
  secretId: "op://vault/shop",
  name: "Shop login",
  binding: {
    origin: "https://shop.example",
    urlPattern: "/login*",
    selector: "input[name=password]",
  },
  properties: { "op:ref": "op://vault/shop/password" },
};

const card: ManifestEntry = {
  secretId: "op://vault/card",
  binding: {
    origin: "https://pay.example",
    frameOrigin: "https://frames.pay.example",
    fields: { number: "input[name=cc]", cvc: "input[name=cvc]" },
  },
};

const make = (overrides: Partial<ManifestSourceOptions> = {}) =>
  manifestSource({
    id: "onepassword",
    entries: [shop, card],
    resolve: async () => "hunter2-correct-horse",
    ...overrides,
  });

/** Connects a manifest source and returns it with its first ref. */
async function connect(overrides: Partial<ManifestSourceOptions> = {}) {
  const source = connectSource(make(overrides), OPEN);
  const [ref] = (await source.listRefs()).refs;
  const exportRef = (r: SecretRef = ref!) =>
    source.export({ requestId: "r1", ref: r });
  return { source, ref: ref!, exportRef };
}

const ids = { secretId: "op://vault/shop", sourceId: "onepassword" };

describe("manifestSource entries", () => {
  test("compile into sbm:* static properties", async () => {
    const { source } = await connect();
    const { refs } = await source.listRefs();
    expect(refs.map((r) => r.staticProperties)).toEqual([
      {
        "op:ref": "op://vault/shop/password",
        "sbm:origin": "https://shop.example",
        "sbm:url-pattern": "/login*",
        "sbm:selector": "input[name=password]",
      },
      {
        "sbm:origin": "https://pay.example",
        "sbm:frame-origin": "https://frames.pay.example",
        "sbm:fields": JSON.stringify(card.binding.fields),
      },
    ]);
    expect(refs[0]).toMatchObject({
      source: "onepassword",
      bindingProvenance: "operator-manifest",
    });
  });

  test("refuse entries that would not bind strictly", () => {
    const bad: unknown[] = [
      null,
      { ...shop, secretId: "" },
      { ...shop, name: 7 },
      { ...shop, binding: undefined },
      { ...shop, binding: { origin: "https://shop.example/login" } },
      { ...shop, binding: { origin: "https://shop.example", fields: {} } },
      // JSON.stringify turns a function or symbol into undefined, which must
      // not compile into an origin-only binding.
      {
        ...shop,
        binding: { origin: "https://shop.example", fields: () => {} },
      },
      {
        ...shop,
        binding: { origin: "https://shop.example", fields: Symbol("f") },
      },
      // A plain object whose toJSON returns undefined stringifies to
      // undefined too.
      {
        ...shop,
        binding: {
          origin: "https://shop.example",
          fields: { cc: "#cc", toJSON: () => undefined },
        },
      },
      { ...shop, binding: { origin: "https://shop.example", fields: "cc" } },
      { ...shop, binding: { origin: "https://shop.example", fields: ["cc"] } },
      { ...shop, binding: { origin: "https://shop.example", urlPattern: 7 } },
      // Bindings come from `binding` only.
      { ...shop, properties: { "sbm:origin": "https://evil.example" } },
      { ...shop, properties: { "op:ref": 1 } },
    ];
    for (const entry of bad) {
      expect(() => make({ entries: [entry as ManifestEntry] })).toThrow(
        expect.objectContaining({ code: "source_config_invalid" }),
      );
    }
    expect(() => make({ entries: [shop, shop] })).toThrow(
      expect.objectContaining({
        code: "source_config_invalid",
        secretId: "op://vault/shop",
      }),
    );
  });

  test("refuse an audit, otp, resolve, or verify value the source cannot keep", () => {
    // With audit left at the strict "signed" default, a source that
    // claimed a signed record would be accepted.
    const auditRequired = requireSources({
      approvals: false,
      bindings: "any",
      exportPolicy: false,
      delivery: "any",
    });
    for (const bad of [
      { audit: "signed" },
      { audit: canary },
      { otp: "yes" },
      { otp: null },
      { resolve: "op read" },
      { verify: "yes" },
    ]) {
      let error: unknown;
      try {
        connectSource(make(bad as never), auditRequired);
      } catch (e) {
        error = e;
      }
      expect(error).toMatchObject({
        code: "source_config_invalid",
        sourceId: "onepassword",
      });
      expect(JSON.stringify(error)).not.toContain(canary);
    }
    expect(() =>
      connectSource(make({ audit: "provider-log" }), auditRequired),
    ).toThrow(expect.objectContaining({ reason: "audit_required" }));
  });

  test("the strict defaults refuse the source; an explicit opt-out accepts it", () => {
    expect(() => connectSource(make())).toThrow(
      expect.objectContaining({
        code: "source_refused",
        reason: "approvals_required",
      }),
    );
    expect(() =>
      connectSource(make(), requireSources({ approvals: false })),
    ).toThrow(expect.objectContaining({ reason: "fixed_bindings_required" }));
    expect(connectSource(make(), OPEN).capabilities).toMatchObject({
      bindings: "operator-manifest",
      approvals: false,
      delivery: "plaintext",
    });
  });
});

describe("manifestSource export", () => {
  test("verifies, then resolves at fill time with no cache", async () => {
    const calls: string[] = [];
    let n = 0;
    const { exportRef } = await connect({
      verify: async (ref) => {
        calls.push(`verify ${ref.binding?.origin}`);
        return true;
      },
      resolve: async (entry) => {
        calls.push(`resolve ${entry.properties?.["op:ref"]}`);
        return `value-number-${++n}`;
      },
    });
    expect(await exportRef()).toEqual({
      kind: "ready",
      delivery: { mode: "plaintext", value: "value-number-1" },
    });
    expect(await exportRef()).toMatchObject({
      delivery: { value: "value-number-2" },
    });
    expect(calls).toEqual([
      "verify https://shop.example",
      "resolve op://vault/shop/password",
      "verify https://shop.example",
      "resolve op://vault/shop/password",
    ]);
  });

  test("verify sees the source's own ref, not the caller's", async () => {
    let seen: SecretRef | undefined;
    const { exportRef } = await connect({
      verify: (ref) => {
        seen = ref;
        return true;
      },
    });
    await exportRef(
      createSecretRef({
        secretId: "op://vault/shop",
        source: "onepassword",
        staticProperties: { "sbm:origin": "https://evil.example" },
      }),
    );
    expect(seen?.binding?.origin).toBe("https://shop.example");
  });

  test("a failed verify denies without resolving", async () => {
    let resolved = 0;
    const { exportRef } = await connect({
      verify: () => false,
      resolve: async () => `never-returned-${++resolved}`,
    });
    expect(await exportRef()).toEqual({
      kind: "denied",
      reason: { code: "verification_failed", ...ids },
    });
    expect(resolved).toBe(0);
  });

  test("a verify or resolve error fails safely, with no vendor text", async () => {
    for (const options of [
      {
        verify: () => {
          throw new Error(canary);
        },
      },
      {
        resolve: async () => {
          throw Object.assign(new Error(`item not found: ${canary}`), {
            body: canary,
          });
        },
      },
    ]) {
      const { exportRef } = await connect(options);
      const outcome = await exportRef();
      expect(outcome).toEqual({
        kind: "failed",
        reason: { code: "source_error", ...ids },
        submitted: "no",
      });
      expect(JSON.stringify(outcome)).not.toContain(canary);
    }
    const { exportRef } = await connect({
      resolve: async () => {
        throw new BrowserSecretsError("source_error", "unavailable");
      },
    });
    expect(await exportRef()).toMatchObject({
      reason: { code: "unavailable" },
    });
  });

  test("short-lived values carry their expiry; malformed values are invalid_response", async () => {
    const resolve = async () => ({ value: "123456", expiresAt: 30_000 });
    const otp = await connect({ resolve, otp: true });
    expect(await otp.exportRef()).toEqual({
      kind: "ready",
      delivery: { mode: "plaintext", value: "123456" },
      expiresAt: 30_000,
    });
    // Without otp the expiry is dropped: the value is redacted until released.
    const password = await connect({ resolve });
    expect(await password.exportRef()).toEqual({
      kind: "ready",
      delivery: { mode: "plaintext", value: "123456" },
    });
    for (const value of [
      "",
      { value: 5 },
      { value: "x", expiresAt: "soon" },
      null,
    ]) {
      const { exportRef } = await connect({
        resolve: async () => value as never,
      });
      expect(await exportRef()).toMatchObject({
        kind: "failed",
        reason: { code: "invalid_response" },
        submitted: "no",
      });
    }
  });
});

test("authorize decides a manifest ref like the same Turnkey binding", async () => {
  const { ref: manifestRef } = await connect();
  const turnkeyRef = createSecretRef({
    secretId: "tk-1",
    source: "turnkey",
    bindingProvenance: "fixed-at-source",
    staticProperties: { ...manifestRef.staticProperties },
  });
  const observation = (path: string, matches: boolean): TargetObservation => ({
    browserSessionId: "b",
    tabId: "t",
    topLevelUrl: `https://shop.example${path}`,
    targets: [
      {
        elementId: "e1",
        frames: [
          {
            frameId: "f0",
            documentId: "d0",
            url: `https://shop.example${path}`,
            origin: "https://shop.example",
          },
        ],
        selectorMatches: { "input[name=password]": matches },
      },
    ],
  });
  const fill = { targets: [{ elementId: "e1" }] };
  for (const [path, matches] of [
    ["/login", true],
    ["/login", false],
    ["/account", true],
  ] as const) {
    const a = authorize(manifestRef, fill, observation(path, matches));
    const b = authorize(turnkeyRef, fill, observation(path, matches));
    expect(a.allowed ? "allowed" : a.reason).toBe(
      b.allowed ? "allowed" : b.reason,
    );
  }
});
