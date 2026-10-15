import { inspect } from "node:util";
import { describe, expect, test } from "@jest/globals";

import { RedactionRegistry, type RedactionTarget } from "../index";

const canary = "canary-Secret-7f3a!";

/** A registry with a card number and a CVC, as a card fill registers them. */
function cardRegistry(): RedactionRegistry {
  const r = new RedactionRegistry({ minValueLength: 1 });
  r.registerValues([
    { value: "4242424242424242", secretId: "card" },
    { value: "123", secretId: "cvc" },
  ]);
  return r;
}

describe("RedactionRegistry.scrubText", () => {
  test("replaces every occurrence and leaves other text alone", () => {
    const r = new RedactionRegistry();
    r.registerValue(canary, "s1");
    expect(r.scrubText(`a ${canary} b ${canary}`)).toBe(
      "a [REDACTED:s1] b [REDACTED:s1]",
    );
    expect(r.scrubText("nothing here")).toBe("nothing here");
  });

  test("merges overlapping and nested matches so no fragment survives", () => {
    const r = new RedactionRegistry();
    r.registerValues([
      { value: "abcd", secretId: "s1" },
      { value: "cdef", secretId: "s2" },
    ]);
    expect(r.scrubText("xxabcdefyy")).toBe("xx[REDACTED]yy");
    expect(cardRegistry().scrubText("n=4242424242424242;c=123")).toBe(
      "n=[REDACTED:card];c=[REDACTED:cvc]",
    );
  });

  test("catches JSON-escaped, URL-encoded, and form-encoded copies", () => {
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

  test("catches HTML-escaped copies", () => {
    const r = new RedactionRegistry();
    r.registerValue(`p&ss<w>rd"it's`, "s1");
    for (const html of [
      "p&amp;ss&lt;w&gt;rd\"it's",
      "p&amp;ss&lt;w&gt;rd&quot;it's",
      "p&amp;ss&lt;w&gt;rd&quot;it&#39;s",
      "p&amp;ss&lt;w&gt;rd&quot;it&#x27;s",
    ]) {
      expect(r.scrubText(`<i>${html}</i>`)).toBe("<i>[REDACTED:s1]</i>");
    }
  });

  test("catches base64 copies of the whole value", () => {
    const r = new RedactionRegistry();
    const value = "sk_live_?>?>é";
    r.registerValue(value, "s1");
    const b64 = Buffer.from(value).toString("base64");
    expect(b64).toContain("=");
    expect(r.scrubText(`a ${b64} b`)).toBe("a [REDACTED:s1] b");
    expect(r.scrubText(b64.replace(/=+$/, ""))).toBe("[REDACTED:s1]");
    expect(r.scrubText(Buffer.from(value).toString("base64url"))).toBe(
      "[REDACTED:s1]",
    );
  });

  test("catches case and Unicode normalization variants", () => {
    const r = new RedactionRegistry();
    r.registerValue("CaféKey", "s1");
    expect(r.scrubText("CAFÉKEY cafékey CaféKey")).toBe(
      "[REDACTED:s1] [REDACTED:s1] [REDACTED:s1]",
    );
  });

  test("values below minValueLength are not scanned and are reported", () => {
    const r = new RedactionRegistry();
    expect(r.registerValue("", "empty")).toBe(true);
    expect(r.valueCount).toBe(0);
    expect(r.registerValue("a", "s1")).toBe(false);
    expect(
      r.registerValues([
        { value: "123", secretId: "cvc" },
        { value: canary, secretId: "s2" },
      ]),
    ).toEqual(["cvc"]);
    expect(r.scrubText("banana 123")).toBe("banana 123");
    expect(r.registerValue(canary, "s3")).toBe(true);
  });

  test("encodedVariants: false scans the exact value only", () => {
    const r = new RedactionRegistry({ encodedVariants: false });
    r.registerValues([
      { value: "a b c", secretId: "s1" },
      { value: "4242424242424242", secretId: "card" },
    ]);
    expect(r.valueCount).toBe(2);
    expect(r.scrubText("a%20b%20c 4242 4242 4242 4242")).toBe(
      "a%20b%20c 4242 4242 4242 4242",
    );
  });

  // Loose matching: secure-browser-mcp #31 (6aa020e) rules.
  test.each([
    "4242 4242 4242 4242",
    "4242-4242-4242-4242",
    "4242.4242.4242.4242",
    "4242 4242 4242 4242",
    "4242 4242 4242 4242",
    "4242 – 4242 – 4242 – 4242",
    "42 42 42 42 42 42 42 42",
    "4242,4242,4242,4242",
    "4242'4242'4242'4242",
    "4242·4242·4242·4242",
    "4242:4242:4242:4242",
    "4242x4242x4242x4242",
    "4242​4242​4242​4242",
    "4242 , 4242 , 4242 , 4242",
    "４２４２４２４２４２４２４２４２",
    "4242%204242%204242%204242",
    "4242%2C%204242%2C%204242%2C%204242",
    "%34%32%34%32%34%32%34%32%34%32%34%32%34%32%34%32",
    "٤٢٤٢ ٤٢٤٢ ٤٢٤٢ ٤٢٤٢",
    "४२४२-४२४२-४२४२-४२४२",
  ])("catches a reformatted copy: %s", (shown) => {
    // The match ends at the value's last character, not at a separator.
    expect(cardRegistry().scrubText(`card ${shown}. exp`)).toBe(
      "card [REDACTED:card]. exp",
    );
  });

  test("does not stitch digits across wide gaps or partial copies", () => {
    const r = cardRegistry();
    for (const text of [
      "4242 then later 4242 and 4242 and finally 4242",
      "4242 -- , 4242 4242 4242",
      "card ending 4242",
    ]) {
      expect(r.scrubText(text)).toBe(text);
    }
  });

  test("reads HTML character references as the character they stand for", () => {
    const r = cardRegistry();
    expect(
      r.scrubText('<input value="4242&nbsp;4242&#160;4242&#xA0;4242">'),
    ).toBe('<input value="[REDACTED:card]">');
    const key = new RedactionRegistry();
    key.registerValue("sk_live_abc123def456", "key");
    expect(key.scrubText("sk_live_abc&#49;23&nbsp;def456")).toBe(
      "[REDACTED:key]",
    );
    expect(key.scrubText("sk_live_abc123&def456;")).toBe("[REDACTED:key];");
  });

  test("strips punctuation and folds case for long non-digit values", () => {
    const r = new RedactionRegistry();
    r.registerValues([
      { value: "sk_live_abc123def456", secretId: "key" },
      { value: "gb82west12345698765432", secretId: "iban" },
      { value: "3782 822463 10005", secretId: "amex" },
    ]);
    expect(r.scrubText("key: SK-LIVE:ABC123,DEF456 ok")).toBe(
      "key: [REDACTED:key] ok",
    );
    expect(r.scrubText("IBAN GB82 WEST 1234 5698 7654 32 ok")).toBe(
      "IBAN [REDACTED:iban] ok",
    );
    // Separators in the registered value are optional in the text.
    expect(r.scrubText("378282246310005")).toBe("[REDACTED:amex]");
  });

  test("does not match short values loosely", () => {
    const r = new RedactionRegistry();
    r.registerValues([
      { value: "1234567", secretId: "short" },
      { value: "12345678", secretId: "long" },
    ]);
    expect(r.scrubText("1234 567 and 1234567")).toBe(
      "1234 567 and [REDACTED:short]",
    );
    expect(r.scrubText("1234 5678")).toBe("[REDACTED:long]");
    expect(cardRegistry().scrubText("1 2 3 and 1-2-3")).toBe("1 2 3 and 1-2-3");
  });

  test("loose matching stays linear on separator runs", () => {
    const r = cardRegistry();
    const text = "4".repeat(1000) + " ".repeat(100_000) + "2";
    const start = Date.now();
    expect(r.scrubText(text)).toBe(text);
    expect(Date.now() - start).toBeLessThan(1000);
  });
});

describe("findMatches and findSecretIds", () => {
  test("report every secret copied into the text", () => {
    const r = cardRegistry();
    r.registerValue("hunter2-password", "pw");
    expect(r.findSecretIds("Pay with 4242 4242 4242 4242")).toEqual(["card"]);
    expect(
      r.findSecretIds('{"a":"HUNTER2 PASSWORD","b":"4242-4242-4242-4242"}'),
    ).toEqual(["card", "pw"]);
    expect(r.findSecretIds("nothing here")).toEqual([]);
    expect(r.findSecretIds("")).toEqual([]);
  });

  test("return spans that map a split copy back to its parts", () => {
    // Field values joined in document order, as a snapshot serializer does.
    const text = "4242 4242 | 4242 4242";
    expect(cardRegistry().findMatches(text)).toEqual([
      { start: 0, end: text.length, secretIds: ["card"] },
    ]);
    const r = new RedactionRegistry();
    r.registerValues([
      { value: "abcdefgh", secretId: "s1" },
      { value: "efghijkl", secretId: "s2" },
    ]);
    expect(r.findMatches("x abcd-efgh-ijkl y")).toEqual([
      { start: 2, end: 16, secretIds: ["s1", "s2"] },
    ]);
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

  test("scrubs byte buffers, Maps, and Sets", () => {
    const r = new RedactionRegistry();
    r.registerValue(canary, "s1");
    const bytes = new TextEncoder().encode(`x ${canary}`);
    const out = r.scrub({
      bytes,
      buffer: Buffer.from(canary),
      raw: bytes.buffer,
      clean: Buffer.from("fine"),
      map: new Map([[canary, { v: canary }]]),
      set: new Set([canary, 1]),
      when: new Date(0),
    });
    expect(out.bytes).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(out.bytes)).toBe("x [REDACTED:s1]");
    expect(Buffer.isBuffer(out.buffer)).toBe(true);
    expect(out.buffer.toString()).toBe("[REDACTED:s1]");
    expect(new TextDecoder().decode(out.raw)).toBe("x [REDACTED:s1]");
    expect(out.clean.toString()).toBe("fine");
    expect([...out.map]).toEqual([["[REDACTED:s1]", { v: "[REDACTED:s1]" }]]);
    expect([...out.set]).toEqual(["[REDACTED:s1]", 1]);
    expect(out.when).toEqual(new Date(0));
    expect(new TextDecoder().decode(bytes)).toBe(`x ${canary}`);
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

  test("target tags are document-scoped and can hold several secrets", () => {
    const r = new RedactionRegistry();
    r.registerTarget(target, "a");
    r.registerTarget(target, "b");
    expect(r.isRegisteredTarget(target)).toBe(true);
    expect(r.secretIdsForTarget(target)).toEqual(["a", "b"]);
    expect(r.isRegisteredTarget({ ...target, documentId: "d2" })).toBe(false);
    expect(r.isRegisteredTarget({ ...target, browserSessionId: "b2" })).toBe(
      false,
    );
    r.releaseSecret("b");
    expect(r.secretIdsForTarget(target)).toEqual(["a"]);
    r.releaseDocument(target);
    expect(r.isRegisteredTarget(target)).toBe(false);
  });

  test("releaseSecret drops that secret's values, loose forms, and targets only", () => {
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
    expect(r.scrubText("one-value ONE VALUE two-value shared")).toBe(
      "one-value ONE VALUE [REDACTED:s2] [REDACTED:s2]",
    );
    expect(r.isRegisteredTarget(target)).toBe(false);
    expect(r.isRegisteredTarget({ ...target, elementId: "e2" })).toBe(true);
    r.clear();
    expect(r.valueCount).toBe(0);
    expect(r.targetCount).toBe(0);
    expect(r.findSecretIds("two value")).toEqual([]);
  });

  test("the registry does not print its values", () => {
    const r = new RedactionRegistry({ encodedVariants: false });
    r.registerValue(canary, "s1");
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
      const registry = new RedactionRegistry({
        encodedVariants: false,
        minValueLength: 1,
      });
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

describe("value expiry", () => {
  const clock = () => {
    let now = 1_000;
    return { now: () => now, advance: (ms: number) => void (now += ms) };
  };

  test("a short-lived value stops matching in every form after its expiry", () => {
    const c = clock();
    const registry = new RedactionRegistry({ now: c.now });
    registry.registerValues([
      { value: "4111 1111 1111 1111", secretId: "card", expiresAt: 2_000 },
      { value: "hunter2-password", secretId: "pw" },
    ]);
    const text =
      "4111-1111-1111-1111 4111%201111%201111%201111 hunter2-password";
    expect(registry.scrubText(text)).toBe(
      "[REDACTED:card] [REDACTED:card] [REDACTED:pw]",
    );
    c.advance(999);
    expect(registry.findSecretIds(text)).toEqual(["card", "pw"]);
    c.advance(1);
    expect(registry.scrubText(text)).toBe(
      "4111-1111-1111-1111 4111%201111%201111%201111 [REDACTED:pw]",
    );
  });

  test("a permanent registration wins, and a later expiry extends an earlier one", () => {
    const c = clock();
    const registry = new RedactionRegistry({ now: c.now });
    registry.registerValue("482913", "a", { expiresAt: 2_000 });
    registry.registerValue("482913", "a");
    registry.registerValue("555666", "b", { expiresAt: 2_000 });
    registry.registerValue("555666", "b", { expiresAt: 4_000 });
    registry.registerValue("555666", "c", { expiresAt: 3_000 });
    c.advance(1_500);
    expect(registry.findSecretIds("482913 555666")).toEqual(["a", "b", "c"]);
    c.advance(1_000);
    expect(registry.findSecretIds("482913 555666")).toEqual(["a", "b"]);
    c.advance(1_000);
    expect(registry.findSecretIds("482913 555666")).toEqual(["a"]);
  });

  test("past or invalid expiries are not registered; target tags do not expire", () => {
    const c = clock();
    const registry = new RedactionRegistry({ now: c.now });
    registry.registerValues([
      { value: "past-value", secretId: "a", expiresAt: 1_000 },
      { value: "nan-value", secretId: "b", expiresAt: Number.NaN },
    ]);
    expect(registry.valueCount).toBe(0);
    const tag: RedactionTarget = {
      browserSessionId: "b",
      tabId: "t",
      frameId: "f",
      documentId: "d",
      elementId: "otp-input",
    };
    registry.registerValue("482913", "otp", { expiresAt: 2_000 });
    registry.registerTarget(tag, "otp");
    c.advance(5_000);
    expect(registry.valueCount).toBe(0);
    expect(registry.isRegisteredTarget(tag)).toBe(true);
  });

  test("releaseSecret and clear drop pending expiries", () => {
    const c = clock();
    const registry = new RedactionRegistry({ now: c.now });
    registry.registerValue("482913", "otp", { expiresAt: 2_000 });
    registry.releaseSecret("otp");
    registry.registerValue("482913", "otp");
    registry.registerValue("555666", "x", { expiresAt: 2_000 });
    registry.clear();
    registry.registerValue("555666", "x");
    c.advance(5_000);
    expect(registry.findSecretIds("482913 555666")).toEqual(["x"]);
  });
});
