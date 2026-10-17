import { inspect } from "node:util";
import { describe, expect, test } from "@jest/globals";

import {
  BrowserSecretsError,
  STRICT_SOURCE_REQUIREMENTS,
  connectSource,
  createSecretRef,
  requireSources,
  toSourceReason,
  type ExportRequest,
  type SecretSource,
  type SourceCapabilities,
} from "../index";
import { OPEN } from "./shared";

const canary = "vendor-canary-31f7";

const TURNKEY_CAPS: SourceCapabilities = {
  bindings: "fixed-at-source",
  approvals: true,
  exportPolicy: true,
  audit: "signed",
  delivery: "ciphertext",
  otp: false,
};

const NATIVE_CAPS: SourceCapabilities = {
  bindings: "operator-manifest",
  approvals: false,
  exportPolicy: false,
  audit: "provider-log",
  delivery: "plaintext",
  otp: true,
};

function stubSource(
  capabilities: SourceCapabilities,
  overrides: Record<string, unknown> = {},
): SecretSource {
  return {
    id: "stub",
    capabilities,
    listRefs: async () => ({ refs: [] }),
    export: async () => ({ kind: "denied", reason: { code: "policy_denied" } }),
    ...(capabilities.approvals
      ? {
          resume: async () => ({
            kind: "denied",
            reason: { code: "rejected" },
          }),
        }
      : {}),
    ...overrides,
  } as SecretSource;
}

const request = (extra: Record<string, unknown> = {}) =>
  ({
    requestId: "r1",
    ref: createSecretRef({ secretId: "s1", source: "stub" }),
    recipientPublicKey: "04ab",
    ...extra,
  }) as unknown as ExportRequest;

/** The outcome of one export through `connectSource` for a raw source result. */
const exportRaw = (raw: unknown, caps = TURNKEY_CAPS) =>
  connectSource(stubSource(caps, { export: async () => raw }), OPEN).export(
    request(),
  );

const ids = { secretId: "s1", sourceId: "stub" };

describe("requireSources", () => {
  test("defaults are strict; overrides keep the other defaults", () => {
    expect(requireSources()).toEqual(STRICT_SOURCE_REQUIREMENTS);
    // Pin the literal values, so a change to the defaults fails here.
    expect(STRICT_SOURCE_REQUIREMENTS).toEqual({
      approvals: true,
      bindings: "fixed-at-source",
      exportPolicy: true,
      audit: "signed",
      delivery: "ciphertext",
    });
    expect(requireSources({ approvals: false })).toEqual({
      ...STRICT_SOURCE_REQUIREMENTS,
      approvals: false,
    });
  });

  test("rejects unknown values", () => {
    for (const bad of [
      { approvals: "yes" },
      { bindings: "operator-manifest" },
      { audit: "loud" },
      { delivery: "plaintext" },
    ]) {
      expect(() => requireSources(bad as never)).toThrow(
        expect.objectContaining({ code: "source_config_invalid" }),
      );
    }
  });
});

describe("connectSource requirements", () => {
  const refusal = (
    source: unknown,
    requirements = STRICT_SOURCE_REQUIREMENTS,
  ) => {
    try {
      connectSource(source as SecretSource, requirements);
    } catch (error) {
      return (error as BrowserSecretsError).toJSON();
    }
    return undefined;
  };

  test("a Turnkey-shaped source meets the strict defaults", () => {
    expect(refusal(stubSource(TURNKEY_CAPS))).toBeUndefined();
  });

  test("a source with approvals: false is refused when the host requires approvals", () => {
    expect(
      refusal(stubSource({ ...TURNKEY_CAPS, approvals: false })),
    ).toMatchObject({
      code: "source_refused",
      reason: "approvals_required",
      sourceId: "stub",
    });
  });

  test("each requirement has its own reason, checked in order", () => {
    const cases: [Partial<SourceCapabilities>, string][] = [
      [{ bindings: "operator-manifest" }, "fixed_bindings_required"],
      [{ exportPolicy: false }, "export_policy_required"],
      [{ audit: "provider-log" }, "audit_required"],
      [{ delivery: "plaintext" }, "ciphertext_delivery_required"],
      // Native 1Password fails several; the first in order wins.
      [NATIVE_CAPS, "approvals_required"],
    ];
    for (const [change, reason] of cases) {
      expect(refusal(stubSource({ ...TURNKEY_CAPS, ...change }))).toMatchObject(
        { code: "source_refused", reason, sourceId: "stub" },
      );
    }
  });

  test("audit is a minimum; opting out of everything accepts a native source", () => {
    const source = stubSource({ ...TURNKEY_CAPS, audit: "provider-log" });
    expect(
      refusal(source, requireSources({ audit: "provider-log" })),
    ).toBeUndefined();
    expect(refusal(stubSource(NATIVE_CAPS), OPEN)).toBeUndefined();
  });

  test("a partial or malformed requirements object is refused, never read as any", () => {
    // Only `requireSources` may fill in defaults. A host that hands
    // `connectSource` a partial object must not get looser checks.
    for (const bad of [
      { approvals: false },
      { ...OPEN, audit: undefined },
      { ...OPEN, bindings: "operator-manifest" },
      null,
      "strict",
    ]) {
      expect(refusal(stubSource(NATIVE_CAPS), bad as never)).toMatchObject({
        code: "source_config_invalid",
      });
    }
  });

  test("capabilities are read once, so a getter cannot change after the check", () => {
    let reads = 0;
    const capabilities = {
      ...TURNKEY_CAPS,
      get delivery() {
        return reads++ === 0 ? "ciphertext" : "plaintext";
      },
    } as SourceCapabilities;
    const connected = connectSource(stubSource(capabilities));
    expect(connected.capabilities.delivery).toBe("ciphertext");
  });

  test("malformed sources are refused as capabilities_invalid", () => {
    const bad: unknown[] = [
      null,
      {},
      stubSource({ ...TURNKEY_CAPS, approvals: "yes" as never }),
      stubSource({ ...TURNKEY_CAPS, otp: undefined as never }),
      { ...stubSource(TURNKEY_CAPS), resume: undefined },
      stubSource(TURNKEY_CAPS, { id: "Turnkey" }),
      stubSource(TURNKEY_CAPS, { export: undefined }),
    ];
    for (const source of bad) {
      expect(refusal(source, OPEN)).toMatchObject({
        code: "source_refused",
        reason: "capabilities_invalid",
      });
    }
    // An invalid ID is not echoed back.
    expect(
      refusal(stubSource(TURNKEY_CAPS, { id: `Bad ${canary}` })),
    ).not.toHaveProperty("sourceId");
  });
});

describe("connectSource listRefs", () => {
  test("stamps the source and binding provenance", async () => {
    const connected = connectSource(
      stubSource(NATIVE_CAPS, {
        listRefs: async () => ({
          refs: [
            {
              secretId: "op://v/i",
              name: "Shop",
              staticProperties: { "sbm:origin": "https://shop.example" },
              // A source cannot claim fixed bindings for its refs.
              source: "turnkey",
              bindingProvenance: "fixed-at-source",
              vendor: canary,
            },
          ],
          nextCursor: "2",
        }),
      }),
      OPEN,
    );
    expect(await connected.listRefs()).toEqual({
      refs: [
        {
          secretId: "op://v/i",
          name: "Shop",
          source: "stub",
          bindingProvenance: "operator-manifest",
          staticProperties: { "sbm:origin": "https://shop.example" },
          binding: { origin: "https://shop.example" },
        },
      ],
      nextCursor: "2",
    });
  });

  test("a malformed listing is a safe invalid_response error", async () => {
    for (const listing of [
      null,
      { refs: "nope" },
      { refs: [{ secretId: "" }] },
      { refs: [{ secretId: "a", staticProperties: { "op:ref": 1 } }] },
      { refs: [], nextCursor: 3 },
    ]) {
      const connected = connectSource(
        stubSource(TURNKEY_CAPS, { listRefs: async () => listing }),
      );
      await expect(connected.listRefs()).rejects.toMatchObject({
        code: "source_error",
        reason: "invalid_response",
        sourceId: "stub",
      });
    }
  });

  test("listing entries are read once, so a getter cannot change after the check", async () => {
    let reads = 0;
    const entry = {
      secretId: "s1",
      get name(): unknown {
        return reads++ === 0 ? "Shop" : { leak: canary };
      },
    };
    const connected = connectSource(
      stubSource(TURNKEY_CAPS, { listRefs: async () => ({ refs: [entry] }) }),
    );
    const { refs } = await connected.listRefs();
    expect(refs[0]?.name).toBe("Shop");
    expect(JSON.stringify(refs)).not.toContain(canary);
  });

  test("a thrown listing error drops the vendor text", async () => {
    const connected = connectSource(
      stubSource(TURNKEY_CAPS, {
        listRefs: async () => {
          throw Object.assign(new Error(`401 from vault: ${canary}`), {
            body: canary,
          });
        },
      }),
    );
    const error = await connected.listRefs().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BrowserSecretsError);
    for (const text of [
      JSON.stringify(error),
      inspect(error),
      String(error),
      (error as Error).stack ?? "",
    ]) {
      expect(text).not.toContain(canary);
    }
  });
});

describe("connectSource outcomes", () => {
  test("are rebuilt from known fields only", async () => {
    const outcomes = [
      await exportRaw({
        kind: "denied",
        reason: { code: "policy_denied", message: canary, secretId: "other" },
        vendor: canary,
      }),
      await exportRaw({
        kind: "failed",
        reason: { code: canary },
        submitted: "maybe",
        detail: canary,
      }),
      await exportRaw({
        kind: "ready",
        delivery: { mode: "ciphertext", bundle: "b1", raw: canary },
        expiresAt: 1_000,
        item: canary,
      }),
      await exportRaw({
        kind: "pending",
        handle: { id: "act-1", expiresAt: 5, state: "{}", token: canary },
        approvalUrl: "https://app.turnkey.com/a/1",
      }),
      await exportRaw({
        kind: "pending",
        handle: { id: "act-1" },
        approvalUrl: "javascript:alert(1)",
      }),
    ];
    expect(outcomes).toEqual([
      { kind: "denied", reason: { code: "policy_denied", ...ids } },
      // Unknown codes and submitted values fail safe.
      {
        kind: "failed",
        reason: { code: "source_error", ...ids },
        submitted: "unknown",
      },
      // A source without otp cannot shorten redaction.
      { kind: "ready", delivery: { mode: "ciphertext", bundle: "b1" } },
      {
        kind: "pending",
        handle: { id: "act-1", expiresAt: 5, state: "{}" },
        approvalUrl: "https://app.turnkey.com/a/1",
      },
      { kind: "pending", handle: { id: "act-1" } },
    ]);
    expect(JSON.stringify(outcomes)).not.toContain(canary);
  });

  test("only a source that declares otp can set expiresAt on a ready value", async () => {
    const ready = {
      kind: "ready",
      delivery: { mode: "plaintext", value: "482913" },
      expiresAt: 1_000,
    };
    expect(await exportRaw(ready, NATIVE_CAPS)).toEqual({
      kind: "ready",
      delivery: { mode: "plaintext", value: "482913" },
      expiresAt: 1_000,
    });
    expect(await exportRaw(ready, { ...NATIVE_CAPS, otp: false })).toEqual({
      kind: "ready",
      delivery: { mode: "plaintext", value: "482913" },
    });
  });

  test("outcomes the source did not declare are invalid_response", async () => {
    const cases: [unknown, SourceCapabilities?][] = [
      [{ kind: "pending", handle: { id: "h" } }, NATIVE_CAPS],
      [{ kind: "ready", delivery: { mode: "plaintext", value: "v" } }],
      [
        { kind: "ready", delivery: { mode: "ciphertext", bundle: "b" } },
        NATIVE_CAPS,
      ],
      [{ kind: "ready", delivery: { mode: "ciphertext", bundle: "" } }],
      [
        {
          kind: "ready",
          delivery: { mode: "ciphertext", bundle: "b" },
          expiresAt: "soon",
        },
      ],
      [{ kind: "pending", handle: { id: "" } }],
      [{ kind: "pending", handle: { id: "h", state: { key: 1 } } }],
      [{ kind: "done" }],
      [undefined],
    ];
    for (const [raw, caps] of cases) {
      expect(await exportRaw(raw, caps)).toEqual({
        kind: "failed",
        reason: { code: "invalid_response", ...ids },
        submitted: "unknown",
      });
    }
  });

  test("outcome fields are read once, so a getter cannot change after the check", async () => {
    let stateReads = 0;
    const pending = await exportRaw({
      kind: "pending",
      handle: {
        id: "act-1",
        get state(): unknown {
          return stateReads++ === 0 ? undefined : { key: canary };
        },
      },
    });
    expect(pending).toEqual({ kind: "pending", handle: { id: "act-1" } });

    let bundleReads = 0;
    const ready = await exportRaw({
      kind: "ready",
      delivery: {
        mode: "ciphertext",
        get bundle(): unknown {
          return bundleReads++ === 0 ? "b1" : 7;
        },
      },
    });
    expect(ready).toEqual({
      kind: "ready",
      delivery: { mode: "ciphertext", bundle: "b1" },
    });
    expect(JSON.stringify([pending, ready])).not.toContain(canary);
  });

  test("requests are checked before the source sees them", async () => {
    let calls = 0;
    const connected = connectSource(
      stubSource(TURNKEY_CAPS, {
        export: async () => {
          calls++;
          return { kind: "denied", reason: { code: "policy_denied" } };
        },
      }),
    );
    for (const bad of [
      request({ ref: createSecretRef({ secretId: "s1", source: "other" }) }),
      request({ recipientPublicKey: undefined }),
      request({ ref: undefined }),
      request({ ref: { secretId: "", staticProperties: {} } }),
      request({ requestId: "" }),
      undefined as unknown as ExportRequest,
    ]) {
      await expect(connected.export(bad)).rejects.toMatchObject({
        code: "invalid_request",
      });
    }
    expect(calls).toBe(0);
  });

  test("the source sees the checked request, so a getter cannot change after the check", async () => {
    const seen: unknown[] = [];
    const record = async (r: ExportRequest) => {
      seen.push([r.requestId, r.ref.secretId, r.ref.source]);
      return { kind: "denied", reason: { code: "rejected" } };
    };
    const connected = connectSource(
      stubSource(TURNKEY_CAPS, { export: record, resume: record }),
    );
    const shifting = () => {
      let reads = 0;
      const later =
        <T>(first: T, next: string) =>
        () =>
          reads++ < 3 ? first : next;
      const secretId = later("s1", `other ${canary}`);
      const source = later(undefined, "stub");
      const requestId = later("r1", `other ${canary}`);
      return {
        get requestId() {
          return requestId();
        },
        ref: {
          staticProperties: {},
          get secretId() {
            return secretId();
          },
          get source() {
            return source();
          },
        },
        recipientPublicKey: "04ab",
      } as unknown as ExportRequest;
    };
    await connected.export(shifting());
    await connected.resume({ ...shifting(), handle: { id: "h" } });
    expect(seen).toEqual([
      ["r1", "s1", "stub"],
      ["r1", "s1", "stub"],
    ]);
  });

  test("resume requires approvals and a handle", async () => {
    const handle = { id: "h" };
    const native = connectSource(stubSource(NATIVE_CAPS), OPEN);
    await expect(native.resume({ ...request(), handle })).rejects.toMatchObject(
      { code: "invalid_request" },
    );
    const turnkey = connectSource(stubSource(TURNKEY_CAPS));
    await expect(
      turnkey.resume({ ...request(), handle: { id: "" } }),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(await turnkey.resume({ ...request(), handle })).toEqual({
      kind: "denied",
      reason: { code: "rejected", ...ids },
    });
  });

  test("resume rejects a malformed handle before the source sees it", async () => {
    let calls = 0;
    const turnkey = connectSource(
      stubSource(TURNKEY_CAPS, {
        resume: async () => {
          calls++;
          return { kind: "denied", reason: { code: "rejected" } };
        },
      }),
    );
    for (const handle of [
      undefined,
      { id: "h", state: { key: canary } },
      { id: "h", state: 7 },
      { id: "h", expiresAt: "soon" },
      { id: "h", expiresAt: Number.NaN },
      { id: "h", expiresAt: Infinity },
    ]) {
      await expect(
        turnkey.resume({ ...request(), handle } as never),
      ).rejects.toMatchObject({ code: "invalid_request" });
    }
    expect(calls).toBe(0);
  });

  test("resume denies an expired handle as expired without calling the source", async () => {
    const seen: unknown[] = [];
    const turnkey = connectSource(
      stubSource(TURNKEY_CAPS, {
        resume: async (r: { handle: unknown }) => {
          seen.push(r.handle);
          return { kind: "pending", handle: r.handle };
        },
      }),
    );
    expect(
      await turnkey.resume({ ...request(), handle: { id: "h", expiresAt: 1 } }),
    ).toEqual({ kind: "denied", reason: { code: "expired", ...ids } });
    expect(seen).toEqual([]);

    const later = Date.now() + 60_000;
    expect(
      await turnkey.resume({
        ...request(),
        handle: { id: "h", expiresAt: later, state: "s" },
      }),
    ).toEqual({
      kind: "pending",
      handle: { id: "h", expiresAt: later, state: "s" },
    });
    expect(seen).toEqual([{ id: "h", expiresAt: later, state: "s" }]);
  });
});

test("toSourceReason keeps a safe source code and drops everything else", () => {
  expect(
    toSourceReason(new BrowserSecretsError("source_error", "not_found"), {
      secretId: "s",
    }),
  ).toEqual({ code: "not_found", secretId: "s" });
  expect(toSourceReason(new Error(canary), { sourceId: "x" })).toEqual({
    code: "source_error",
    sourceId: "x",
  });
  expect(
    toSourceReason(
      new BrowserSecretsError("destination_denied", "selector_mismatch"),
      {},
      "unavailable",
    ),
  ).toEqual({ code: "unavailable" });
});
