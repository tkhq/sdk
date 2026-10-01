import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";

import {
  DENY_REASONS,
  getURLPatternSource,
  runConformanceCase,
  type ConformanceCase,
  type ConformanceFixtureFile,
} from "../index";

const dir = join(__dirname, "..", "..", "fixtures");
const files = readdirSync(dir)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => ({
    name,
    fixture: JSON.parse(
      readFileSync(join(dir, name), "utf8"),
    ) as ConformanceFixtureFile,
  }));
const allCases: ConformanceCase[] = files.flatMap((f) => f.fixture.cases);

function runAll(): void {
  for (const { name, fixture } of files) {
    describe(name, () => {
      test.each(fixture.cases.map((c) => [c.name, c] as const))(
        "%s",
        (_, testCase) => {
          const result = runConformanceCase(testCase);
          expect(result.actual).toEqual(result.expected);
          expect(result.pass).toBe(true);
        },
      );
    });
  }
}

describe(
  `fixtures (URLPattern: ${
    typeof (globalThis as { URLPattern?: unknown }).URLPattern === "function"
      ? "native"
      : "polyfill"
  })`,
  runAll,
);

// On runtimes with a native URLPattern, run the fixtures again with the
// polyfill, so both implementations are held to the same decisions.
describe("fixtures (URLPattern: polyfill forced)", () => {
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
    expect(getURLPatternSource()).toBe("polyfill");
  });
  runAll();
});

describe("fixture coverage", () => {
  test("every case names its source and has a unique name", () => {
    const names = new Set<string>();
    for (const c of allCases) {
      expect(c.source.length).toBeGreaterThan(0);
      expect(names.has(c.name)).toBe(false);
      names.add(c.name);
    }
  });

  test("every deny reason appears in some fixture", () => {
    const seen = new Set(
      allCases.flatMap((c) =>
        c.kind === "authorize" && c.expect.allowed === false
          ? [c.expect.reason]
          : [],
      ),
    );
    expect(DENY_REASONS.filter((r) => !seen.has(r))).toEqual([]);
  });

  test("every binding error code appears in some fixture", () => {
    const seen = new Set(
      allCases.flatMap((c) =>
        c.kind === "parse" && c.expect.status === "invalid"
          ? [c.expect.error]
          : [],
      ),
    );
    expect([...seen].sort()).toEqual(
      [
        "invalid_fields",
        "invalid_frame_origin",
        "invalid_origin",
        "invalid_property_value",
        "invalid_selector",
        "invalid_url_pattern",
        "missing_origin",
        "unknown_binding_key",
      ].sort(),
    );
  });
});
