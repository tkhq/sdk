/**
 * Destination-binding parsing (EMG-123, plus `sbm:frame-origin` from EMG-66).
 * It accepts the same secrets as secure-browser-mcp's `parseBinding`
 * (`src/broker/mock-secrets.ts`), so existing secrets keep working. A
 * malformed part never falls back to a looser binding: a bad `sbm:fields`
 * must not turn a card secret into an origin-only one.
 */
import { compileUrlPattern, isExactHttpOrigin, isExactOrigin } from "./matcher";
import {
  BINDING_KEY_PREFIX,
  BINDING_KEYS,
  type BindingErrorCode,
  type ParsedBinding,
  type SecretBinding,
  type SecretRef,
  type StaticProperties,
} from "./types";

const hasOwn = (object: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(object, key);

const invalid = (error: BindingErrorCode): ParsedBinding =>
  Object.freeze({ status: "invalid", error });

/**
 * Parses the destination binding from a secret's static properties.
 *
 * - A non-string value for any `sbm:` key: `invalid`.
 * - No `sbm:origin`: `unbound`, even when other `sbm:` keys are present.
 *   Unbound secrets are never fillable. This matches secure-browser-mcp.
 * - Otherwise each declared part must be well formed, or the result is
 *   `invalid`.
 *
 * Unknown `sbm:` keys and keys outside the `sbm:` namespace, such as relay
 * `demo:*` keys, are ignored here and kept on the `SecretRef`, as in
 * secure-browser-mcp.
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
  // Turnkey static properties are always strings, so this check does not
  // change which existing secrets parse.
  if (bindingKeys.some((key) => typeof props[key] !== "string")) {
    return invalid("invalid_property_value");
  }
  const read = (key: string): string | undefined =>
    hasOwn(props, key) ? (props[key] as string) : undefined;

  const origin = read(BINDING_KEYS.origin);
  if (origin === undefined) return Object.freeze({ status: "unbound" });
  if (!isExactOrigin(origin)) return invalid("invalid_origin");
  const binding: {
    origin: string;
    frameOrigin?: string;
    urlPattern?: string;
    selector?: string;
    fields?: Readonly<Record<string, string>>;
  } = { origin };

  // EMG-66 requires an HTTP(S) frame origin.
  const frameOrigin = read(BINDING_KEYS.frameOrigin);
  if (frameOrigin !== undefined) {
    if (!isExactHttpOrigin(frameOrigin)) return invalid("invalid_frame_origin");
    binding.frameOrigin = frameOrigin;
  }

  const urlPattern = read(BINDING_KEYS.urlPattern);
  if (urlPattern !== undefined) {
    // Like secure-browser-mcp, any pattern that compiles is valid, including
    // a blank one. `matchesUrl` treats "" as no pattern, as SBM does.
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
