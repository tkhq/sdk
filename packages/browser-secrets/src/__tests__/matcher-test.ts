import { describe, expect, test } from "@jest/globals";

import {
  compileUrlPattern,
  getURLPattern,
  getURLPatternSource,
  isExactHttpOrigin,
  isExactOrigin,
  matchesOrigin,
  matchesUrl,
} from "../index";
import { polyfillURLPattern } from "../urlpattern";

describe("URLPattern loader", () => {
  test("uses the native class when the runtime has one, else the polyfill", () => {
    const native = (globalThis as { URLPattern?: unknown }).URLPattern;
    const major = Number(process.versions.node.split(".")[0]);
    if (typeof native === "function") {
      expect(major).toBeGreaterThanOrEqual(24);
      expect(getURLPatternSource()).toBe("native");
      expect(getURLPattern()).toBe(native);
    } else {
      expect(major).toBeLessThan(24);
      expect(getURLPatternSource()).toBe("polyfill");
      expect(getURLPattern()).toBe(polyfillURLPattern);
      // Loading the package does not install a global.
      expect(native).toBeUndefined();
    }
  });
});

describe("matcher", () => {
  test("exact origins", () => {
    expect(isExactHttpOrigin("https://shop.example")).toBe(true);
    expect(isExactHttpOrigin("http://localhost:4173")).toBe(true);
    // sbm:origin accepts any serialized, non-opaque origin.
    expect(isExactOrigin("ftp://shop.example")).toBe(true);
    expect(isExactHttpOrigin("ftp://shop.example")).toBe(false);
    for (const value of [
      "https://shop.example/",
      "https://Shop.example",
      "https://shop.example:443",
      "https://u:p@shop.example",
      "file:///tmp/x",
      "blob:https://shop.example/x",
      "null",
      "",
    ]) {
      expect(isExactOrigin(value)).toBe(false);
      expect(isExactHttpOrigin(value)).toBe(false);
    }
  });

  test("matchesOrigin compares the parsed origin exactly", () => {
    const origin = "https://shop.example";
    expect(matchesOrigin("https://shop.example/a?b#c", origin)).toBe(true);
    expect(matchesOrigin("https://shop.example.evil/", origin)).toBe(false);
    expect(matchesOrigin("http://shop.example/", origin)).toBe(false);
    expect(matchesOrigin("not a url", origin)).toBe(false);
    expect(matchesOrigin("about:blank", "null")).toBe(false);
  });

  test("an invalid pattern throws on compile and never matches", () => {
    expect(() =>
      compileUrlPattern("https://shop.example", "/login("),
    ).toThrow();
    expect(
      matchesUrl("https://shop.example/login(", {
        origin: "https://shop.example",
        urlPattern: "/login(",
      }),
    ).toBe(false);
  });

  test.each<[string, string, boolean]>([
    ["/login*", "https://shop.example/login", true],
    ["/login*", "https://shop.example/login/2fa?x=1#y", true],
    ["/login*", "https://shop.example/signup", false],
    ["/login", "https://shop.example/login/", false],
    ["/checkout/:step", "https://shop.example/checkout/pay", true],
    ["/checkout/:step", "https://shop.example/checkout/pay/more", false],
    ["/a/(b|c)", "https://shop.example/a/c", true],
    ["/a/(b|c)", "https://shop.example/a/d", false],
    ["/login*", "https://shop.example:8443/login", false],
    ["/login*", "https://evil.example/login", false],
    // Credentials do not change the origin; both implementations ignore them.
    ["/login*", "https://u:p@shop.example/login", true],
    ["/caf%C3%A9*", "https://shop.example/café", true],
    // An empty pattern is no pattern, as in secure-browser-mcp.
    ["", "https://shop.example/any/path", true],
    ["", "https://evil.example/", false],
    // A blank pattern is a real pattern, not "no pattern".
    [" ", "https://shop.example/login", false],
  ])(
    "pattern %s against %s is %s (both implementations)",
    (urlPattern, url, expected) => {
      const rule = { origin: "https://shop.example", urlPattern };
      expect(matchesUrl(url, rule, polyfillURLPattern)).toBe(expected);
      expect(matchesUrl(url, rule)).toBe(expected);
    },
  );
});
