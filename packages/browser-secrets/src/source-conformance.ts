/**
 * Runner for the source conformance fixture (`fixtures/source-outcomes.json`).
 * Every source package runs it with a harness that puts its backend (or a
 * mock of it) into each named scenario. The runner drives the source
 * through `connectSource`, so the core's checks apply too.
 */
import {
  connectSource,
  requireSources,
  type ExportOutcome,
  type ExportRequest,
  type PendingHandle,
  type SecretSource,
  type SourceErrorCode,
  type SourceRequirements,
} from "./source";

/** The backend states a harness must be able to set up. */
export type SourceScenario =
  | "ready"
  | "deny"
  | "unknown-secret"
  | "fail-before-submit"
  | "lost-response"
  | "approve"
  | "approve-after-wait"
  | "reject"
  | "expire";

export type SourceFixtureFile = {
  description: string;
  scenarios: {
    name: string;
    scenario: SourceScenario;
    /** The requirement or code path this scenario covers. */
    source: string;
    /** Set when the scenario applies only to sources with approvals. */
    requires?: { approvals?: boolean };
    steps: {
      call: "export" | "resume";
      expect: {
        kind: ExportOutcome["kind"];
        code?: SourceErrorCode;
        submitted?: "no" | "unknown";
      };
    }[];
  }[];
};

export type SourceHarness = {
  /** A fresh source in the scenario's state, and the secret to export. */
  setup(scenario: SourceScenario): Promise<{
    source: SecretSource;
    /** For `unknown-secret`, one the source does not have. */
    secretId: string;
    /** Text the harness put in every vendor error; it must never surface. */
    canary?: string;
    /** For plaintext sources: the value a `ready` outcome must carry. */
    expectedValue?: string;
  }>;
  /** Default: no requirements, because the fixture tests the contract. */
  requirements?: SourceRequirements;
};

export type SourceConformanceResult = {
  name: string;
  pass: boolean;
  /** True when the source lacks approvals and the scenario needs them. */
  skipped: boolean;
  /** Empty when the scenario passed. */
  failures: string[];
};

const NO_REQUIREMENTS = requireSources({
  approvals: false,
  bindings: "any",
  exportPolicy: false,
  audit: "any",
  delivery: "any",
});

/** Runs every scenario in a source fixture file. */
export async function runSourceConformance(
  harness: SourceHarness,
  file: SourceFixtureFile,
): Promise<SourceConformanceResult[]> {
  const results: SourceConformanceResult[] = [];
  for (const scenario of file.scenarios) {
    const failures: string[] = [];
    const result = (skipped = false) => ({
      name: scenario.name,
      pass: failures.length === 0,
      skipped,
      failures,
    });
    const setup = await harness.setup(scenario.scenario);
    let source;
    try {
      source = connectSource(
        setup.source,
        harness.requirements ?? NO_REQUIREMENTS,
      );
    } catch (error) {
      failures.push(`connectSource refused the source: ${String(error)}`);
      results.push(result());
      continue;
    }
    if (scenario.requires?.approvals && !source.capabilities.approvals) {
      results.push(result(true));
      continue;
    }

    let listed;
    let cursor: string | undefined;
    for (let page = 0; page < 100 && !listed; page++) {
      const { refs, nextCursor } = await source.listRefs(
        cursor !== undefined ? { cursor } : {},
      );
      listed = refs.find((ref) => ref.secretId === setup.secretId);
      if ((cursor = nextCursor) === undefined) break;
    }
    if (scenario.scenario === "unknown-secret") {
      if (listed) failures.push("the unknown secret is listed");
    } else if (!listed) {
      failures.push("the secret is not listed");
    } else if (
      listed.source !== source.id ||
      listed.bindingProvenance !== source.capabilities.bindings
    ) {
      failures.push("the listed ref is not stamped with its source");
    }

    const request: ExportRequest = {
      requestId: `conformance-${scenario.scenario}`,
      ref: listed ?? { secretId: setup.secretId, staticProperties: {} },
      ...(source.capabilities.delivery === "ciphertext"
        ? { recipientPublicKey: "test-recipient-key" }
        : {}),
    };
    let handle: PendingHandle | undefined;
    for (const [index, { call, expect }] of scenario.steps.entries()) {
      if (call === "resume" && !handle) {
        failures.push(`step ${index}: resume without a pending handle`);
        break;
      }
      const outcome =
        call === "export"
          ? await source.export(request)
          : await source.resume({ ...request, handle: handle! });
      const fail = (message: string) =>
        failures.push(`step ${index}: ${message}`);
      const before = failures.length;
      if (outcome.kind !== expect.kind) {
        const code = "reason" in outcome ? ` (${outcome.reason.code})` : "";
        fail(`expected ${expect.kind}, got ${outcome.kind}${code}`);
      } else if ("reason" in outcome) {
        if (expect.code !== undefined && outcome.reason.code !== expect.code) {
          fail(`expected code ${expect.code}, got ${outcome.reason.code}`);
        }
        if (
          outcome.reason.secretId !== setup.secretId ||
          outcome.reason.sourceId !== source.id
        ) {
          fail("reason does not name the secret and the source");
        }
        if (
          outcome.kind === "failed" &&
          expect.submitted !== undefined &&
          outcome.submitted !== expect.submitted
        ) {
          fail(
            `expected submitted ${expect.submitted}, got ${outcome.submitted}`,
          );
        }
      } else if (
        outcome.kind === "ready" &&
        outcome.delivery.mode === "plaintext" &&
        setup.expectedValue !== undefined &&
        outcome.delivery.value !== setup.expectedValue
      ) {
        fail("ready value differs from the expected value");
      }
      if (setup.canary && JSON.stringify(outcome).includes(setup.canary)) {
        fail("outcome contains vendor error text");
      }
      if (failures.length > before) break;
      if (outcome.kind === "pending") handle = outcome.handle;
    }
    results.push(result());
  }
  return results;
}
