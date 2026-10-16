import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";

import {
  BrowserSecretsError,
  manifestSource,
  runSourceConformance,
  type ExportOutcome,
  type SecretSource,
  type SourceFixtureFile,
  type SourceHarness,
  type SourceScenario,
} from "../index";

const fixture = JSON.parse(
  readFileSync(
    join(__dirname, "..", "..", "fixtures", "source-outcomes.json"),
    "utf8",
  ),
) as SourceFixtureFile;

const canary = "harness-canary-77e0";

const manifestHarness: SourceHarness = {
  async setup(scenario: SourceScenario) {
    const source = manifestSource({
      id: "onepassword",
      entries: [
        {
          secretId: "op://vault/shop",
          binding: { origin: "https://shop.example" },
        },
      ],
      verify: () => scenario !== "deny",
      resolve: async () => {
        if (scenario === "fail-before-submit") {
          throw new Error(`connect ECONNREFUSED ${canary}`);
        }
        return "correct-horse-battery";
      },
    });
    return {
      source,
      secretId:
        scenario === "unknown-secret"
          ? "op://vault/missing"
          : "op://vault/shop",
      canary,
      expectedValue: "correct-horse-battery",
    };
  },
};

function approvalSource(scenario: SourceScenario): SecretSource {
  let polls = 0;
  const vendorError = () => new Error(`activity error: ${canary}`);
  return {
    id: "turnkey",
    capabilities: {
      bindings: "fixed-at-source",
      approvals: true,
      exportPolicy: true,
      audit: "signed",
      delivery: "ciphertext",
      otp: false,
    },
    listRefs: async ({ cursor }) =>
      cursor === undefined
        ? {
            refs: [
              {
                secretId: "sec-other",
                staticProperties: { "sbm:origin": "https://a.example" },
              },
            ],
            nextCursor: "p2",
          }
        : {
            refs: [
              {
                secretId: "sec-1",
                staticProperties: { "sbm:origin": "https://shop.example" },
              },
            ],
          },
    async export(request): Promise<ExportOutcome> {
      if (
        request.ref.secretId !== "sec-1" &&
        request.ref.secretId !== "sec-other"
      ) {
        return { kind: "denied", reason: { code: "not_found" } };
      }
      switch (scenario) {
        case "ready":
          return {
            kind: "ready",
            delivery: { mode: "ciphertext", bundle: "b1" },
          };
        case "deny":
          return { kind: "denied", reason: { code: "policy_denied" } };
        case "fail-before-submit":
          return {
            kind: "failed",
            reason: { code: "unavailable" },
            submitted: "no",
          };
        case "lost-response":
          throw vendorError();
        default:
          return { kind: "pending", handle: { id: "act-1", state: "held" } };
      }
    },
    async resume(request): Promise<ExportOutcome> {
      if (request.handle.id !== "act-1" || request.handle.state !== "held") {
        throw vendorError();
      }
      polls++;
      switch (scenario) {
        case "approve":
          return {
            kind: "ready",
            delivery: { mode: "ciphertext", bundle: "b1" },
          };
        case "approve-after-wait":
          return polls < 2
            ? { kind: "pending", handle: request.handle }
            : { kind: "ready", delivery: { mode: "ciphertext", bundle: "b1" } };
        case "reject":
          return { kind: "denied", reason: { code: "rejected" } };
        case "expire":
          return { kind: "denied", reason: { code: "expired" } };
        default:
          throw vendorError();
      }
    },
  };
}

const approvalHarness: SourceHarness = {
  async setup(scenario) {
    return {
      source: approvalSource(scenario),
      secretId: scenario === "unknown-secret" ? "sec-missing" : "sec-1",
      canary,
    };
  },
};

const overriding = (
  map: (source: SecretSource, scenario: SourceScenario) => SecretSource,
): SourceHarness => ({
  async setup(scenario) {
    const { source, ...rest } = await manifestHarness.setup(scenario);
    return { ...rest, source: map(source, scenario) };
  },
});

const harnesses: [string, SourceHarness, number][] = [
  ["manifestSource with a mock resolve", manifestHarness, 4],
  ["an approval-capable in-memory source", approvalHarness, 9],
];

describe.each(harnesses)("source conformance: %s", (_, harness, ran) => {
  test("passes every applicable scenario", async () => {
    const results = await runSourceConformance(harness, fixture);
    expect(results.filter((r) => !r.pass)).toEqual([]);
    expect(results.filter((r) => !r.skipped)).toHaveLength(ran);
  });
});

describe("source conformance runner", () => {
  test("reports a source that breaks the contract", async () => {
    const broken = overriding((source, scenario) => ({
      ...source,
      export: async () =>
        scenario === "fail-before-submit"
          ? {
              kind: "failed",
              reason: { code: "source_error" },
              submitted: "no",
            }
          : {
              kind: "ready",
              delivery: { mode: "plaintext", value: "wrong" },
            },
    }));
    const results = await runSourceConformance(broken, fixture);
    const failed = results.filter((r) => !r.pass).map((r) => r.name);
    expect(failed).toEqual([
      "ready on first export",
      "denied by the source",
      "unknown secret is denied as not_found",
    ]);
  });

  test("reports a source whose listing fails instead of throwing", async () => {
    const unlistable = overriding((source) => ({
      ...source,
      listRefs: async () => {
        throw new Error(`list failed ${canary}`);
      },
    }));
    const results = await runSourceConformance(unlistable, fixture);
    const ran = results.filter((r) => !r.skipped);
    expect(ran).toHaveLength(4);
    for (const result of ran) {
      expect(result.pass).toBe(false);
      expect(result.failures).toEqual([
        "listRefs failed: source_error/source_error",
      ]);
      expect(JSON.stringify(result)).not.toContain(canary);
    }
  });

  test("reports a source that connectSource refuses or a harness whose setup fails with the reason only", async () => {
    const refused = overriding((source) => ({
      ...source,
      id: `bad id ${canary}`,
    }));
    const exploding = overriding((source) =>
      Object.defineProperty({ ...source }, "capabilities", {
        get() {
          throw new Error(`vendor sdk ${canary}`);
        },
      }),
    );
    const brokenSetup: SourceHarness = {
      async setup() {
        throw new Error(`backend not reachable ${canary}`);
      },
    };
    for (const [harness, failure] of [
      [
        refused,
        "connectSource refused the source: source_refused/capabilities_invalid",
      ],
      [exploding, "connectSource refused the source: source_error"],
      [brokenSetup, "setup failed: source_error"],
    ] as const) {
      const results = await runSourceConformance(harness, fixture);
      expect(results).toHaveLength(fixture.scenarios.length);
      for (const result of results) {
        expect(result).toMatchObject({ pass: false, skipped: false });
        expect(result.failures).toEqual([failure]);
      }
      expect(JSON.stringify(results)).not.toContain(canary);
    }
  });

  test("prints only known codes and reasons from a forged package error", async () => {
    // `instanceof` passes for any object made from the prototype, so the
    // runner must not trust the fields of one.
    const forged = (code: string, reason?: string) =>
      Object.assign(Object.create(BrowserSecretsError.prototype), {
        code,
        reason,
        message: canary,
      }) as Error;
    for (const error of [
      forged(`code ${canary}`, `reason ${canary}`),
      forged(`code ${canary}`),
      forged("source_refused", `reason ${canary}`),
    ]) {
      const brokenSetup: SourceHarness = {
        async setup() {
          throw error;
        },
      };
      const exploding = overriding((source) =>
        Object.defineProperty({ ...source }, "capabilities", {
          get() {
            throw error;
          },
        }),
      );
      for (const [harness, failure] of [
        [brokenSetup, "setup failed: source_error"],
        [exploding, "connectSource refused the source: source_error"],
      ] as const) {
        const results = await runSourceConformance(harness, fixture);
        expect(results).toHaveLength(fixture.scenarios.length);
        for (const result of results) {
          expect(result).toMatchObject({ pass: false, skipped: false });
          expect(result.failures).toEqual([failure]);
        }
        expect(JSON.stringify(results)).not.toContain(canary);
      }
    }
  });
});
