import { describe, expect, test } from "@jest/globals";

import { createSecretRef, parseBinding, type BindingErrorCode } from "../index";

const origin = { "sbm:origin": "https://shop.example" };

describe("createSecretRef", () => {
  test("keeps every static property and attaches the parsed binding", () => {
    const staticProperties = {
      ...origin,
      "sbm:selecter": "input", // unknown sbm: key, kept and ignored
      "demo:label": "Checkout card",
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
    // A later change to the input does not reach the ref.
    staticProperties["sbm:origin"] = "https://evil.example";
    expect(ref.staticProperties["sbm:origin"]).toBe("https://shop.example");
  });

  test("reports a malformed binding as a code", () => {
    const ref = createSecretRef({
      secretId: "s1",
      staticProperties: { ...origin, "sbm:fields": "{" },
    });
    expect(ref.binding).toBeUndefined();
    expect(ref.bindingError).toBe("invalid_fields");
  });

  test("a secret with no metadata is unbound", () => {
    expect(createSecretRef({ secretId: "s1" })).toEqual({
      secretId: "s1",
      staticProperties: {},
    });
  });
});

describe("parseBinding", () => {
  test.each<[string, unknown, BindingErrorCode]>([
    [
      "a non-object",
      "sbm:origin=https://shop.example",
      "invalid_property_value",
    ],
    [
      "a non-string sbm: value",
      { ...origin, "sbm:selector": 1 },
      "invalid_property_value",
    ],
    [
      "an origin with a trailing slash",
      { "sbm:origin": "https://shop.example/" },
      "invalid_origin",
    ],
    ["an opaque origin", { "sbm:origin": "null" }, "invalid_origin"],
    [
      "a non-HTTP(S) frame origin",
      { ...origin, "sbm:frame-origin": "ftp://pay.example" },
      "invalid_frame_origin",
    ],
    [
      "an invalid URL pattern",
      { ...origin, "sbm:url-pattern": "/login(" },
      "invalid_url_pattern",
    ],
    [
      "a blank selector",
      { ...origin, "sbm:selector": " " },
      "invalid_selector",
    ],
    [
      "an empty fields map",
      { ...origin, "sbm:fields": "{}" },
      "invalid_fields",
    ],
    [
      "a blank field selector",
      { ...origin, "sbm:fields": '{"number":" "}' },
      "invalid_fields",
    ],
  ])("%s is invalid", (_, input, error) => {
    expect(parseBinding(input)).toEqual({ status: "invalid", error });
  });

  test("field maps have no prototype and are frozen", () => {
    const parsed = parseBinding({
      ...origin,
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
});
