import { inspect } from "node:util";
import { describe, expect, test } from "@jest/globals";

import { RedactionRegistry, type RedactionTarget } from "../index";

const canary = "canary-Secret-7f3a!";

describe("RedactionRegistry.scrubText", () => {
  test("replaces every occurrence and leaves other text alone", () => {
    const r = new RedactionRegistry();
    r.registerValue(canary, "s1");
    expect(r.scrubText(`a ${canary} b ${canary}`)).toBe(
      "a [REDACTED:s1] b [REDACTED:s1]",
    );
    expect(r.scrubText("nothing here")).toBe("nothing here");
  });

  test("merges overlapping matches so no fragment survives", () => {
    const r = new RedactionRegistry();
    r.registerValues([
      { value: "abcd", secretId: "s1" },
      { value: "cdef", secretId: "s2" },
    ]);
    expect(r.scrubText("xxabcdefyy")).toBe("xx[REDACTED]yy");
    const same = new RedactionRegistry();
    same.registerValue("aa", "s1");
    expect(same.scrubText("baaab")).toBe("b[REDACTED:s1]b");
  });

  test("a value nested in a longer one is covered by the longer match", () => {
    const r = new RedactionRegistry();
    r.registerValues([
      { value: "4242", secretId: "cvc" },
      { value: "4242424242424242", secretId: "card" },
    ]);
    expect(r.scrubText("n=4242424242424242;c=4242")).toBe(
      "n=[REDACTED];c=[REDACTED:cvc]",
    );
  });

  test("catches JSON-escaped and URL-encoded copies", () => {
    const r = new RedactionRegistry();
    const value = 'p@ss "word"/+ é';
    r.registerValue(value, "s1");
    expect(r.scrubText(JSON.stringify({ password: value }))).toBe(
      '{"password":"[REDACTED:s1]"}',
    );
    expect(r.scrubText(`password=${encodeURIComponent(value)}`)).toBe(
      "password=[REDACTED:s1]",
    );
    const form = new URLSearchParams({ password: value }).toString();
    expect(r.scrubText(form)).toBe("password=[REDACTED:s1]");
  });

  test("encoded variants can be turned off", () => {
    const r = new RedactionRegistry({ encodedVariants: false });
    r.registerValue("a b", "s1");
    expect(r.valueCount).toBe(1);
    expect(r.scrubText("a%20b")).toBe("a%20b");
  });

  test("ignores empty values", () => {
    const r = new RedactionRegistry();
    r.registerValue("", "s1");
    expect(r.valueCount).toBe(0);
    expect(r.scrubText("abc")).toBe("abc");
  });

  test("custom marker", () => {
    const r = new RedactionRegistry({ marker: () => "***" });
    r.registerValue(canary, "s1");
    expect(r.scrubText(canary)).toBe("***");
  });
});

describe("RedactionRegistry.scrub", () => {
  test("scrubs keys and values of JSON-like data and never mutates input", () => {
    const r = new RedactionRegistry();
    r.registerValue(canary, "s1");
    const input = {
      text: `value ${canary}`,
      list: [canary, 1, null, true, { deep: [canary] }],
      [canary]: "key leak",
    };
    const before = JSON.stringify(input);
    const out = r.scrub(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(JSON.stringify(out)).not.toContain(canary);
    expect(out.list[1]).toBe(1);
    expect(Object.keys(out)).toContain("[REDACTED:s1]");
  });

  test("handles cycles and objects with a __proto__ key", () => {
    const r = new RedactionRegistry();
    r.registerValue(canary, "s1");
    const cyclic: Record<string, unknown> = { v: canary };
    cyclic["self"] = cyclic;
    const out = r.scrub(cyclic) as Record<string, unknown>;
    expect(out["self"]).toBe("[Circular]");
    const parsed = JSON.parse(`{"__proto__": "${canary}"}`);
    const scrubbed = r.scrub(parsed) as Record<string, unknown>;
    expect(Object.getPrototypeOf(scrubbed)).toBe(Object.prototype);
    expect(JSON.stringify(scrubbed)).toBe('{"__proto__":"[REDACTED:s1]"}');
  });

  test("scrubTexts batches strings", () => {
    const r = new RedactionRegistry();
    r.registerValue(canary, "s1");
    expect(r.scrubTexts([canary, "ok"])).toEqual(["[REDACTED:s1]", "ok"]);
  });
});

describe("targets and release", () => {
  const target: RedactionTarget = {
    browserSessionId: "b1",
    tabId: "t1",
    frameId: "f1",
    documentId: "d1",
    elementId: "e1",
  };

  test("target tags are document-scoped", () => {
    const r = new RedactionRegistry();
    r.registerTarget(target, "s1");
    expect(r.isRegisteredTarget(target)).toBe(true);
    expect(r.secretIdForTarget(target)).toBe("s1");
    expect(r.isRegisteredTarget({ ...target, documentId: "d2" })).toBe(false);
    expect(r.isRegisteredTarget({ ...target, browserSessionId: "b2" })).toBe(
      false,
    );
    r.releaseDocument(target);
    expect(r.isRegisteredTarget(target)).toBe(false);
  });

  test("releaseSecret drops that secret's values and targets only", () => {
    const r = new RedactionRegistry();
    r.registerValues([
      { value: "one-value", secretId: "s1" },
      { value: "two-value", secretId: "s2" },
      { value: "shared", secretId: "s1" },
      { value: "shared", secretId: "s2" },
    ]);
    r.registerTarget(target, "s1");
    r.registerTarget({ ...target, elementId: "e2" }, "s2");
    r.releaseSecret("s1");
    expect(r.scrubText("one-value two-value shared")).toBe(
      "one-value [REDACTED:s2] [REDACTED:s2]",
    );
    expect(r.isRegisteredTarget(target)).toBe(false);
    expect(r.isRegisteredTarget({ ...target, elementId: "e2" })).toBe(true);
    r.clear();
    expect(r.valueCount).toBe(0);
    expect(r.targetCount).toBe(0);
  });

  test("the registry does not print its values", () => {
    const r = new RedactionRegistry();
    r.registerValue(canary, "s1");
    expect(JSON.stringify(r)).not.toContain(canary);
    r.scrubText(canary);
    expect(JSON.stringify(r)).toBe('{"valueCount":1,"targetCount":0}');
    expect(inspect(r)).not.toContain(canary);
    expect(String(r)).not.toContain(canary);
  });
});

describe("indexOf and regex scan paths agree", () => {
  // Nine or more scan strings switch scrubText to one regex alternation.
  const decoys = Array.from({ length: 12 }, (_, i) => ({
    value: `decoy-${i}-zz`,
    secretId: `d${i}`,
  }));
  // One registry scans with indexOf, the other with the regex.
  const withDecoys = (entries: { value: string; secretId: string }[]) =>
    [entries, [...entries, ...decoys]].map((list) => {
      const registry = new RedactionRegistry({ encodedVariants: false });
      registry.registerValues(list);
      return registry;
    });

  test.each([
    [
      "overlap between values",
      [
        ["abcd", "s1"],
        ["cdef", "s2"],
      ],
      "xxabcdefyy",
      "xx[REDACTED]yy",
    ],
    ["self-overlap", [["aa", "s1"]], "baaab", "b[REDACTED:s1]b"],
    [
      "nested value",
      [
        ["4242", "c"],
        ["4242424242424242", "n"],
      ],
      "4242424242424242;4242",
      "[REDACTED];[REDACTED:c]",
    ],
    [
      "regex metacharacters",
      [["a.b*c(d)[e]{f}|g^h$i\\j/k-l+m?", "s1"]],
      "x a.b*c(d)[e]{f}|g^h$i\\j/k-l+m? y",
      "x [REDACTED:s1] y",
    ],
    [
      "no false match on metacharacters",
      [["a.c", "s1"]],
      "abc a.c",
      "abc [REDACTED:s1]",
    ],
    [
      "adjacent values stay separate",
      [
        ["ab", "s1"],
        ["cd", "s2"],
      ],
      "abcd",
      "[REDACTED:s1][REDACTED:s2]",
    ],
    [
      "value inside a later match start",
      [
        ["xyz1", "s1"],
        ["z1234", "s2"],
      ],
      "_xyz1234_",
      "_[REDACTED]_",
    ],
  ])("%s", (_, entries, input, expected) => {
    const list = (entries as string[][]).map(([value, secretId]) => ({
      value: value!,
      secretId: secretId!,
    }));
    for (const registry of withDecoys(list)) {
      expect(registry.scrubText(input as string)).toBe(expected);
    }
  });
});
