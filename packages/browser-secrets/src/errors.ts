/**
 * Typed safe errors. Every message is a fixed string chosen by code. An
 * error never carries a raw Turnkey response body, a caught error, a URL, a
 * selector, or secret material, so it is safe to return to an agent and to
 * write to logs.
 */
import type { AuthorizationDenied, DenyReason } from "./authorize";

export type BrowserSecretsErrorCode =
  | "destination_denied"
  | "invalid_request"
  | "backend_error"
  | "internal_error";

const ERROR_MESSAGES: Readonly<Record<BrowserSecretsErrorCode, string>> = {
  destination_denied:
    "The fill target is outside the secret's destination binding.",
  invalid_request: "The request is not valid.",
  backend_error: "The secrets backend could not complete the request.",
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

/** Serialized form of a `BrowserSecretsError`. */
export type BrowserSecretsErrorJSON = {
  name: "BrowserSecretsError";
  code: BrowserSecretsErrorCode;
  reason?: DenyReason;
  message: string;
};

/**
 * The only error type this package throws or returns. The constructor
 * accepts codes, not text, and deliberately takes no `cause`.
 */
export class BrowserSecretsError extends Error {
  override readonly name = "BrowserSecretsError";
  readonly code: BrowserSecretsErrorCode;
  readonly reason?: DenyReason;

  constructor(code: BrowserSecretsErrorCode, reason?: DenyReason) {
    super(
      reason !== undefined
        ? (DENY_REASON_MESSAGES[reason] ?? ERROR_MESSAGES[code])
        : (ERROR_MESSAGES[code] ?? ERROR_MESSAGES.internal_error),
    );
    this.code = code in ERROR_MESSAGES ? code : "internal_error";
    if (reason !== undefined && reason in DENY_REASON_MESSAGES) {
      this.reason = reason;
    }
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
