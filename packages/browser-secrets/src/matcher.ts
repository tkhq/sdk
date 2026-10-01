/**
 * The single origin and URL-pattern matcher. Every host must use these
 * functions rather than its own wildcard or prefix logic, so that binding
 * decisions are the same everywhere.
 */
import {
  getURLPattern,
  type URLPatternConstructor,
  type URLPatternLike,
} from "./urlpattern";

const HTTP_SCHEMES = new Set(["http:", "https:"]);

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

/**
 * Returns true when `value` is an exact, serialized HTTP(S) origin such as
 * `https://shop.example`. A path, trailing slash, credentials, default port,
 * or uppercase host makes it inexact.
 */
export function isExactHttpOrigin(value: string): boolean {
  const url = parseUrl(value);
  return (
    url !== undefined && HTTP_SCHEMES.has(url.protocol) && url.origin === value
  );
}

/** Returns true when `url` parses and uses `http:` or `https:`. */
export function isHttpUrl(url: string): boolean {
  const parsed = parseUrl(url);
  return parsed !== undefined && HTTP_SCHEMES.has(parsed.protocol);
}

/** Returns the origin of an HTTP(S) URL, or undefined for any other input. */
export function httpOriginOf(url: string): string | undefined {
  const parsed = parseUrl(url);
  return parsed && HTTP_SCHEMES.has(parsed.protocol)
    ? parsed.origin
    : undefined;
}

/** Returns true when `url` is an HTTP(S) URL whose origin equals `origin` exactly. */
export function matchesOrigin(url: string, origin: string): boolean {
  const actual = httpOriginOf(url);
  return actual !== undefined && actual === origin;
}

/**
 * Compiles a pathname pattern against an origin. The origin fixes protocol,
 * host, and port; the pattern constrains only the pathname, and any query
 * or fragment is allowed. Throws when the pattern is not valid `URLPattern`
 * syntax.
 */
export function compileUrlPattern(
  origin: string,
  urlPattern: string,
  URLPatternImpl: URLPatternConstructor = getURLPattern(),
): URLPatternLike {
  return new URLPatternImpl({ pathname: urlPattern, baseURL: origin });
}

/** A top-level destination rule: an exact origin and an optional pathname pattern. */
export type UrlRule = {
  readonly origin: string;
  readonly urlPattern?: string;
};

/**
 * Returns true when `url` matches the rule's origin exactly and, if the rule
 * has one, its pathname pattern. An invalid pattern never matches.
 */
export function matchesUrl(
  url: string,
  rule: UrlRule,
  URLPatternImpl: URLPatternConstructor = getURLPattern(),
): boolean {
  if (!matchesOrigin(url, rule.origin)) return false;
  if (rule.urlPattern === undefined) return true;
  let pattern: URLPatternLike;
  try {
    pattern = compileUrlPattern(rule.origin, rule.urlPattern, URLPatternImpl);
  } catch {
    return false;
  }
  try {
    return pattern.test(url);
  } catch {
    return false;
  }
}
