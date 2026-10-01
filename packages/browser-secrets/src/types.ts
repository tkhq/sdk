/**
 * Core types for browser-secrets.
 *
 * The invariant these types serve: secret plaintext never appears in an
 * agent-facing value. The agent handles `SecretRef`s (metadata only) and
 * host-owned element IDs. Everything the authorization decision depends on
 * comes from the secret's static properties and from a `TargetObservation`
 * that the host builds from the live browser.
 */

/**
 * Static property keys that declare a secret's destination binding. Static
 * properties are set when the secret is imported, cannot change, and are
 * visible to Turnkey policies.
 */
export const BINDING_KEYS = {
  /**
   * Required. Exact top-level page origin, for example `https://github.com`.
   * Without it the secret is unbound, whatever other `sbm:` keys it has.
   */
  origin: "sbm:origin",
  /**
   * Optional. Exact origin of the iframe that receives the secret. When set,
   * the secret fills only into an iframe, never into the top-level document,
   * and a same-origin iframe needs it too.
   */
  frameOrigin: "sbm:frame-origin",
  /**
   * Optional. Top-level pathname pattern in `URLPattern` syntax, for example
   * `/login*`. An empty value constrains nothing.
   */
  urlPattern: "sbm:url-pattern",
  /** Optional. CSS selector that the target element must match. */
  selector: "sbm:selector",
  /**
   * Optional. For a secret whose value is a JSON object, a JSON-encoded map
   * from payload key to the CSS selector of the field that receives that
   * part, for example `{"number":"input[name=cardNumber]"}`. One export fills
   * every part.
   */
  fields: "sbm:fields",
} as const;

/** The static property prefix reserved for destination bindings. */
export const BINDING_KEY_PREFIX = "sbm:";

/** Static properties as Turnkey returns them. Unknown keys are kept. */
export type StaticProperties = Readonly<Record<string, string>>;

/** A destination binding parsed from static properties. */
export type SecretBinding = {
  readonly origin: string;
  readonly frameOrigin?: string;
  readonly urlPattern?: string;
  readonly selector?: string;
  /** Payload key to CSS selector. The object has no prototype. */
  readonly fields?: Readonly<Record<string, string>>;
};

/** Why a declared binding cannot be used. A secret with one never fills. */
export type BindingErrorCode =
  | "invalid_property_value"
  | "invalid_origin"
  | "invalid_frame_origin"
  | "invalid_url_pattern"
  | "invalid_selector"
  | "invalid_fields";

/** The result of parsing a secret's static properties. */
export type ParsedBinding =
  | { readonly status: "unbound" }
  | { readonly status: "bound"; readonly binding: SecretBinding }
  | { readonly status: "invalid"; readonly error: BindingErrorCode };

/**
 * The agent-visible handle for a secret. It holds metadata only, never the
 * secret value, so it is safe to serialize into tool results.
 */
export type SecretRef = {
  readonly secretId: string;
  readonly name?: string;
  /** All static properties, including keys this package does not know. */
  readonly staticProperties: StaticProperties;
  /** The parsed binding, for display. `authorize` parses the properties again. */
  readonly binding?: SecretBinding;
  /** Set instead of `binding` when the declared binding is malformed. */
  readonly bindingError?: BindingErrorCode;
};

/** One requested destination: a host-owned element ID and, for field-bound secrets, a payload key. */
export type FillTargetRequest = {
  readonly elementId: string;
  readonly key?: string;
};

/** What the agent asks for. It is untrusted input. */
export type FillRequest = {
  readonly targets: readonly FillTargetRequest[];
};

/**
 * One live document in a target's frame ancestry, as the host observed it
 * from the browser. The agent must not be able to supply or change any of
 * these values.
 */
export type ObservedDocument = {
  /** Host-owned frame identity. */
  readonly frameId: string;
  /** Host-owned document identity. A new document in the same frame gets a new ID. */
  readonly documentId: string;
  /** The live document URL, for example `about:srcdoc` for a srcdoc frame. */
  readonly url: string;
  /**
   * The document's effective origin as the browser reports it, read where
   * page script cannot change it (for example `window.origin` in an isolated
   * world). An opaque origin is the string `"null"`.
   */
  readonly origin: string;
};

/** Where the element sits relative to shadow roots. */
export type ShadowRootMode = "none" | "open" | "closed";

/** One observed target element. */
export type ObservedTarget = {
  /** Host-owned element identity, scoped to its document. */
  readonly elementId: string;
  /** From the top-level document (index 0) to the target's document (last). */
  readonly frames: readonly ObservedDocument[];
  /** Omitted means `"none"`. Closed shadow roots are not supported. */
  readonly shadowRoot?: ShadowRootMode;
  /**
   * Selector-match evidence: for each selector the binding requires, whether
   * the live element matches it (`Element.matches` in its own document or
   * shadow root). Use `requiredSelectors` to find which selectors to check.
   * A missing selector counts as no evidence and denies the fill.
   */
  readonly selectorMatches: Readonly<Record<string, boolean>>;
};

/**
 * A trusted observation of the fill destination, built by the host adapter
 * from the live browser just before the decision. An agent-supplied URL or
 * JSON description is not a trusted observation.
 */
export type TargetObservation = {
  /** Host-owned browser and session identity. */
  readonly browserSessionId: string;
  /** Host-owned tab (page target) identity. */
  readonly tabId: string;
  /** The live top-level URL. */
  readonly topLevelUrl: string;
  /** One entry for each requested element. */
  readonly targets: readonly ObservedTarget[];
};
