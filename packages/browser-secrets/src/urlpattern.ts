/**
 * `URLPattern` loader. Node 24, workerd, and current browsers ship a native
 * `URLPattern`; Node 20 and 22 do not. The polyfill is imported from its
 * side-effect-free entry point, so loading this package never patches
 * `globalThis`. There is no weaker fallback: if neither is available, pattern
 * bindings fail closed.
 */
import { URLPattern as URLPatternPolyfill } from "urlpattern-polyfill/urlpattern";

/** The subset of the `URLPattern` API this package uses. */
export interface URLPatternLike {
  test(input: string): boolean;
}

/** Dictionary input for the `URLPattern` constructor. */
export type URLPatternInitLike = {
  pathname?: string;
  baseURL?: string;
};

/** A `URLPattern` constructor, native or polyfilled. */
export type URLPatternConstructor = new (
  init: URLPatternInitLike,
) => URLPatternLike;

/** Which implementation `getURLPattern` returns. */
export type URLPatternSource = "native" | "polyfill";

function nativeURLPattern(): URLPatternConstructor | undefined {
  const candidate = (globalThis as { URLPattern?: unknown }).URLPattern;
  return typeof candidate === "function"
    ? (candidate as URLPatternConstructor)
    : undefined;
}

/** Returns the global `URLPattern` when it exists, otherwise the polyfill. */
export function getURLPattern(): URLPatternConstructor {
  return (
    nativeURLPattern() ??
    (URLPatternPolyfill as unknown as URLPatternConstructor)
  );
}

/** Reports whether `getURLPattern` returns the native class or the polyfill. */
export function getURLPatternSource(): URLPatternSource {
  return nativeURLPattern() ? "native" : "polyfill";
}

/** @internal The polyfill class, for tests that compare both implementations. */
export const polyfillURLPattern =
  URLPatternPolyfill as unknown as URLPatternConstructor;
