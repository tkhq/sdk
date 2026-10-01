import { describe, expect, test } from "@jest/globals";

import { createSecretRef, parseBinding } from "../index";

describe("createSecretRef", () => {
  test("keeps every static property, including relay demo:* keys", () => {
    const staticProperties = {
      "sbm:origin": "https://shop.example",
      "demo:label": "Checkout card",
      "demo:kind": "card",
      consensus: "unilateral",
    };
    const ref = createSecretRef({
      secretId: "s1",
      name: "card",
      staticProperties,
    });
    expect(ref.staticProperties).toEqual(staticProperties);
    expect(ref.binding).toEqual({ origin: "https://shop.example" });
    expect(ref.bindingError).toBeUndefined();
    expect(Object.isFrozen(ref)).toBe(true);
    expect(Object.isFrozen(ref.staticProperties)).toBe(true);
    // A later change to the input does not reach the ref.
    staticProperties["sbm:origin"] = "https://evil.example";
    expect(ref.staticProperties["sbm:origin"]).toBe("https://shop.example");
  });

  test("reports a malformed binding as a code, not a message", () => {
    const ref = createSecretRef({
      secretId: "s1",
      staticProperties: {
        "sbm:origin": "https://shop.example",
        "sbm:fields": "{",
      },
    });
    expect(ref.binding).toBeUndefined();
    expect(ref.bindingError).toBe("invalid_fields");
  });

  test("a secret with no metadata is unbound", () => {
    const ref = createSecretRef({ secretId: "s1" });
    expect(ref).toEqual({ secretId: "s1", staticProperties: {} });
  });
});

describe("parseBinding", () => {
  test("field maps have no prototype and are frozen", () => {
    const parsed = parseBinding({
      "sbm:origin": "https://shop.example",
      "sbm:fields": '{"number":"input[name=n]","__proto__":"input[name=p]"}',
    });
    expect(parsed.status).toBe("bound");
    if (parsed.status !== "bound") return;
    const fields = parsed.binding.fields!;
    expect(Object.getPrototypeOf(fields)).toBeNull();
    expect(Object.isFrozen(fields)).toBe(true);
    expect(fields["constructor"]).toBeUndefined();
    expect(fields["__proto__"]).toBe("input[name=p]");
  });

  test("rejects non-object input", () => {
    for (const input of [null, undefined, "x", 1, []]) {
      expect(parseBinding(input)).toEqual({
        status: "invalid",
        error: "invalid_property_value",
      });
    }
  });
});
