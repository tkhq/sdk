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

/**
 * Returns true when `value` is an exact, serialized, non-opaque origin of any
 * scheme: `new URL(value).origin === value` and the origin is not `"null"`.
 * This is the `sbm:origin` rule in secure-browser-mcp's `parseBinding`
 * (`src/broker/mock-secrets.ts`). A non-HTTP(S) origin parses but never
 * matches a page, because `matchesOrigin` accepts HTTP(S) URLs only.
 */
export function isExactOrigin(value: string): boolean {
  const url = parseUrl(value);
  return url !== undefined && url.origin !== "null" && url.origin === value;
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

/** Compiled patterns, per implementation, keyed by origin and pattern. */
const patternCache = new WeakMap<
  URLPatternConstructor,
  Map<string, URLPatternLike | null>
>();
/** Bounds the cache; it is dropped and rebuilt when full. */
const PATTERN_CACHE_LIMIT = 256;

/** `compileUrlPattern`, cached. Returns null when the pattern does not compile. */
function cachedUrlPattern(
  origin: string,
  urlPattern: string,
  URLPatternImpl: URLPatternConstructor,
): URLPatternLike | null {
  let cache = patternCache.get(URLPatternImpl);
  if (!cache) patternCache.set(URLPatternImpl, (cache = new Map()));
  const key = `${origin}\u0000${urlPattern}`;
  let pattern = cache.get(key);
  if (pattern === undefined) {
    try {
      pattern = compileUrlPattern(origin, urlPattern, URLPatternImpl);
    } catch {
      pattern = null;
    }
    if (cache.size >= PATTERN_CACHE_LIMIT) cache.clear();
    cache.set(key, pattern);
  }
  return pattern;
}

/** A top-level destination rule: an exact origin and an optional pathname pattern. */
export type UrlRule = {
  readonly origin: string;
  readonly urlPattern?: string;
};

/**
 * Returns true when `url` matches the rule's origin exactly and, if the rule
 * has one, its pathname pattern. An empty pattern counts as no pattern, as
 * in secure-browser-mcp's `BindingPolicy` (`if (binding.urlPattern)`). An
 * invalid pattern never matches.
 */
export function matchesUrl(
  url: string,
  rule: UrlRule,
  URLPatternImpl: URLPatternConstructor = getURLPattern(),
): boolean {
  if (!matchesOrigin(url, rule.origin)) return false;
  if (!rule.urlPattern) return true;
  const pattern = cachedUrlPattern(
    rule.origin,
    rule.urlPattern,
    URLPatternImpl,
  );
  if (!pattern) return false;
  try {
    return pattern.test(url);
  } catch {
    return false;
  }
}
