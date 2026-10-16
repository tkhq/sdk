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
  /**
   * The source can produce one-time codes. Only a source with `otp: true`
   * can mark a ready value with `expiresAt`; `connectSource` drops the
   * field from any other source, so a long-lived secret cannot be given a
   * short redaction window.
   */
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
 *   code was issued. Only a source with `capabilities.otp` can set it.
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

export const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export const isOptionalTimestamp = (
  value: unknown,
): value is number | undefined =>
  value === undefined || (typeof value === "number" && Number.isFinite(value));

const oneOf = <T>(value: unknown, options: readonly T[]): value is T =>
  options.includes(value as T);

/**
 * Copies the keys of `spec` from `value`, or returns undefined when one
 * does not hold an allowed value. Sources and host config can be plain
 * JavaScript, so the core checks what it reads.
 */
function pick<T extends object>(
  value: unknown,
  spec: { readonly [K in keyof T]: readonly T[K][] },
): T | undefined {
  if (!isObject(value)) return undefined;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(spec) as (keyof T & string)[]) {
    // Read once, so a getter cannot pass the check and then change.
    const field = value[key];
    if (!(spec[key] as readonly unknown[]).includes(field)) return undefined;
    out[key] = field;
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
  return readRequirements({ ...STRICT_SOURCE_REQUIREMENTS, ...overrides });
}

function readRequirements(value: unknown): SourceRequirements {
  const requirements = pick<SourceRequirements>(value, REQUIREMENT_VALUES);
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
 *   becomes `failed` with `invalid_response`. An `expiresAt` on a ready
 *   value from a source without `otp` is dropped: the value is then
 *   redacted until the host releases it.
 * - Reasons keep a known code (others become `source_error`) and get IDs
 *   from the request.
 * - A thrown error becomes `failed` with `submitted: "unknown"`.
 * - `export` and `resume` reject a malformed request with
 *   `invalid_request`. The source gets a copy built from the checked
 *   fields, with `ref.source` set to this source's ID.
 * - `resume` rejects a malformed handle with `invalid_request`. A handle
 *   whose `expiresAt` is past is `denied` with `expired` without calling
 *   the source.
 */
export function connectSource(
  source: SecretSource,
  requirements: SourceRequirements = STRICT_SOURCE_REQUIREMENTS,
): ConnectedSource {
  const required = readRequirements(requirements);
  const raw: unknown = source;
  const capabilities = isObject(raw)
    ? pick<SourceCapabilities>(raw["capabilities"], CAPABILITY_VALUES)
    : undefined;
  const id = isObject(raw) ? raw["id"] : undefined;
  const sourceId =
    typeof id === "string" && SOURCE_ID.test(id) ? id : undefined;
  const listRefs = capabilities ? source.listRefs : undefined;
  const exportValue = capabilities ? source.export : undefined;
  const resume = capabilities?.approvals ? source.resume : undefined;
  if (
    capabilities === undefined ||
    sourceId === undefined ||
    typeof listRefs !== "function" ||
    typeof exportValue !== "function" ||
    (capabilities.approvals && typeof resume !== "function")
  ) {
    throw new BrowserSecretsError("source_refused", "capabilities_invalid", {
      sourceId,
    });
  }
  const reason = refusal(capabilities, required);
  if (reason !== undefined) {
    throw new BrowserSecretsError("source_refused", reason, { sourceId });
  }
  const invalidRequest = () =>
    new BrowserSecretsError("invalid_request", undefined, { sourceId });

  /**
   * Checks a request and returns a copy built from the values it checked.
   * The source gets the copy, so a getter cannot pass the check and then
   * show the source a different secret.
   */
  const readRequest = (request: ExportRequest): ExportRequest => {
    const rawRequest: unknown = request;
    if (!isObject(rawRequest)) throw invalidRequest();
    const requestId = rawRequest["requestId"];
    const ref = rawRequest["ref"];
    const secretId = isObject(ref) ? ref["secretId"] : undefined;
    const refSource = isObject(ref) ? ref["source"] : undefined;
    const recipient = rawRequest["recipientPublicKey"];
    if (
      !isObject(ref) ||
      !isNonEmptyString(requestId) ||
      !isNonEmptyString(secretId) ||
      (refSource !== undefined && refSource !== sourceId) ||
      (capabilities.delivery === "ciphertext" && !isNonEmptyString(recipient))
    ) {
      throw invalidRequest();
    }
    return Object.freeze({
      requestId,
      // The checked ID and this source's ID replace whatever the spread
      // reads, so they are the values the check saw.
      ref: Object.freeze({
        ...(ref as SecretRef),
        secretId,
        source: sourceId,
      }),
      ...(isNonEmptyString(recipient) ? { recipientPublicKey: recipient } : {}),
    });
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
        listing = await listRefs.call(source, scope);
      } catch (error) {
        const reason = toSourceReason(error, { sourceId });
        throw new BrowserSecretsError("source_error", reason.code, reason);
      }
      const page = readListing(listing, sourceId, capabilities.bindings);
      if (!page) {
        throw new BrowserSecretsError("source_error", "invalid_response", {
          sourceId,
        });
      }
      return page;
    },
    export: async (request: ExportRequest) => {
      const checked = readRequest(request);
      return run(checked.ref.secretId, () => exportValue.call(source, checked));
    },
    resume: async (request: ResumeRequest): Promise<ExportOutcome> => {
      const checked = readRequest(request);
      const secretId = checked.ref.secretId;
      const handle = resume ? readHandle(request.handle) : undefined;
      if (!resume || !handle) throw invalidRequest();
      // An approval past its window can no longer complete; do not ask.
      if (handle.expiresAt !== undefined && Date.now() > handle.expiresAt) {
        return {
          kind: "denied",
          reason: toSourceReason(undefined, { secretId, sourceId }, "expired"),
        };
      }
      return run(secretId, () => resume.call(source, { ...checked, handle }));
    },
  });
}

/**
 * Copies one listing entry, or returns undefined when it is malformed. Each
 * field is read once, so a getter cannot pass the check and then change.
 */
function readEntry(
  entry: unknown,
  source: string,
  bindingProvenance: BindingProvenance,
): SecretMetadata | undefined {
  if (!isObject(entry)) return undefined;
  const secretId = entry["secretId"];
  const name = entry["name"];
  const rawProperties = entry["staticProperties"];
  if (!isNonEmptyString(secretId)) return undefined;
  if (name !== undefined && typeof name !== "string") return undefined;
  let staticProperties: Record<string, string> | undefined;
  if (rawProperties !== undefined) {
    if (!isObject(rawProperties)) return undefined;
    // `Object.entries` reads each property once; check the copy.
    const copy: Record<string, unknown> = Object.fromEntries(
      Object.entries(rawProperties),
    );
    if (!Object.values(copy).every((v) => typeof v === "string")) {
      return undefined;
    }
    staticProperties = copy as Record<string, string>;
  }
  return { secretId, name, staticProperties, source, bindingProvenance };
}

/**
 * Copies a pending handle, or returns undefined when it is malformed. Each
 * field is read once, so a getter cannot pass the check and then change.
 */
function readHandle(raw: unknown): PendingHandle | undefined {
  if (!isObject(raw)) return undefined;
  const id = raw["id"];
  const expiresAt = raw["expiresAt"];
  const state = raw["state"];
  if (
    !isNonEmptyString(id) ||
    !isOptionalTimestamp(expiresAt) ||
    (state !== undefined && typeof state !== "string")
  ) {
    return undefined;
  }
  return {
    id,
    ...(expiresAt !== undefined ? { expiresAt } : {}),
    ...(state !== undefined ? { state } : {}),
  };
}

/** Copies a listing page, or returns undefined when it is malformed. */
function readListing(
  value: unknown,
  source: string,
  bindingProvenance: BindingProvenance,
): { refs: SecretRef[]; nextCursor?: string } | undefined {
  if (!isObject(value)) return undefined;
  const rawRefs = value["refs"];
  const nextCursor = value["nextCursor"];
  if (!Array.isArray(rawRefs)) return undefined;
  if (nextCursor !== undefined && !isNonEmptyString(nextCursor)) {
    return undefined;
  }
  const refs: SecretRef[] = [];
  for (const raw of Array.from(rawRefs as unknown[])) {
    const entry = readEntry(raw, source, bindingProvenance);
    if (!entry) return undefined;
    refs.push(createSecretRef(entry));
  }
  return { refs, ...(nextCursor !== undefined ? { nextCursor } : {}) };
}

function failed(
  reason: SourceReason,
  submitted: "no" | "unknown",
): ExportOutcome {
  return { kind: "failed", reason, submitted };
}

/**
 * Rebuilds a source's outcome from known fields, or fails it. Each field is
 * read once into a local, checked, and the local is copied, so a getter
 * cannot pass the check and then change.
 */
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
      const expiresAt = raw["expiresAt"];
      if (!isObject(delivery) || !isOptionalTimestamp(expiresAt)) {
        return invalid;
      }
      const ciphertext = caps.delivery === "ciphertext";
      const mode = delivery["mode"];
      const payload = delivery[ciphertext ? "bundle" : "value"];
      if (mode !== caps.delivery || !isNonEmptyString(payload)) {
        return invalid;
      }
      return {
        kind: "ready",
        delivery: ciphertext
          ? { mode: "ciphertext", bundle: payload }
          : { mode: "plaintext", value: payload },
        // Only a source that issues one-time codes may shorten redaction.
        ...(caps.otp && expiresAt !== undefined ? { expiresAt } : {}),
      };
    }
    case "pending": {
      const handle = caps.approvals ? readHandle(raw["handle"]) : undefined;
      if (!handle) return invalid;
      const approvalUrl = raw["approvalUrl"];
      return {
        kind: "pending",
        handle,
        ...(typeof approvalUrl === "string" &&
        httpOriginOf(approvalUrl) !== undefined
          ? { approvalUrl }
          : {}),
      };
    }
    case "denied":
      return { kind: "denied", reason: reason(raw["reason"]) };
    case "failed": {
      const submitted = raw["submitted"];
      return failed(
        reason(raw["reason"]),
        submitted === "no" ? "no" : "unknown",
      );
    }
    default:
      return invalid;
  }
}
