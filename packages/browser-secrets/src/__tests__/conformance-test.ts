import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";

import {
  DENY_REASONS,
  runConformanceCase,
  type ConformanceFixtureFile,
} from "../index";
import { getURLPattern, polyfillURLPattern } from "../urlpattern";

const fixture = JSON.parse(
  readFileSync(
    join(__dirname, "..", "..", "fixtures", "conformance.json"),
    "utf8",
  ),
) as ConformanceFixtureFile;

function runAll(): void {
  test.each(fixture.cases.map((c) => [c.name, c] as const))(
    "%s",
    (_, testCase) => {
      const result = runConformanceCase(testCase);
      expect(result.actual).toEqual(result.expected);
      expect(result.pass).toBe(true);
    },
  );
}

const source = () =>
  getURLPattern() === polyfillURLPattern ? "polyfill" : "native";

describe(`conformance (URLPattern: ${source()})`, runAll);

// On runtimes with a native URLPattern, run the cases again with the
// polyfill, so both implementations are held to the same decisions.
describe("conformance (URLPattern: polyfill forced)", () => {
  const scope = globalThis as { URLPattern?: unknown };
  let saved: unknown;
  beforeAll(() => {
    saved = scope.URLPattern;
    delete scope.URLPattern;
  });
  afterAll(() => {
    if (saved !== undefined) scope.URLPattern = saved;
  });
  test("the polyfill is in use", () => {
    expect(source()).toBe("polyfill");
  });
  runAll();
});

test("every deny reason has a fixture case", () => {
  const seen = new Set(
    fixture.cases.flatMap((c) =>
      c.kind === "authorize" && c.expect.allowed === false
        ? [c.expect.reason]
        : [],
    ),
  );
  expect(DENY_REASONS.filter((r) => !seen.has(r))).toEqual([]);
});
