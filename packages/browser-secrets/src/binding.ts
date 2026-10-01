/**
 * Strict destination-binding parsing (EMG-123, plus `sbm:frame-origin` from
 * EMG-66). A malformed part never falls back to a looser binding: a bad
 * `sbm:fields` must not turn a card secret into an origin-only one.
 */
import { compileUrlPattern, isExactHttpOrigin } from "./matcher";
import {
  BINDING_KEY_PREFIX,
  BINDING_KEYS,
  type BindingErrorCode,
  type ParsedBinding,
  type SecretBinding,
  type SecretRef,
  type StaticProperties,
} from "./types";

const KNOWN_BINDING_KEYS: ReadonlySet<string> = new Set(
  Object.values(BINDING_KEYS),
);

const hasOwn = (object: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(object, key);

const invalid = (error: BindingErrorCode): ParsedBinding =>
  Object.freeze({ status: "invalid", error });

/**
 * Parses the destination binding from a secret's static properties.
 *
 * - No `sbm:` keys: `unbound`. Unbound secrets are never fillable.
 * - Any `sbm:` key that this package does not know, a non-string value for
 *   an `sbm:` key, or an `sbm:` key without `sbm:origin`: `invalid`.
 * - Otherwise each declared part must be well formed, or the result is
 *   `invalid`.
 *
 * Keys outside the `sbm:` namespace, such as relay `demo:*` keys, are
 * ignored here and kept on the `SecretRef`.
 */
export function parseBinding(staticProperties: unknown): ParsedBinding {
  if (
    staticProperties === null ||
    typeof staticProperties !== "object" ||
    Array.isArray(staticProperties)
  ) {
    return invalid("invalid_property_value");
  }
  const props = staticProperties as Record<string, unknown>;
  const bindingKeys = Object.keys(props).filter((key) =>
    key.startsWith(BINDING_KEY_PREFIX),
  );
  if (bindingKeys.length === 0) return Object.freeze({ status: "unbound" });
  if (bindingKeys.some((key) => !KNOWN_BINDING_KEYS.has(key))) {
    return invalid("unknown_binding_key");
  }
  if (bindingKeys.some((key) => typeof props[key] !== "string")) {
    return invalid("invalid_property_value");
  }
  const read = (key: string): string | undefined =>
    hasOwn(props, key) ? (props[key] as string) : undefined;

  const origin = read(BINDING_KEYS.origin);
  if (origin === undefined) return invalid("missing_origin");
  if (!isExactHttpOrigin(origin)) return invalid("invalid_origin");
  const binding: {
    origin: string;
    frameOrigin?: string;
    urlPattern?: string;
    selector?: string;
    fields?: Readonly<Record<string, string>>;
  } = { origin };

  const frameOrigin = read(BINDING_KEYS.frameOrigin);
  if (frameOrigin !== undefined) {
    if (!isExactHttpOrigin(frameOrigin)) return invalid("invalid_frame_origin");
    binding.frameOrigin = frameOrigin;
  }

  const urlPattern = read(BINDING_KEYS.urlPattern);
  if (urlPattern !== undefined) {
    if (!urlPattern.trim()) return invalid("invalid_url_pattern");
    try {
      compileUrlPattern(origin, urlPattern);
    } catch {
      return invalid("invalid_url_pattern");
    }
    binding.urlPattern = urlPattern;
  }

  const selector = read(BINDING_KEYS.selector);
  if (selector !== undefined) {
    if (!selector.trim()) return invalid("invalid_selector");
    binding.selector = selector;
  }

  const fields = read(BINDING_KEYS.fields);
  if (fields !== undefined) {
    const parsed = parseFields(fields);
    if (!parsed) return invalid("invalid_fields");
    binding.fields = parsed;
  }

  return Object.freeze({
    status: "bound",
    binding: Object.freeze(binding) as SecretBinding,
  });
}

/** Parses `sbm:fields` into a frozen, prototype-free map, or returns undefined. */
function parseFields(
  raw: string,
): Readonly<Record<string, string>> | undefined {
  let map: unknown;
  try {
    map = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (map === null || typeof map !== "object" || Array.isArray(map)) {
    return undefined;
  }
  const entries = Object.entries(map);
  if (
    entries.length === 0 ||
    entries.some(
      ([key, value]) => !key || typeof value !== "string" || !value.trim(),
    )
  ) {
    return undefined;
  }
  const out = Object.create(null) as Record<string, string>;
  for (const [key, value] of entries) out[key] = value as string;
  return Object.freeze(out);
}

/** Input for `createSecretRef`, shaped like a Turnkey secret's metadata. */
export type SecretMetadata = {
  secretId: string;
  name?: string | undefined;
  staticProperties?: Record<string, string> | undefined;
};

/**
 * Builds an agent-safe `SecretRef` from secret metadata. It copies every
 * static property (including unknown and `demo:*` keys) and attaches either
 * the parsed binding or the binding error.
 */
export function createSecretRef(metadata: SecretMetadata): SecretRef {
  const staticProperties: StaticProperties = Object.freeze({
    ...(metadata.staticProperties ?? {}),
  });
  const parsed = parseBinding(staticProperties);
  return Object.freeze({
    secretId: metadata.secretId,
    ...(metadata.name !== undefined ? { name: metadata.name } : {}),
    staticProperties,
    ...(parsed.status === "bound" ? { binding: parsed.binding } : {}),
    ...(parsed.status === "invalid" ? { bindingError: parsed.error } : {}),
  });
}
