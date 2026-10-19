/**
 * Typed safe errors. Every message is a fixed string chosen by code. An
 * error never carries a raw Turnkey response body, a caught error, a URL, a
 * selector, or secret material, so it is safe to return to an agent and to
 * write to logs.
 */
import type { AuthorizationDenied, DenyReason } from "./authorize";
import type { SourceErrorCode, SourceRequirementReason } from "./source";

export type BrowserSecretsErrorCode =
  | "destination_denied"
  | "invalid_request"
  | "backend_error"
  | "source_refused"
  | "source_error"
  | "source_config_invalid"
  | "internal_error";

/** Every reason an error can carry. The three sets share no names. */
export type BrowserSecretsReason =
  | DenyReason
  | SourceRequirementReason
  | SourceErrorCode;

const ERROR_MESSAGES: Readonly<Record<BrowserSecretsErrorCode, string>> = {
  destination_denied:
    "The fill target is outside the secret's destination binding.",
  invalid_request: "The request is not valid.",
  backend_error: "The secrets backend could not complete the request.",
  source_refused: "The host's source requirements refuse this secret source.",
  source_error: "The secret source could not complete the request.",
  source_config_invalid: "The secret source configuration is not valid.",
  internal_error: "An internal error occurred.",
};

/** Fixed, agent-safe explanation for each deny reason. */
export const DENY_REASON_MESSAGES: Readonly<Record<DenyReason, string>> = {
  request_invalid: "The fill request is malformed.",
  no_targets: "The fill request has no targets.",
  mixed_keyed_targets: "The fill request mixes keyed and unkeyed targets.",
  duplicate_target:
    "The fill request names the same element more than once for one key.",
  binding_invalid:
    "The secret's destination binding is invalid, so it cannot be filled.",
  unbound_secret:
    "The secret has no destination binding, so it cannot be filled.",
  unkeyed_target_for_field_binding:
    "The binding declares sbm:fields. Fill each part by key.",
  unknown_field_key: "The binding declares no field with that key.",
  observation_invalid: "The host's target observation is malformed.",
  top_level_origin_mismatch: "The page origin does not match the bound origin.",
  target_not_observed:
    "The target element is no longer available. Take a new snapshot.",
  observation_inconsistent:
    "The target's frame ancestry does not start at the top-level page.",
  unsupported_document_scheme:
    "Documents that are not HTTP(S) are not fillable.",
  opaque_origin: "Documents with an opaque origin are not fillable.",
  frame_binding_required:
    "Iframe fills require an explicit sbm:frame-origin binding.",
  frame_origin_mismatch:
    "The frame origin does not match the bound frame origin.",
  unbound_intermediate_frame: "The iframe ancestry contains an unbound origin.",
  frame_bound_top_level_target:
    "A secret bound with sbm:frame-origin fills only into an iframe.",
  url_pattern_mismatch: "The page path does not match the bound URL pattern.",
  unsupported_shadow_root: "Elements in closed shadow roots are not fillable.",
  selector_evidence_missing:
    "The host did not report whether the element matches the bound selector.",
  selector_mismatch: "The target element does not match the bound selector.",
};

/** Fixed, agent-safe explanation for each host requirement a source fails. */
export const SOURCE_REQUIREMENT_MESSAGES: Readonly<
  Record<SourceRequirementReason, string>
> = {
  capabilities_invalid: "The source's declared capabilities are not valid.",
  approvals_required:
    "The host requires a source that can hold a fill for approval.",
  fixed_bindings_required:
    "The host requires destination bindings fixed at the source.",
  export_policy_required:
    "The host requires a source that evaluates policy on each export.",
  audit_required:
    "The host requires a stronger audit record than this source keeps.",
  ciphertext_delivery_required:
    "The host requires a source that delivers values encrypted to the core.",
};

/** Fixed, agent-safe explanation for each source error code. */
export const SOURCE_ERROR_MESSAGES: Readonly<Record<SourceErrorCode, string>> =
  {
    not_found: "The source has no secret with this ID.",
    policy_denied: "The source's policy does not allow this export.",
    rejected: "The approval request was rejected.",
    expired: "The approval request expired.",
    verification_failed: "The source's check for this secret failed.",
    unavailable: "The source is unavailable.",
    invalid_response:
      "The source returned a response that does not follow the source contract.",
    source_error: "The source could not complete the request.",
  };

const REASON_MESSAGES: Readonly<Record<BrowserSecretsReason, string>> = {
  ...DENY_REASON_MESSAGES,
  ...SOURCE_REQUIREMENT_MESSAGES,
  ...SOURCE_ERROR_MESSAGES,
};

const hasOwn = (object: object, key: unknown): boolean =>
  typeof key === "string" && Object.prototype.hasOwnProperty.call(object, key);

/** True when `value` is one of this package's error codes. */
export const isBrowserSecretsErrorCode = (
  value: unknown,
): value is BrowserSecretsErrorCode => hasOwn(ERROR_MESSAGES, value);

/** True when `value` is one of the reasons an error can carry. */
export const isBrowserSecretsReason = (
  value: unknown,
): value is BrowserSecretsReason => hasOwn(REASON_MESSAGES, value);

/** Agent-safe context for an error: IDs only, never values or vendor text. */
export type BrowserSecretsErrorContext = {
  readonly secretId?: string | undefined;
  readonly sourceId?: string | undefined;
};

/** Serialized form of a `BrowserSecretsError`. */
export type BrowserSecretsErrorJSON = {
  name: "BrowserSecretsError";
  code: BrowserSecretsErrorCode;
  reason?: BrowserSecretsReason;
  secretId?: string;
  sourceId?: string;
  message: string;
};

/**
 * The only error type this package throws or returns. The constructor
 * accepts codes, not text, and deliberately takes no `cause`. The optional
 * context carries IDs only.
 */
export class BrowserSecretsError extends Error {
  override readonly name = "BrowserSecretsError";
  readonly code: BrowserSecretsErrorCode;
  readonly reason?: BrowserSecretsReason;
  readonly secretId?: string;
  readonly sourceId?: string;

  constructor(
    code: BrowserSecretsErrorCode,
    reason?: BrowserSecretsReason,
    context: BrowserSecretsErrorContext = {},
  ) {
    const known = hasOwn(REASON_MESSAGES, reason) ? reason : undefined;
    const safeCode = hasOwn(ERROR_MESSAGES, code) ? code : "internal_error";
    super(
      known !== undefined ? REASON_MESSAGES[known] : ERROR_MESSAGES[safeCode],
    );
    this.code = safeCode;
    if (known !== undefined) this.reason = known;
    const { secretId, sourceId } = context;
    if (typeof secretId === "string" && secretId) this.secretId = secretId;
    if (typeof sourceId === "string" && sourceId) this.sourceId = sourceId;
  }

  /** Builds the error for a denied authorization decision. */
  static fromDecision(decision: AuthorizationDenied): BrowserSecretsError {
    return new BrowserSecretsError("destination_denied", decision.reason);
  }

  toJSON(): BrowserSecretsErrorJSON {
    return {
      name: this.name,
      code: this.code,
      ...(this.reason !== undefined ? { reason: this.reason } : {}),
      ...(this.secretId !== undefined ? { secretId: this.secretId } : {}),
      ...(this.sourceId !== undefined ? { sourceId: this.sourceId } : {}),
      message: this.message,
    };
  }

  /** Keeps `console.log` and `util.inspect` output to the safe fields. */
  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return `BrowserSecretsError [${this.code}${
      this.reason !== undefined ? `/${this.reason}` : ""
    }]: ${this.message}`;
  }
}

export function isBrowserSecretsError(
  value: unknown,
): value is BrowserSecretsError {
  return value instanceof BrowserSecretsError;
}

/**
 * Converts any thrown value into a safe error. A `BrowserSecretsError` is
 * returned unchanged. Anything else becomes `fallback` (by default
 * `internal_error`) and its message, body, and stack are dropped, so a raw
 * Turnkey response or a value in an exception cannot leak through.
 */
export function toSafeError(
  error: unknown,
  fallback: Exclude<
    BrowserSecretsErrorCode,
    "destination_denied"
  > = "internal_error",
): BrowserSecretsError {
  return isBrowserSecretsError(error)
    ? error
    : new BrowserSecretsError(fallback);
}
