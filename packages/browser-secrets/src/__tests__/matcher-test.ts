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

const nativeURLPattern = (globalThis as { URLPattern?: unknown }).URLPattern;
const major = Number(process.versions.node.split(".")[0]);

describe("URLPattern loader", () => {
  test("uses the native class when the runtime has one", () => {
    expect(getURLPatternSource()).toBe(
      typeof nativeURLPattern === "function" ? "native" : "polyfill",
    );
    if (typeof nativeURLPattern === "function") {
      expect(getURLPattern()).toBe(nativeURLPattern);
    } else {
      expect(getURLPattern()).toBe(polyfillURLPattern);
    }
  });

  test("Node 20 and 22 get the polyfill; Node 24+ is native", () => {
    expect(getURLPatternSource()).toBe(major >= 24 ? "native" : "polyfill");
  });

  test("loading the package does not install a global", () => {
    if (major < 24) {
      expect(
        (globalThis as { URLPattern?: unknown }).URLPattern,
      ).toBeUndefined();
    }
  });
});

describe("matcher", () => {
  test("exact origins", () => {
    expect(isExactHttpOrigin("https://shop.example")).toBe(true);
    expect(isExactHttpOrigin("http://localhost:4173")).toBe(true);
    for (const value of [
      "https://shop.example/",
      "https://Shop.example",
      "https://shop.example:443",
      "https://u:p@shop.example",
      "ftp://shop.example",
      "null",
      "",
    ]) {
      expect(isExactHttpOrigin(value)).toBe(false);
    }
  });

  test("exact origins of any scheme, as secure-browser-mcp parses sbm:origin", () => {
    for (const value of [
      "https://shop.example",
      "http://localhost:4173",
      "ftp://shop.example",
      "wss://shop.example:8443",
    ]) {
      expect(isExactOrigin(value)).toBe(true);
    }
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
    }
  });

  test("matchesOrigin compares the parsed origin exactly", () => {
    expect(
      matchesOrigin("https://shop.example/a?b#c", "https://shop.example"),
    ).toBe(true);
    expect(
      matchesOrigin("https://shop.example.evil/", "https://shop.example"),
    ).toBe(false);
    expect(matchesOrigin("http://shop.example/", "https://shop.example")).toBe(
      false,
    );
    expect(matchesOrigin("not a url", "https://shop.example")).toBe(false);
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

  const cases: [string, string, boolean][] = [
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
    // A blank pattern is a real pattern, not "no pattern". What " " matches
    // differs between URLPattern implementations (Node 24 and 26 disagree on
    // "/%20"), so only a plain path is checked here.
    [" ", "https://shop.example/login", false],
  ];

  test.each(cases)(
    "pattern %s against %s is %s (both implementations)",
    (urlPattern, url, expected) => {
      const rule = { origin: "https://shop.example", urlPattern };
      expect(matchesUrl(url, rule, polyfillURLPattern)).toBe(expected);
      expect(matchesUrl(url, rule)).toBe(expected);
    },
  );
});
