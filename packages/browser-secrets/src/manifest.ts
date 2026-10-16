/**
 * `manifestSource`: a source whose bindings come from operator config, not
 * from the store. The operator lists each secret it may fill with its
 * destination binding; the store (for example 1Password) only holds values.
 * Vendor code stays out of this package: the caller passes `resolve`.
 *
 * The source lists manifest entries only, never the whole store. It reads
 * each value at fill time with no cache, and runs `verify` before each read.
 * It declares `bindings: "operator-manifest"` and `approvals: false`, so the
 * strict default requirements refuse it; a host must opt out by name.
 */
import { createSecretRef } from "./binding";
import { BrowserSecretsError } from "./errors";
import {
  isNonEmptyString,
  isObject,
  isOptionalTimestamp,
  toSourceReason,
  type AuditLevel,
  type ExportOutcome,
  type ExportRequest,
  type SecretSource,
  type SourceErrorCode,
} from "./source";
import {
  BINDING_KEY_PREFIX,
  BINDING_KEYS,
  type SecretBinding,
  type SecretRef,
} from "./types";

/** One secret the operator allows the host to fill. */
export type ManifestEntry = {
  /** The ID agents use, for example `op://<vaultId>/<itemId>`. */
  readonly secretId: string;
  readonly name?: string;
  readonly binding: SecretBinding;
  /**
   * Other static properties, for example `op:ref`. Keys in the `sbm:`
   * namespace are refused: bindings come from `binding` only.
   */
  readonly properties?: Readonly<Record<string, string>>;
};

/**
 * A resolved value. For an entry with `binding.fields`, a JSON object
 * string. `expiresAt` (epoch ms) marks a short-lived value such as a
 * one-time code; `connectSource` keeps it only when the source was built
 * with `otp: true`.
 */
export type ManifestValue =
  | string
  | { readonly value: string; readonly expiresAt?: number };

export type ManifestSourceOptions = {
  /** Source ID, for example `"onepassword"`. */
  readonly id: string;
  readonly entries: readonly ManifestEntry[];
  /** Reads the value from the store. Called on every export; never cached. */
  readonly resolve: (entry: ManifestEntry) => Promise<ManifestValue>;
  /**
   * Runs before each read, for example the 1Password check that the item's
   * website matches `ref.binding.origin`. Anything but `true` denies the
   * export with `verification_failed`.
   */
  readonly verify?: (ref: SecretRef) => boolean | Promise<boolean>;
  /** Default `"none"`. Set `"provider-log"` when the store keeps an access log. */
  readonly audit?: Exclude<AuditLevel, "signed">;
  /** Default false. Required for `resolve` to return an `expiresAt`. */
  readonly otp?: boolean;
};

const invalidConfig = (sourceId: string, secretId?: string) =>
  new BrowserSecretsError("source_config_invalid", undefined, {
    secretId,
    sourceId,
  });

/**
 * Compiles a manifest entry into a ref with `sbm:*` static properties.
 * Throws `source_config_invalid` when the entry is malformed or does not
 * bind; a bad entry never becomes a looser binding.
 */
function compileEntry(rawEntry: unknown, sourceId: string): SecretRef {
  if (!isObject(rawEntry)) throw invalidConfig(sourceId);
  const {
    secretId,
    name,
    properties: rawProperties,
    binding,
  } = rawEntry as ManifestEntry;
  const properties: Record<string, unknown> = isObject(rawProperties)
    ? Object.fromEntries(Object.entries(rawProperties))
    : {};
  const reservedKey = Object.keys(properties).some((key) =>
    key.startsWith(BINDING_KEY_PREFIX),
  );
  const { origin, frameOrigin, urlPattern, selector, fields } = binding ?? {};
  const bindingProperties = {
    [BINDING_KEYS.origin]: origin,
    [BINDING_KEYS.frameOrigin]: frameOrigin,
    [BINDING_KEYS.urlPattern]: urlPattern,
    [BINDING_KEYS.selector]: selector,
    [BINDING_KEYS.fields]:
      fields !== undefined ? JSON.stringify(fields) : undefined,
  };
  for (const [key, value] of Object.entries(bindingProperties)) {
    if (value !== undefined) properties[key] = value;
  }
  if (
    reservedKey ||
    (rawProperties !== undefined && !isObject(rawProperties)) ||
    !isNonEmptyString(secretId) ||
    (name !== undefined && typeof name !== "string") ||
    Object.values(properties).some((value) => typeof value !== "string")
  ) {
    throw invalidConfig(sourceId, secretId);
  }
  const ref = createSecretRef({
    secretId,
    name,
    staticProperties: properties as Record<string, string>,
    source: sourceId,
    bindingProvenance: "operator-manifest",
  });
  if (ref.binding === undefined) throw invalidConfig(sourceId, secretId);
  return ref;
}

/**
 * Builds a `SecretSource` from an operator manifest and a `resolve` function.
 * Throws `source_config_invalid` when `audit` is not `"provider-log"` or
 * `"none"`, `otp` is not a boolean, `resolve` is not a function, or
 * `verify` is set and not a function: a manifest source cannot claim a
 * signed audit record.
 */
export function manifestSource(options: ManifestSourceOptions): SecretSource {
  const { id, resolve, verify } = options;
  // Read once and check: callers can be plain JavaScript, and a declared
  // capability the source cannot keep would pass `connectSource`.
  const rawAudit: unknown = options.audit;
  const rawOtp: unknown = options.otp;
  const rawEntries: unknown = options.entries;
  const audit = rawAudit === undefined ? "none" : rawAudit;
  const otp = rawOtp === undefined ? false : rawOtp;
  if (
    (audit !== "provider-log" && audit !== "none") ||
    typeof otp !== "boolean" ||
    !Array.isArray(rawEntries) ||
    typeof resolve !== "function" ||
    (verify !== undefined && typeof verify !== "function")
  ) {
    throw invalidConfig(id);
  }
  const entries = new Map<string, { entry: ManifestEntry; ref: SecretRef }>();
  for (const entry of rawEntries) {
    const ref = compileEntry(entry, id);
    if (entries.has(ref.secretId)) {
      throw invalidConfig(id, ref.secretId);
    }
    entries.set(ref.secretId, { entry, ref });
  }
  const refs = Object.freeze([...entries.values()].map((e) => e.ref));

  const exportValue = async (
    request: ExportRequest,
  ): Promise<ExportOutcome> => {
    const context = { secretId: request.ref.secretId, sourceId: id };
    const fail = (code: SourceErrorCode, error?: unknown): ExportOutcome => ({
      kind: "failed",
      reason: toSourceReason(error, context, code),
      // Reading has no side effect in the store, so nothing was submitted.
      submitted: "no",
    });
    const deny = (code: SourceErrorCode): ExportOutcome => ({
      kind: "denied",
      reason: toSourceReason(undefined, context, code),
    });
    const found = entries.get(context.secretId);
    if (!found) return deny("not_found");
    let resolved: ManifestValue;
    try {
      if (verify && (await verify(found.ref)) !== true) {
        return deny("verification_failed");
      }
      resolved = await resolve(found.entry);
    } catch (error) {
      return fail("source_error", error);
    }
    const { value, expiresAt }: { value?: unknown; expiresAt?: unknown } =
      typeof resolved === "string" ? { value: resolved } : (resolved ?? {});
    if (!isNonEmptyString(value) || !isOptionalTimestamp(expiresAt)) {
      return fail("invalid_response");
    }
    return {
      kind: "ready",
      delivery: { mode: "plaintext", value },
      ...(expiresAt !== undefined ? { expiresAt } : {}),
    };
  };

  return Object.freeze({
    id,
    capabilities: Object.freeze({
      bindings: "operator-manifest",
      approvals: false,
      exportPolicy: false,
      audit,
      delivery: "plaintext",
      otp,
    }),
    listRefs: async () => ({ refs }),
    export: exportValue,
  });
}
