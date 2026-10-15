/**
 * The pure authorization decision: may this secret be written into these
 * observed targets? No I/O, no clock, no randomness. Call it before export,
 * again after export or approval, and again immediately before each write,
 * each time with a fresh observation.
 */
import { parseBinding } from "./binding";
import { httpOriginOf, matchesOrigin, matchesUrl } from "./matcher";
import type {
  FillRequest,
  FillTargetRequest,
  ObservedDocument,
  ObservedTarget,
  SecretBinding,
  SecretRef,
  TargetObservation,
} from "./types";

/**
 * Why a fill was refused. Codes are stable and safe to show to an agent.
 * The order below is the order in which `authorize` checks them.
 */
export const DENY_REASONS = [
  // Request shape. These do not need an observation.
  "request_invalid",
  "no_targets",
  "mixed_keyed_targets",
  "duplicate_target",
  // Secret binding.
  "binding_invalid",
  "unbound_secret",
  "unkeyed_target_for_field_binding",
  "unknown_field_key",
  // Observation.
  "observation_invalid",
  "top_level_origin_mismatch",
  "target_not_observed",
  "observation_inconsistent",
  "unsupported_document_scheme",
  "opaque_origin",
  "frame_binding_required",
  "frame_origin_mismatch",
  "unbound_intermediate_frame",
  "frame_bound_top_level_target",
  "url_pattern_mismatch",
  "unsupported_shadow_root",
  "selector_evidence_missing",
  "selector_mismatch",
] as const;

export type DenyReason = (typeof DENY_REASONS)[number];

/** An allowed target, with the identities later checks must see unchanged. */
export type AuthorizedTarget = {
  readonly elementId: string;
  readonly key?: string;
  /** The selector the element matched, if the binding requires one. */
  readonly selector?: string;
  readonly frameId: string;
  readonly documentId: string;
};

export type AuthorizationAllowed = {
  readonly allowed: true;
  readonly secretId: string;
  readonly browserSessionId: string;
  readonly tabId: string;
  readonly targets: readonly AuthorizedTarget[];
};

export type AuthorizationDenied = {
  readonly allowed: false;
  readonly reason: DenyReason;
  /** Index into `request.targets` of the target that failed, when one did. */
  readonly targetIndex?: number;
};

export type AuthorizationDecision = AuthorizationAllowed | AuthorizationDenied;

/** Result of the request-only checks. */
export type RequestValidation =
  | {
      readonly allowed: true;
      readonly binding: SecretBinding;
      readonly targets: readonly FillTargetRequest[];
    }
  | AuthorizationDenied;

const hasOwn = (object: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(object, key);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

function deny(reason: DenyReason, targetIndex?: number): AuthorizationDenied {
  return Object.freeze(
    targetIndex === undefined
      ? { allowed: false, reason }
      : { allowed: false, reason, targetIndex },
  );
}

/** The selector a target must match: the key's selector, or `sbm:selector`. */
function selectorFor(
  binding: SecretBinding,
  target: FillTargetRequest,
): string | undefined {
  return target.key === undefined
    ? binding.selector
    : binding.fields?.[target.key];
}

/**
 * Checks the request against the secret's binding without looking at the
 * browser. Everything refused here is refused before any export.
 */
export function validateRequest(
  ref: Pick<SecretRef, "staticProperties">,
  request: FillRequest,
): RequestValidation {
  const rawTargets: unknown = (request as { targets?: unknown } | null)
    ?.targets;
  if (!Array.isArray(rawTargets)) return deny("request_invalid");
  const targets: FillTargetRequest[] = [];
  for (const [index, raw] of rawTargets.entries()) {
    if (raw === null || typeof raw !== "object") {
      return deny("request_invalid", index);
    }
    const { elementId, key } = raw as { elementId?: unknown; key?: unknown };
    if (!isNonEmptyString(elementId)) return deny("request_invalid", index);
    if (key !== undefined && !isNonEmptyString(key)) {
      return deny("request_invalid", index);
    }
    targets.push(key === undefined ? { elementId } : { elementId, key });
  }
  if (targets.length === 0) return deny("no_targets");
  const keyed = targets.filter((t) => t.key !== undefined).length;
  if (keyed !== 0 && keyed !== targets.length) {
    return deny("mixed_keyed_targets");
  }
  // The same key and element twice is a duplicate. One element under two
  // keys is allowed, as in secure-browser-mcp's validateTargets
  // (src/tools/fill-common.ts), which deduplicates on key plus element.
  const seen = new Set<string>();
  for (const [index, target] of targets.entries()) {
    const tag = `${target.key ?? ""}\u0000${target.elementId}`;
    if (seen.has(tag)) return deny("duplicate_target", index);
    seen.add(tag);
  }

  const parsed = parseBinding(ref?.staticProperties);
  if (parsed.status === "invalid") return deny("binding_invalid");
  if (parsed.status === "unbound") return deny("unbound_secret");
  const { binding } = parsed;

  for (const [index, target] of targets.entries()) {
    if (target.key === undefined) {
      // A field-bound secret is a JSON payload with a selector for each
      // part. Without its own sbm:selector, an unkeyed fill would write the
      // whole payload into one field, so it is refused.
      if (binding.fields && binding.selector === undefined) {
        return deny("unkeyed_target_for_field_binding", index);
      }
    } else if (!binding.fields || !hasOwn(binding.fields, target.key)) {
      // The agent cannot invent destinations for payload parts. Only own
      // keys count: an inherited property such as `constructor` is not a
      // field. SBM reads `fields[key]` on a plain object, gets a function,
      // and the fill throws, so refusing it here breaks no existing secret.
      return deny("unknown_field_key", index);
    }
  }
  return { allowed: true, binding, targets };
}

/**
 * For each requested target, the selector the host must evaluate on the
 * live element and report in `ObservedTarget.selectorMatches`. Returns
 * `undefined` for targets that need no selector. Returns an empty array when
 * the request is refused before observation.
 */
export function requiredSelectors(
  ref: Pick<SecretRef, "staticProperties">,
  request: FillRequest,
): readonly { elementId: string; selector: string | undefined }[] {
  const validated = validateRequest(ref, request);
  if (!validated.allowed) return [];
  return validated.targets.map((target) => ({
    elementId: target.elementId,
    selector: selectorFor(validated.binding, target),
  }));
}

function isObservedDocument(value: unknown): value is ObservedDocument {
  if (value === null || typeof value !== "object") return false;
  const doc = value as Record<string, unknown>;
  return (
    isNonEmptyString(doc["frameId"]) &&
    isNonEmptyString(doc["documentId"]) &&
    isNonEmptyString(doc["url"]) &&
    isNonEmptyString(doc["origin"])
  );
}

function isObservedTarget(value: unknown): value is ObservedTarget {
  if (value === null || typeof value !== "object") return false;
  const target = value as Record<string, unknown>;
  const frames = target["frames"];
  const matches = target["selectorMatches"];
  const shadow = target["shadowRoot"];
  return (
    isNonEmptyString(target["elementId"]) &&
    Array.isArray(frames) &&
    frames.length > 0 &&
    frames.every(isObservedDocument) &&
    (shadow === undefined ||
      shadow === "none" ||
      shadow === "open" ||
      shadow === "closed") &&
    matches !== null &&
    typeof matches === "object" &&
    !Array.isArray(matches) &&
    Object.values(matches).every((v) => typeof v === "boolean")
  );
}

function isObservation(value: unknown): value is TargetObservation {
  if (value === null || typeof value !== "object") return false;
  const observation = value as Record<string, unknown>;
  const targets = observation["targets"];
  if (
    !isNonEmptyString(observation["browserSessionId"]) ||
    !isNonEmptyString(observation["tabId"]) ||
    !isNonEmptyString(observation["topLevelUrl"]) ||
    !Array.isArray(targets) ||
    !targets.every(isObservedTarget)
  ) {
    return false;
  }
  const ids = new Set(targets.map((t: ObservedTarget) => t.elementId));
  return ids.size === targets.length;
}

/** Checks one target's frame ancestry and selector evidence. */
function checkTarget(
  binding: SecretBinding,
  topLevelUrl: string,
  request: FillTargetRequest,
  observed: ObservedTarget,
  index: number,
): AuthorizationDenied | AuthorizedTarget {
  const frames = observed.frames;
  const top = frames[0]!;
  const doc = frames[frames.length - 1]!;
  if (top.url !== topLevelUrl) return deny("observation_inconsistent", index);

  // Use the browser's effective origins as well as document URLs: a
  // sandboxed HTTP iframe has an opaque origin despite its URL, and
  // about:blank, srcdoc, data: and blob: documents inherit or hide one.
  for (const frame of frames) {
    const urlOrigin = httpOriginOf(frame.url);
    if (urlOrigin === undefined) {
      return deny("unsupported_document_scheme", index);
    }
    if (frame.origin !== urlOrigin) return deny("opaque_origin", index);
  }
  if (top.origin !== binding.origin) {
    return deny("top_level_origin_mismatch", index);
  }

  if (frames.length > 1) {
    // Same-origin iframes need an explicit frame binding too.
    if (binding.frameOrigin === undefined) {
      return deny("frame_binding_required", index);
    }
    if (doc.origin !== binding.frameOrigin) {
      return deny("frame_origin_mismatch", index);
    }
    for (let i = 1; i < frames.length - 1; i++) {
      const origin = frames[i]!.origin;
      if (origin !== binding.origin && origin !== binding.frameOrigin) {
        return deny("unbound_intermediate_frame", index);
      }
    }
  } else if (binding.frameOrigin !== undefined) {
    return deny("frame_bound_top_level_target", index);
  }

  // The pathname pattern constrains the top-level page, not the frame.
  if (!matchesUrl(topLevelUrl, binding)) {
    return deny("url_pattern_mismatch", index);
  }

  if (observed.shadowRoot === "closed") {
    return deny("unsupported_shadow_root", index);
  }

  const selector = selectorFor(binding, request);
  if (selector !== undefined) {
    if (!hasOwn(observed.selectorMatches, selector)) {
      return deny("selector_evidence_missing", index);
    }
    if (observed.selectorMatches[selector] !== true) {
      return deny("selector_mismatch", index);
    }
  }

  return Object.freeze({
    elementId: request.elementId,
    ...(request.key !== undefined ? { key: request.key } : {}),
    ...(selector !== undefined ? { selector } : {}),
    frameId: doc.frameId,
    documentId: doc.documentId,
  });
}

/**
 * Decides whether `ref` may be written into the requested targets, given a
 * trusted observation of the live browser. Parses the binding from
 * `ref.staticProperties` every time; `ref.binding` is ignored.
 *
 * The first failed check wins; see `DENY_REASONS` for the order.
 */
export function authorize(
  ref: Pick<SecretRef, "secretId" | "staticProperties">,
  request: FillRequest,
  observation: TargetObservation,
): AuthorizationDecision {
  const validated = validateRequest(ref, request);
  if (!validated.allowed) return validated;
  const { binding, targets } = validated;

  if (!isObservation(observation)) return deny("observation_invalid");
  if (!matchesOrigin(observation.topLevelUrl, binding.origin)) {
    return deny("top_level_origin_mismatch");
  }

  const byElement = new Map(
    observation.targets.map((t) => [t.elementId, t] as const),
  );
  const authorized: AuthorizedTarget[] = [];
  for (const [index, target] of targets.entries()) {
    const observed = byElement.get(target.elementId);
    if (!observed) return deny("target_not_observed", index);
    const result = checkTarget(
      binding,
      observation.topLevelUrl,
      target,
      observed,
      index,
    );
    if ("allowed" in result) return result;
    authorized.push(result);
  }

  return Object.freeze({
    allowed: true,
    secretId: ref.secretId,
    browserSessionId: observation.browserSessionId,
    tabId: observation.tabId,
    targets: Object.freeze(authorized),
  });
}
