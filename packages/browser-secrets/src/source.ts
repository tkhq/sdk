/**
 * The secret source contract (EMG-225). A source is a secret store that the
 * core lists references from and exports values from: Turnkey (the default,
 * EMG-165), a manifest-based store such as 1Password (`manifestSource`), or a
 * host's own module.
 *
 * A source declares what it guarantees in `SourceCapabilities`. The host,
 * never the agent, states what it requires with `requireSources`, and
 * `connectSource` refuses a source that cannot meet it. The defaults are
 * strict, and only Turnkey meets all of them, so a host that sets nothing
 * gets the Turnkey guarantees.
 *
 * A source returns its value to the core, never to the agent. Hosts must
 * not pass a `ConnectedSource`'s outcomes to an agent.
 *
 * Every source uses the `sbm:*` binding format, and `authorize` runs the
 * same way for every source. v1 has no composite source: each host picks
 * one source. `SecretRef.source` leaves room to route between several later.
 */
import { createSecretRef, type SecretMetadata } from "./binding";
import { BrowserSecretsError, isBrowserSecretsError } from "./errors";
import { httpOriginOf } from "./matcher";
import type { BindingProvenance, SecretRef } from "./types";

/** Why a source denied or failed an export. Codes are stable and agent-safe. */
export const SOURCE_ERROR_CODES = [
  "not_found",
  "policy_denied",
  "rejected",
  "expired",
  "verification_failed",
  "unavailable",
  "invalid_response",
  "source_error",
] as const;

export type SourceErrorCode = (typeof SOURCE_ERROR_CODES)[number];

/**
 * A safe reason for a denied or failed export: a fixed code and IDs. It
 * never holds a vendor's message text. Build one with `toSourceReason`.
 */
export type SourceReason = {
  readonly code: SourceErrorCode;
  readonly secretId?: string;
  readonly sourceId?: string;
};

/** Why `connectSource` refuses a source, in the order it checks them. */
export const SOURCE_REQUIREMENT_REASONS = [
  "capabilities_invalid",
  "approvals_required",
  "fixed_bindings_required",
  "export_policy_required",
  "audit_required",
  "ciphertext_delivery_required",
] as const;

export type SourceRequirementReason =
  (typeof SOURCE_REQUIREMENT_REASONS)[number];

/**
 * The audit record a source keeps for each export, strongest first:
 * a signed record (Turnkey activity), the provider's own log (1Password
 * Business activity log), or none.
 */
export type AuditLevel = "signed" | "provider-log" | "none";

/**
 * How a ready value reaches the core. `ciphertext`: encrypted to a recipient
 * key the core makes for the request, decrypted only inside the core.
 * `plaintext`: bytes handed over inside the trusted host; only for sources
 * that run in that host.
 */
export type DeliveryMode = "ciphertext" | "plaintext";

/** What a source guarantees. Read once, when the host connects it. */
export type SourceCapabilities = {
  readonly bindings: BindingProvenance;
  /** The source can hold an export for approval (return `pending`). */
  readonly approvals: boolean;
  /** The store evaluates its own policy on each export. */
  readonly exportPolicy: boolean;
  readonly audit: AuditLevel;
  readonly delivery: DeliveryMode;
  /** The source can produce one-time codes. Informational. */
  readonly otp: boolean;
};

/** A page request for `listRefs`. */
export type ListScope = {
  readonly cursor?: string;
  readonly limit?: number;
};

/** One page of secret metadata from a source. */
export type SourceListing = {
  readonly refs: readonly SecretMetadata[];
  /** Set when there are more pages. */
  readonly nextCursor?: string;
};

/** One authorized export. The core makes it after `authorize` allows a fill. */
export type ExportRequest = {
  /** Independent per request, so two fills never share an approval. */
  readonly requestId: string;
  readonly ref: SecretRef;
  /** The core's per-request recipient key. Required for ciphertext sources. */
  readonly recipientPublicKey?: string;
};

/**
 * A handle to a pending approval. Plain JSON, so the host can persist it
 * and resume after a restart. The host keeps it with the parked fill and
 * its owner; the agent gets the host's own fill ID, never the handle.
 */
export type PendingHandle = {
  /** The approval the approvers act on, for example a Turnkey activity ID. Agent-safe. */
  readonly id: string;
  /** Epoch milliseconds after which the approval can no longer complete. */
  readonly expiresAt?: number;
  /**
   * Source-owned data that `resume` needs, for example the export proposal.
   * It can be key material: the host stores it encrypted and never shows it
   * to the agent.
   */
  readonly state?: string;
};

/** The original request and its handle. Use the same `recipientPublicKey`. */
export type ResumeRequest = ExportRequest & { readonly handle: PendingHandle };

/** A ready value, for the core only. */
export type Delivery =
  | { readonly mode: "ciphertext"; readonly bundle: string }
  | { readonly mode: "plaintext"; readonly value: string };

/**
 * The result of an export or resume.
 *
 * - `ready`: the value, for the core only. A JSON value for a secret bound
 *   with `sbm:fields`. `expiresAt` marks a short-lived value (a one-time
 *   code); the core passes it to `RedactionRegistry`. It is the end of
 *   the window in which a verifier still accepts the code, not when the
 *   code was issued.
 * - `pending`: waiting for approval. Call `resume` with the handle.
 * - `denied`: the source refused. Nothing was released.
 * - `failed`: the source could not finish. `submitted: "no"` means no
 *   request reached the store and a retry is safe. `"unknown"` means one may
 *   have, and the core must not retry on its own.
 */
export type ExportOutcome =
  | {
      readonly kind: "ready";
      readonly delivery: Delivery;
      readonly expiresAt?: number;
    }
  | {
      readonly kind: "pending";
      readonly handle: PendingHandle;
      readonly approvalUrl?: string;
    }
  | { readonly kind: "denied"; readonly reason: SourceReason }
  | {
      readonly kind: "failed";
      readonly reason: SourceReason;
      readonly submitted: "no" | "unknown";
    };

/** The contract every secret source implements. */
export interface SecretSource {
  /** Lowercase letters, digits, and `-`, for example `"turnkey"`. */
  readonly id: string;
  readonly capabilities: SourceCapabilities;
  /** Lists secret metadata. The core builds the agent-visible refs. */
  listRefs(scope: ListScope): Promise<SourceListing>;
  /** Starts an export for one authorized request. */
  export(request: ExportRequest): Promise<ExportOutcome>;
  /**
   * Checks a pending approval once and returns without waiting. Returns
   * `pending` while approvers have not acted. Required when
   * `capabilities.approvals` is true.
   */
  resume?(request: ResumeRequest): Promise<ExportOutcome>;
}

/**
 * What the host requires of its source. Set by the host from its own
 * configuration, never from agent input.
 */
export type SourceRequirements = {
  /** Require a source that can hold a fill for approval. */
  readonly approvals: boolean;
  readonly bindings: "fixed-at-source" | "any";
  readonly exportPolicy: boolean;
  /** The weakest audit level accepted. */
  readonly audit: AuditLevel | "any";
  readonly delivery: "ciphertext" | "any";
};

/** The defaults: every guarantee Turnkey gives. */
export const STRICT_SOURCE_REQUIREMENTS: SourceRequirements = Object.freeze({
  approvals: true,
  bindings: "fixed-at-source",
  exportPolicy: true,
  audit: "signed",
  delivery: "ciphertext",
});

const BOOL = [true, false] as const;

const REQUIREMENT_VALUES = {
  approvals: BOOL,
  bindings: ["fixed-at-source", "any"],
  exportPolicy: BOOL,
  audit: ["signed", "provider-log", "none", "any"],
  delivery: ["ciphertext", "any"],
} as const;

const CAPABILITY_VALUES = {
  bindings: ["fixed-at-source", "operator-manifest"],
  approvals: BOOL,
  exportPolicy: BOOL,
  audit: ["signed", "provider-log", "none"],
  delivery: ["ciphertext", "plaintext"],
  otp: BOOL,
} as const;

const AUDIT_RANK: Readonly<Record<AuditLevel, number>> = {
  none: 0,
  "provider-log": 1,
  signed: 2,
};

const SOURCE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isOptionalTimestamp = (value: unknown): value is number | undefined =>
  value === undefined || (typeof value === "number" && Number.isFinite(value));

const oneOf = <T>(value: unknown, options: readonly T[]): value is T =>
  options.includes(value as T);

/**
 * Copies the keys of `spec` from `value`, or returns undefined when one
 * does not hold an allowed value. Sources and host config can be plain
 * JavaScript, so the core checks what it reads.
 */
function pick<T>(
  value: unknown,
  spec: Readonly<Record<string, readonly unknown[]>>,
): T | undefined {
  if (!isObject(value)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, allowed] of Object.entries(spec)) {
    if (!allowed.includes(value[key])) return undefined;
    out[key] = value[key];
  }
  return Object.freeze(out) as T;
}

/**
 * Builds the host's requirements. Anything not set keeps the strict
 * default, so each guarantee a host gives up is named in its config.
 */
export function requireSources(
  overrides: Partial<SourceRequirements> = {},
): SourceRequirements {
  const requirements = pick<SourceRequirements>(
    { ...STRICT_SOURCE_REQUIREMENTS, ...overrides },
    REQUIREMENT_VALUES,
  );
  if (!requirements) throw new BrowserSecretsError("source_config_invalid");
  return requirements;
}

/** The first host requirement the source fails, if any. */
function refusal(
  caps: SourceCapabilities,
  required: SourceRequirements,
): SourceRequirementReason | undefined {
  if (required.approvals && !caps.approvals) return "approvals_required";
  if (
    required.bindings === "fixed-at-source" &&
    caps.bindings !== "fixed-at-source"
  ) {
    return "fixed_bindings_required";
  }
  if (required.exportPolicy && !caps.exportPolicy) {
    return "export_policy_required";
  }
  if (
    required.audit !== "any" &&
    AUDIT_RANK[caps.audit] < AUDIT_RANK[required.audit]
  ) {
    return "audit_required";
  }
  if (required.delivery === "ciphertext" && caps.delivery !== "ciphertext") {
    return "ciphertext_delivery_required";
  }
  return undefined;
}

/**
 * Converts anything a source caught or threw into a safe reason: a fixed
 * code and the IDs, without the vendor's message text. A
 * `BrowserSecretsError` with a source error code keeps its code; anything
 * else becomes `fallback`.
 */
export function toSourceReason(
  error: unknown,
  context: { readonly secretId?: string; readonly sourceId?: string } = {},
  fallback: SourceErrorCode = "source_error",
): SourceReason {
  const code =
    isBrowserSecretsError(error) &&
    error.code === "source_error" &&
    oneOf(error.reason, SOURCE_ERROR_CODES)
      ? error.reason
      : fallback;
  return Object.freeze({
    code,
    ...(isNonEmptyString(context.secretId)
      ? { secretId: context.secretId }
      : {}),
    ...(isNonEmptyString(context.sourceId)
      ? { sourceId: context.sourceId }
      : {}),
  });
}

/** A source after `connectSource` has checked it. */
export type ConnectedSource = {
  readonly id: string;
  /** The capabilities as read at connection. Later changes are ignored. */
  readonly capabilities: SourceCapabilities;
  /** One page of agent-safe refs, stamped with this source's ID and binding provenance. */
  listRefs(
    scope?: ListScope,
  ): Promise<{ refs: SecretRef[]; nextCursor?: string }>;
  /** Never throws for a source failure; returns a checked outcome. */
  export(request: ExportRequest): Promise<ExportOutcome>;
  resume(request: ResumeRequest): Promise<ExportOutcome>;
};

/**
 * Checks `source` against the host's requirements and wraps it. Throws a
 * `source_refused` error with a typed reason when the source cannot meet
 * them, and `source_config_invalid` when `requirements` is not a complete
 * `SourceRequirements` (build it with `requireSources`). A missing or
 * unknown requirement never counts as `"any"`.
 *
 * The wrapper enforces the contract on every call:
 * - Refs get `source` and `bindingProvenance` from the connection, not
 *   from the source's listing.
 * - Outcomes are rebuilt from known fields only. A `pending` from a source
 *   without approvals, or a delivery in a mode the source did not declare,
 *   becomes `failed` with `invalid_response`.
 * - Reasons keep a known code (others become `source_error`) and get IDs
 *   from the request.
 * - A thrown error becomes `failed` with `submitted: "unknown"`.
 */
export function connectSource(
  source: SecretSource,
  requirements: SourceRequirements = STRICT_SOURCE_REQUIREMENTS,
): ConnectedSource {
  const required = pick<SourceRequirements>(requirements, REQUIREMENT_VALUES);
  if (!required) throw new BrowserSecretsError("source_config_invalid");
  const caps = pick<SourceCapabilities>(
    (source as { capabilities?: unknown } | null)?.capabilities,
    CAPABILITY_VALUES,
  );
  const id: unknown = (source as { id?: unknown } | null)?.id;
  const valid =
    caps !== undefined &&
    typeof id === "string" &&
    SOURCE_ID.test(id) &&
    typeof source.listRefs === "function" &&
    typeof source.export === "function" &&
    (!caps.approvals || typeof source.resume === "function");
  const reason = valid ? refusal(caps, required) : "capabilities_invalid";
  if (reason !== undefined) {
    throw new BrowserSecretsError("source_refused", reason, {
      sourceId: typeof id === "string" && SOURCE_ID.test(id) ? id : undefined,
    });
  }
  const sourceId = id as string;
  const capabilities = caps!;
  const invalidRequest = () =>
    new BrowserSecretsError("invalid_request", undefined, { sourceId });

  const checkRequest = (request: ExportRequest): void => {
    if (
      !isObject(request) ||
      !isNonEmptyString(request.requestId) ||
      !isObject(request.ref) ||
      !isNonEmptyString(request.ref.secretId) ||
      (request.ref.source !== undefined && request.ref.source !== sourceId) ||
      (capabilities.delivery === "ciphertext" &&
        !isNonEmptyString(request.recipientPublicKey))
    ) {
      throw invalidRequest();
    }
  };

  const run = async (
    secretId: string,
    call: () => Promise<unknown>,
  ): Promise<ExportOutcome> => {
    const context = { secretId, sourceId };
    try {
      return normalizeOutcome(await call(), capabilities, context);
    } catch (error) {
      return failed(toSourceReason(error, context), "unknown");
    }
  };

  return Object.freeze({
    id: sourceId,
    capabilities,
    listRefs: async (scope: ListScope = {}) => {
      let listing: unknown;
      try {
        listing = await source.listRefs(scope);
      } catch (error) {
        const reason = toSourceReason(error, { sourceId });
        throw new BrowserSecretsError("source_error", reason.code, reason);
      }
      if (!isListing(listing)) {
        throw new BrowserSecretsError("source_error", "invalid_response", {
          sourceId,
        });
      }
      return {
        refs: listing.refs.map(({ secretId, name, staticProperties }) =>
          createSecretRef({
            secretId,
            name,
            staticProperties,
            source: sourceId,
            bindingProvenance: capabilities.bindings,
          }),
        ),
        ...(listing.nextCursor !== undefined
          ? { nextCursor: listing.nextCursor }
          : {}),
      };
    },
    export: async (request: ExportRequest) => {
      checkRequest(request);
      return run(request.ref.secretId, () => source.export(request));
    },
    resume: async (request: ResumeRequest) => {
      checkRequest(request);
      if (!capabilities.approvals || !isNonEmptyString(request.handle?.id)) {
        throw invalidRequest();
      }
      return run(request.ref.secretId, () => source.resume!(request));
    },
  });
}

const isEntry = (entry: unknown): boolean =>
  isObject(entry) &&
  isNonEmptyString(entry["secretId"]) &&
  ["string", "undefined"].includes(typeof entry["name"]) &&
  (entry["staticProperties"] === undefined ||
    (isObject(entry["staticProperties"]) &&
      Object.values(entry["staticProperties"]).every(
        (v) => typeof v === "string",
      )));

const isListing = (value: unknown): value is SourceListing =>
  isObject(value) &&
  Array.isArray(value["refs"]) &&
  value["refs"].every(isEntry) &&
  (value["nextCursor"] === undefined || isNonEmptyString(value["nextCursor"]));

function failed(
  reason: SourceReason,
  submitted: "no" | "unknown",
): ExportOutcome {
  return { kind: "failed", reason, submitted };
}

/** Rebuilds a source's outcome from known fields, or fails it. */
function normalizeOutcome(
  raw: unknown,
  caps: SourceCapabilities,
  context: { secretId: string; sourceId: string },
): ExportOutcome {
  const reason = (value: unknown): SourceReason => {
    const code = isObject(value) ? value["code"] : undefined;
    return toSourceReason(
      undefined,
      context,
      oneOf(code, SOURCE_ERROR_CODES) ? code : "source_error",
    );
  };
  const invalid = failed(
    toSourceReason(undefined, context, "invalid_response"),
    "unknown",
  );
  if (!isObject(raw)) return invalid;

  switch (raw["kind"]) {
    case "ready": {
      const delivery = raw["delivery"];
      const field = caps.delivery === "ciphertext" ? "bundle" : "value";
      const expiresAt = raw["expiresAt"];
      if (
        !isObject(delivery) ||
        delivery["mode"] !== caps.delivery ||
        !isNonEmptyString(delivery[field]) ||
        !isOptionalTimestamp(expiresAt)
      ) {
        return invalid;
      }
      return {
        kind: "ready",
        delivery: { mode: caps.delivery, [field]: delivery[field] } as Delivery,
        ...(expiresAt !== undefined ? { expiresAt } : {}),
      };
    }
    case "pending": {
      const handle = raw["handle"];
      if (
        !caps.approvals ||
        !isObject(handle) ||
        !isNonEmptyString(handle["id"]) ||
        !isOptionalTimestamp(handle["expiresAt"]) ||
        (handle["state"] !== undefined && typeof handle["state"] !== "string")
      ) {
        return invalid;
      }
      const { id, expiresAt, state } = handle;
      const approvalUrl = raw["approvalUrl"];
      return {
        kind: "pending",
        handle: {
          id,
          ...(expiresAt !== undefined ? { expiresAt } : {}),
          ...(state !== undefined ? { state } : {}),
        },
        ...(typeof approvalUrl === "string" &&
        httpOriginOf(approvalUrl) !== undefined
          ? { approvalUrl }
          : {}),
      };
    }
    case "denied":
      return { kind: "denied", reason: reason(raw["reason"]) };
    case "failed":
      return failed(
        reason(raw["reason"]),
        raw["submitted"] === "no" ? "no" : "unknown",
      );
    default:
      return invalid;
  }
}
