/**
 * Redaction registry. A host creates one registry for each tenant and
 * browser session, and passes every agent-facing output through it: tool
 * results, snapshots, traces, logs, notifications, and errors.
 *
 * Two kinds of state:
 *  - Values: exact plaintexts (and simple encodings of them) removed from
 *    any string. This is the backstop for values echoed in network bodies,
 *    console output, or page text.
 *  - Targets: document-scoped element identities that received a secret.
 *    Snapshot serializers check `isRegisteredTarget` and elide those values
 *    structurally, without depending on spotting the value.
 *
 * Register both before injection. Text scanning does not cover screenshots,
 * live previews, or transformed copies of a secret other than the encoded
 * and reformatted forms listed on `encodedVariants`. Pages reformat what
 * they receive and copy it into other elements (a re-rendered input, an
 * order summary), so snapshot serializers should also check each value
 * with `findSecretIds` and elide any element that holds a copy. JS strings
 * cannot be zeroized: `releaseSecret` and `clear` drop references only.
 *
 * Every marker in agent output tells the agent that the text there equaled
 * a registered value. An agent that can get text of its choice rendered and
 * read back can test guesses this way. `minValueLength` keeps very short
 * values, which are cheap to guess, out of the text scan.
 */

/** A document-scoped identity of an element that received a secret. */
export type RedactionTarget = {
  readonly browserSessionId: string;
  readonly tabId: string;
  readonly frameId: string;
  readonly documentId: string;
  readonly elementId: string;
};

export type RedactionRegistryOptions = {
  /**
   * Also register the common encoded and reformatted forms of each value
   * when they differ from it. Default: true. The forms are:
   *  - JSON-string-escaped, URL-encoded, and form-encoded (`+` for space)
   *  - HTML-escaped, as text-node and attribute serializers write it
   *  - Base64 and base64url of the UTF-8 bytes, with and without padding.
   *    Only the whole value is matched, not a value inside a longer
   *    encoded string such as `user:password`.
   *  - The NFC, NFD, lowercase, and uppercase forms of the value, and the
   *    encodings above of each
   *  - For a value with at least `LOOSE_MATCH_MIN_LENGTH` characters
   *    other than separators: the value with any separators (whitespace,
   *    including no-break and thin spaces, and `- . / _` and Unicode
   *    dashes) inserted between or removed from its characters, in any
   *    letter case. This catches input masks and formatters: card numbers
   *    in any grouping, IBANs, and reflowed keys.
   */
  encodedVariants?: boolean;
  /**
   * Values shorter than this (in UTF-16 code units) are not added to the
   * text scan, because they match unrelated text and are easy to guess.
   * Target tags still work for them. `registerValues` reports which secrets
   * it skipped. Default: 4.
   */
  minValueLength?: number;
  /** Builds the replacement text. Default: `[REDACTED:<secretId>]`. */
  marker?: (secretIds: readonly string[]) => string;
};

/**
 * Shortest value, counted without separators, that also matches loosely.
 * Shorter values (a CVC, an expiry, a PIN) would match unrelated text.
 */
export const LOOSE_MATCH_MIN_LENGTH = 8;

/** Characters formatters insert between groups. */
const SEPARATOR_CLASS = "[\\s\\-./_\\u2010-\\u2015\\u2212]";
const SEPARATORS = new RegExp(SEPARATOR_CLASS, "g");

/** The loose form of a value: separators removed, letter case folded. */
const looseForm = (value: string): string =>
  value.replace(SEPARATORS, "").toLowerCase();

type Pattern = {
  readonly value: string;
  readonly secretIds: readonly string[];
};

/** The scan list, compiled once per registry change and shared by a batch. */
type Compiled = {
  /** Longest first. */
  readonly patterns: readonly Pattern[];
  readonly byValue: ReadonlyMap<string, Pattern>;
  /** One alternation over all patterns; used when there are many. */
  readonly regex: RegExp | undefined;
  /**
   * One alternation over the loose forms, each in its own capture group,
   * with optional separators after every character. Case-insensitive.
   */
  readonly loose: RegExp | undefined;
  /** Secret IDs for each capture group of `loose`, in order. */
  readonly looseOwners: readonly (readonly string[])[];
};

/**
 * Below this many scan strings, one native `indexOf` pass per string is
 * fastest. Above it, a single regex alternation scans the text once.
 */
const REGEX_THRESHOLD = 8;

const DEFAULT_MIN_VALUE_LENGTH = 4;

const EMPTY: Compiled = {
  patterns: [],
  byValue: new Map(),
  regex: undefined,
  loose: undefined,
  looseOwners: [],
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");

function compile(
  values: ReadonlyMap<string, ReadonlySet<string>>,
  looseValues: ReadonlyMap<string, ReadonlySet<string>>,
): Compiled {
  if (values.size === 0) return EMPTY;
  const patterns = [...values.entries()]
    .map(([value, ids]) => ({ value, secretIds: [...ids].sort() }))
    .sort((a, b) => b.value.length - a.value.length);
  // Longest first, as for `regex`. A loose form has no separators, so only
  // the `*` after a character can consume a separator run, and a failed
  // alternative backtracks over at most one run.
  const loose = [...looseValues.entries()].sort(
    (a, b) => b[0].length - a[0].length,
  );
  return {
    loose:
      loose.length > 0
        ? new RegExp(
            loose
              .map(
                ([form]) =>
                  `(${[...form].map(escapeRegExp).join(`${SEPARATOR_CLASS}*`)})`,
              )
              .join("|"),
            "gi",
          )
        : undefined,
    looseOwners: loose.map(([, ids]) => [...ids].sort()),
    patterns,
    byValue: new Map(patterns.map((p) => [p.value, p])),
    // Longest first, so at any position the alternation takes the longest
    // registered value that starts there.
    regex:
      patterns.length > REGEX_THRESHOLD
        ? new RegExp(patterns.map((p) => escapeRegExp(p.value)).join("|"), "g")
        : undefined,
  };
}

const defaultMarker = (secretIds: readonly string[]): string =>
  secretIds.length === 1 ? `[REDACTED:${secretIds[0]}]` : "[REDACTED]";

const SEP = "\u0000";

const documentKey = (
  t: Pick<RedactionTarget, "browserSessionId" | "documentId">,
) => `${t.browserSessionId}${SEP}${t.documentId}`;

const targetKey = (t: RedactionTarget) =>
  [t.browserSessionId, t.tabId, t.frameId, t.documentId, t.elementId].join(SEP);

const HTML_ESCAPES: readonly (readonly [RegExp, Record<string, string>])[] = [
  // Text node: what innerHTML and outerHTML write for text.
  [/[&<>]/g, { "&": "&amp;", "<": "&lt;", ">": "&gt;" }],
  // Attribute value: what outerHTML writes for attributes.
  [/[&<>"]/g, { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }],
  // Full escaping, as most template engines write it.
  [
    /[&<>"']/g,
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" },
  ],
  [
    /[&<>"']/g,
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" },
  ],
];

function base64Forms(value: string): string[] {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const padded = btoa(binary);
  const unpadded = padded.replace(/=+$/, "");
  return [padded, unpadded, unpadded.replace(/\+/g, "-").replace(/\//g, "_")];
}

function encodedForms(value: string): string[] {
  const forms = new Set<string>();
  const bases = new Set([
    value,
    value.normalize("NFC"),
    value.normalize("NFD"),
    value.toLowerCase(),
    value.toUpperCase(),
  ]);
  for (const base of bases) {
    forms.add(base);
    forms.add(JSON.stringify(base).slice(1, -1));
    try {
      const uri = encodeURIComponent(base);
      forms.add(uri);
      forms.add(uri.replace(/%20/g, "+"));
    } catch {
      // Lone surrogates cannot be URI-encoded; the raw value still registers.
    }
    for (const [pattern, map] of HTML_ESCAPES) {
      forms.add(base.replace(pattern, (c) => map[c]!));
    }
    for (const form of base64Forms(base)) forms.add(form);
  }
  forms.delete(value);
  forms.delete("");
  return [...forms];
}

export class RedactionRegistry {
  #encodedVariants: boolean;
  #minValueLength: number;
  #marker: (secretIds: readonly string[]) => string;
  /** value -> secret IDs that registered it (raw or encoded form). */
  #values = new Map<string, Set<string>>();
  /** secret ID -> values it registered, for release. */
  #valuesBySecret = new Map<string, Set<string>>();
  /** loose form -> secret IDs that registered it. */
  #looseValues = new Map<string, Set<string>>();
  /** secret ID -> loose forms it registered, for release. */
  #looseBySecret = new Map<string, Set<string>>();
  /** target key -> secret IDs written into that element. */
  #targets = new Map<string, Set<string>>();
  /** document key -> target keys, for release on document replacement. */
  #targetsByDocument = new Map<string, Set<string>>();
  /** Compiled scan list, rebuilt lazily after a change. */
  #compiled: Compiled | undefined;

  constructor(options: RedactionRegistryOptions = {}) {
    this.#encodedVariants = options.encodedVariants ?? true;
    this.#minValueLength = options.minValueLength ?? DEFAULT_MIN_VALUE_LENGTH;
    this.#marker = options.marker ?? defaultMarker;
  }

  /**
   * Registers a live plaintext. Call it as soon as the value exists in
   * memory. Returns false when the value is shorter than `minValueLength`
   * and so is not text-scanned.
   */
  registerValue(value: string, secretId: string): boolean {
    return this.registerValues([{ value, secretId }]).length === 0;
  }

  /**
   * Registers several plaintexts with one rebuild of the scan list. Returns
   * the IDs of secrets with a non-empty value shorter than `minValueLength`,
   * which are not text-scanned. Hosts should keep such values out of
   * agent-visible text paths by other means.
   */
  registerValues(
    entries: readonly { readonly value: string; readonly secretId: string }[],
  ): string[] {
    const skipped = new Set<string>();
    for (const { value, secretId } of entries) {
      if (typeof value !== "string" || value.length === 0) continue;
      if (value.length < this.#minValueLength) {
        skipped.add(secretId);
        continue;
      }
      const forms = this.#encodedVariants
        ? [value, ...encodedForms(value)]
        : [value];
      let owned = this.#valuesBySecret.get(secretId);
      if (!owned) this.#valuesBySecret.set(secretId, (owned = new Set()));
      for (const form of forms) {
        if (form.length < this.#minValueLength) continue;
        let ids = this.#values.get(form);
        if (!ids) this.#values.set(form, (ids = new Set()));
        ids.add(secretId);
        owned.add(form);
      }
      if (this.#encodedVariants) this.#registerLoose(value, secretId);
    }
    this.#compiled = undefined;
    return [...skipped];
  }

  #registerLoose(value: string, secretId: string): void {
    const forms = new Set(
      [value, value.normalize("NFC"), value.normalize("NFD")].map(looseForm),
    );
    for (const form of forms) {
      if (form.length < LOOSE_MATCH_MIN_LENGTH) continue;
      let ids = this.#looseValues.get(form);
      if (!ids) this.#looseValues.set(form, (ids = new Set()));
      ids.add(secretId);
      let owned = this.#looseBySecret.get(secretId);
      if (!owned) this.#looseBySecret.set(secretId, (owned = new Set()));
      owned.add(form);
    }
  }

  /**
   * Registers an element that received (or is about to receive) a secret.
   * An element can hold parts of several secrets; each stays tagged until
   * that secret or the document is released.
   */
  registerTarget(target: RedactionTarget, secretId: string): void {
    const key = targetKey(target);
    let ids = this.#targets.get(key);
    if (!ids) this.#targets.set(key, (ids = new Set()));
    ids.add(secretId);
    const doc = documentKey(target);
    let keys = this.#targetsByDocument.get(doc);
    if (!keys) this.#targetsByDocument.set(doc, (keys = new Set()));
    keys.add(key);
  }

  isRegisteredTarget(target: RedactionTarget): boolean {
    return this.#targets.has(targetKey(target));
  }

  /** The secrets registered for a target, sorted. Empty when none are. */
  secretIdsForTarget(target: RedactionTarget): string[] {
    return [...(this.#targets.get(targetKey(target)) ?? [])].sort();
  }

  /**
   * Drops target tags for a document the host saw replaced. Values stay
   * registered: copies may still exist elsewhere.
   */
  releaseDocument(
    document: Pick<RedactionTarget, "browserSessionId" | "documentId">,
  ): void {
    const doc = documentKey(document);
    for (const key of this.#targetsByDocument.get(doc) ?? []) {
      this.#targets.delete(key);
    }
    this.#targetsByDocument.delete(doc);
  }

  /** Drops every value and target registered for a secret. */
  releaseSecret(secretId: string): void {
    for (const form of this.#valuesBySecret.get(secretId) ?? []) {
      const ids = this.#values.get(form);
      ids?.delete(secretId);
      if (ids && ids.size === 0) this.#values.delete(form);
    }
    this.#valuesBySecret.delete(secretId);
    for (const form of this.#looseBySecret.get(secretId) ?? []) {
      const ids = this.#looseValues.get(form);
      ids?.delete(secretId);
      if (ids && ids.size === 0) this.#looseValues.delete(form);
    }
    this.#looseBySecret.delete(secretId);
    for (const [key, ids] of this.#targets) {
      ids.delete(secretId);
      if (ids.size === 0) this.#targets.delete(key);
    }
    for (const [doc, keys] of this.#targetsByDocument) {
      for (const key of keys) if (!this.#targets.has(key)) keys.delete(key);
      if (keys.size === 0) this.#targetsByDocument.delete(doc);
    }
    this.#compiled = undefined;
  }

  /** Serializes to counts only, never to values or target IDs. */
  toJSON(): { valueCount: number; targetCount: number } {
    return { valueCount: this.valueCount, targetCount: this.targetCount };
  }

  /** Keeps `console.log` and `util.inspect` output free of values. */
  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return `RedactionRegistry { valueCount: ${this.valueCount}, targetCount: ${this.targetCount} }`;
  }

  /** Drops all state. */
  clear(): void {
    this.#values.clear();
    this.#valuesBySecret.clear();
    this.#looseValues.clear();
    this.#looseBySecret.clear();
    this.#targets.clear();
    this.#targetsByDocument.clear();
    this.#compiled = undefined;
  }

  /** Number of distinct exact scan strings, including encoded forms. */
  get valueCount(): number {
    return this.#values.size;
  }

  get targetCount(): number {
    return this.#targets.size;
  }

  #patterns(): Compiled {
    return (this.#compiled ??= compile(this.#values, this.#looseValues));
  }

  /**
   * The secrets with a registered value (in any form `scrubText` matches)
   * in `text`, sorted. Empty when there are none. Snapshot serializers use
   * it to elide elements that hold a copy of a secret, such as a field the
   * page re-rendered or an order summary, as they elide registered targets.
   */
  findSecretIds(text: string): string[] {
    const matches = collectMatches(this.#patterns(), text);
    return matches ? [...new Set(matches.owners.flat())].sort() : [];
  }

  /**
   * Replaces every occurrence of a registered value in `text`. Overlapping
   * or nested matches, including matches of different secrets, merge into
   * one replacement, so no fragment of a secret survives next to a marker.
   */
  scrubText(text: string): string {
    return scrubWith(this.#patterns(), this.#marker, text);
  }

  /** Scrubs several strings against one compiled scan list. */
  scrubTexts(texts: readonly string[]): string[] {
    const patterns = this.#patterns();
    return texts.map((text) => scrubWith(patterns, this.#marker, text));
  }

  /**
   * Scrubs a JSON-like value: strings, and the keys and values of arrays,
   * plain objects, `Map`s, and `Set`s, recursively. Returns a new value; the
   * input is not changed.
   *
   * Byte buffers (`ArrayBuffer`, `Uint8Array`, `Buffer`) are decoded as
   * UTF-8 and scrubbed. When that changes them, the result is the UTF-8
   * encoding of the scrubbed text, so non-text bytes in a changed buffer may
   * not survive. Other typed arrays and `DataView`s are copied unchanged.
   * Dates are copied. Other objects are copied as plain objects of their own
   * enumerable properties. Circular references become `"[Circular]"`.
   */
  scrub<T>(value: T): T {
    const patterns = this.#patterns();
    if (patterns.patterns.length === 0) return value;
    const text = (s: string) => scrubWith(patterns, this.#marker, s);
    const active = new Set<object>();
    const walk = (input: unknown): unknown => {
      if (typeof input === "string") return text(input);
      if (input === null || typeof input !== "object") return input;
      if (input instanceof Date) return new Date(input.getTime());
      if (input instanceof ArrayBuffer) return scrubBytes(input, text);
      if (ArrayBuffer.isView(input)) return scrubBytes(input, text);
      if (active.has(input)) return "[Circular]";
      active.add(input);
      try {
        if (Array.isArray(input)) return input.map(walk);
        if (input instanceof Map) {
          return new Map([...input].map(([k, v]) => [walk(k), walk(v)]));
        }
        if (input instanceof Set) return new Set([...input].map(walk));
        const out: Record<string, unknown> = {};
        for (const [key, inner] of Object.entries(input)) {
          Object.defineProperty(out, text(key), {
            value: walk(inner),
            enumerable: true,
            writable: true,
            configurable: true,
          });
        }
        return out;
      } finally {
        active.delete(input);
      }
    };
    return walk(value) as T;
  }
}

const utf8Decoder = new TextDecoder();
const utf8Encoder = new TextEncoder();

/** Copies a byte buffer, scrubbing it when it holds UTF-8 text. */
function scrubBytes(
  input: ArrayBuffer | ArrayBufferView,
  text: (s: string) => string,
): unknown {
  if (input instanceof ArrayBuffer) {
    const before = utf8Decoder.decode(input);
    const after = text(before);
    return after === before
      ? input.slice(0)
      : utf8Encoder.encode(after).buffer.slice(0);
  }
  if (!(input instanceof Uint8Array)) {
    // Other views are not text; copy them unchanged.
    const bytes = new Uint8Array(
      input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength),
    );
    return input instanceof DataView
      ? new DataView(bytes.buffer)
      : new (input.constructor as new (b: ArrayBufferLike) => unknown)(
          bytes.buffer,
        );
  }
  // `from` keeps the class: Uint8Array stays Uint8Array, Buffer stays Buffer.
  const make = (input.constructor as { from?: (b: Uint8Array) => unknown })
    .from;
  const before = utf8Decoder.decode(input);
  const after = text(before);
  const bytes = after === before ? input : utf8Encoder.encode(after);
  return typeof make === "function"
    ? make.call(input.constructor, bytes)
    : Uint8Array.from(bytes);
}

type Matches = {
  readonly starts: number[];
  readonly ends: number[];
  readonly owners: (readonly string[])[];
  /** Whether `starts` is in ascending order. */
  readonly sorted: boolean;
};

function collectMatches(compiled: Compiled, text: string): Matches | undefined {
  if (compiled.patterns.length === 0 || text.length === 0) return undefined;
  // Collect match intervals. Every position where any registered value
  // starts is found, so overlapping matches (of one value or of several)
  // merge below instead of leaving a fragment.
  let starts: number[] | undefined;
  const ends: number[] = [];
  const owners: (readonly string[])[] = [];
  let sorted = true;
  const { regex } = compiled;
  if (regex) {
    // Restart one position after each match start, not at its end, so a
    // value that starts inside another match is still found.
    regex.lastIndex = 0;
    for (let m = regex.exec(text); m !== null; m = regex.exec(text)) {
      const pattern = compiled.byValue.get(m[0])!;
      (starts ??= []).push(m.index);
      ends.push(m.index + pattern.value.length);
      owners.push(pattern.secretIds);
      regex.lastIndex = m.index + 1;
    }
  } else {
    for (const pattern of compiled.patterns) {
      if (pattern.value.length > text.length) continue;
      let at = text.indexOf(pattern.value);
      if (at === -1) continue;
      if (starts && at < starts[starts.length - 1]!) sorted = false;
      for (; at !== -1; at = text.indexOf(pattern.value, at + 1)) {
        (starts ??= []).push(at);
        ends.push(at + pattern.value.length);
        owners.push(pattern.secretIds);
      }
    }
  }
  const { loose } = compiled;
  if (loose) {
    // As for `regex`: restart one position after each match start.
    loose.lastIndex = 0;
    for (let m = loose.exec(text); m !== null; m = loose.exec(text)) {
      const group = m.findIndex((g, i) => i > 0 && g !== undefined);
      (starts ??= []).push(m.index);
      ends.push(m.index + m[0].length);
      owners.push(compiled.looseOwners[group - 1]!);
      sorted = false;
      loose.lastIndex = m.index + 1;
    }
  }
  return starts ? { starts, ends, owners, sorted } : undefined;
}

function scrubWith(
  compiled: Compiled,
  marker: (secretIds: readonly string[]) => string,
  text: string,
): string {
  const matches = collectMatches(compiled, text);
  if (!matches) return text;
  const { starts, ends, owners, sorted } = matches;

  let order: number[] = starts.map((_, i) => i);
  if (!sorted) order = order.sort((a, b) => starts[a]! - starts[b]!);

  const parts: string[] = [];
  let cursor = 0;
  let i = 0;
  while (i < order.length) {
    const first = order[i]!;
    const start = starts[first]!;
    let end = ends[first]!;
    const ids = new Set(owners[first]);
    i++;
    // Merge every interval that overlaps the current one.
    while (i < order.length && starts[order[i]!]! < end) {
      const next = order[i]!;
      if (ends[next]! > end) end = ends[next]!;
      for (const id of owners[next]!) ids.add(id);
      i++;
    }
    parts.push(text.slice(cursor, start), marker([...ids].sort()));
    cursor = end;
  }
  parts.push(text.slice(cursor));
  return parts.join("");
}
