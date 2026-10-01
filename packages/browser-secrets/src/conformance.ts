/**
 * Runner for the JSON conformance fixtures in `fixtures/*.json`. Host
 * adapters and any future port (for example a native one) must reproduce
 * every expected result. The fixture files are the specification; this
 * runner is the reference implementation of how to read them.
 */
import { authorize, type DenyReason } from "./authorize";
import { parseBinding } from "./binding";
import type {
  BindingErrorCode,
  FillRequest,
  SecretBinding,
  TargetObservation,
} from "./types";

export type ParseFixtureCase = {
  kind: "parse";
  name: string;
  /** The test or code path this case reproduces. */
  source: string;
  staticProperties: Record<string, unknown>;
  expect:
    | { status: "unbound" }
    | { status: "bound"; binding: SecretBinding }
    | { status: "invalid"; error: BindingErrorCode };
};

export type AuthorizeFixtureCase = {
  kind: "authorize";
  name: string;
  source: string;
  secret: {
    secretId: string;
    name?: string;
    staticProperties: Record<string, string>;
  };
  request: FillRequest;
  observation: TargetObservation;
  expect:
    | { allowed: true }
    | { allowed: false; reason: DenyReason; targetIndex?: number };
};

export type ConformanceCase = ParseFixtureCase | AuthorizeFixtureCase;

export type ConformanceFixtureFile = {
  description: string;
  cases: ConformanceCase[];
};

export type ConformanceResult = {
  name: string;
  pass: boolean;
  expected: unknown;
  actual: unknown;
};

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          canonical((value as Record<string, unknown>)[key]),
        ]),
    );
  }
  return value;
}

const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/** Runs one fixture case and compares the result with its expectation. */
export function runConformanceCase(
  testCase: ConformanceCase,
): ConformanceResult {
  if (testCase.kind === "parse") {
    const parsed = parseBinding(testCase.staticProperties);
    // canonical() copies the prototype-free fields map into a plain object.
    const actual = canonical(parsed);
    return {
      name: testCase.name,
      pass: same(actual, testCase.expect),
      expected: testCase.expect,
      actual,
    };
  }
  const decision = authorize(
    testCase.secret,
    testCase.request,
    testCase.observation,
  );
  const actual = decision.allowed
    ? { allowed: true }
    : {
        allowed: false,
        reason: decision.reason,
        ...(testCase.expect.allowed === false &&
        testCase.expect.targetIndex !== undefined &&
        decision.targetIndex !== undefined
          ? { targetIndex: decision.targetIndex }
          : {}),
      };
  return {
    name: testCase.name,
    pass: same(actual, testCase.expect),
    expected: testCase.expect,
    actual,
  };
}

/** Runs every case in a fixture file. */
export function runConformanceFixture(
  file: ConformanceFixtureFile,
): ConformanceResult[] {
  return file.cases.map(runConformanceCase);
}
