/**
 * Redaction registry. A host creates one registry for each tenant and
 * browser session, and passes every agent-facing output through it: tool
 * results, snapshots, traces, logs, notifications, and errors.
 *
 * Two kinds of state:
 *  - Values: plaintexts, their common encodings, and their reformatted
 *    copies, removed from any string. This is the backstop for values
 *    echoed in network bodies, console output, or page text.
 *  - Targets: document-scoped element identities that received a secret.
 *    Snapshot serializers check `isRegisteredTarget` and elide those values
 *    structurally, without depending on spotting the value.
 *
 * Register both before injection. Text scanning does not cover screenshots,
 * live previews, or transformed copies of a secret other than the forms
 * listed on `encodedVariants`. Pages reformat what they receive and copy it
 * into other elements (a re-rendered input, an order summary, a value split
 * over several inputs), so snapshot serializers should also check element
 * values with `findSecretIds` or `findMatches` and elide any element that
 * holds a copy. JS strings cannot be zeroized: `releaseSecret` and `clear`
 * drop references only.
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
   * Also match the common encoded and reformatted forms of each value.
   * Default: true. The forms are:
   *  - JSON-string-escaped, URL-encoded, and form-encoded (`+` for space)
   *  - HTML-escaped, as text-node and attribute serializers write it
   *  - Base64 and base64url of the UTF-8 bytes, with and without padding.
   *    Only the whole value is matched, not a value inside a longer
   *    encoded string such as `user:password`.
   *  - The NFC, NFD, lowercase, and uppercase forms of the value, and the
   *    encodings above of each
   *  - For a value with at least `LOOSE_MATCH_MIN_LENGTH` letters and
   *    digits: copies with separators added, removed, or changed. The scan
   *    keeps letters and digits only, after NFKC normalization and case
   *    folding, reads decimal digits in any script as 0-9, and decodes
   *    percent escapes and numeric HTML character references. A named
   *    reference to punctuation or a space, such as `&nbsp;`, counts as one
   *    separator. Any other
   *    character is a separator, with at most three in a row between two
   *    kept characters. A value made only of
   *    digits compares on digits only, so letters between its groups count
   *    as separators too. This catches input masks and formatters: card
   *    numbers in any grouping, IBANs, and reflowed keys.
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
  /** Clock for value expiry, in epoch milliseconds. Default: `Date.now`. */
  now?: () => number;
};

/** One value to register. */
export type RedactionValue = {
  readonly value: string;
  readonly secretId: string;
  /**
   * Epoch milliseconds after which the value stops matching, for
   * short-lived values such as one-time codes. Omitted means it matches
   * until released. A value registered both with and without an expiry
   * never expires; two expiries keep the later one. An expiry that is not
   * a number, is NaN, or is already past (for example epoch seconds read
   * as milliseconds) counts as no expiry, so a bad expiry never stops a
   * value from being redacted. Set it to the end of the window in which
   * a verifier still accepts the code, not to when the code was shown:
   * TOTP verifiers commonly accept one earlier step.
   */
  readonly expiresAt?: number;
};

/** A registered value found in a text: the span it covers and its secrets. */
export type RedactionMatch = {
  /** Index of the first character of the match. */
  readonly start: number;
  /** Index after the last character of the match. */
  readonly end: number;
  /** Sorted. Overlapping matches of several secrets merge into one span. */
  readonly secretIds: readonly string[];
};

/**
 * Shortest value, counted in letters and digits, that also matches loosely.
 * Shorter values (a CVC, an expiry, a PIN) would match unrelated text.
 */
export const LOOSE_MATCH_MIN_LENGTH = 8;

/** Most separator characters allowed between two kept characters of a loose match. */
const MAX_GAP = 3;

const ALNUM = /[\p{L}\p{N}]/u;
const DIGIT = /\p{Nd}/u;
const PERCENT_ESCAPE = /^%[0-9a-f]{2}$/i;
const HTML_REFERENCE =
  /&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|(?:nbsp|ensp|emsp|thinsp|shy|ndash|mdash|hyphen|minus|period|comma|colon|sol|lowbar|amp|lt|gt|quot|apos));/iy;

type Normalized = {
  /** The kept characters, folded. */
  readonly text: string;
  /** For each kept character, where its source code point starts in the input. */
  readonly starts: number[];
  /** For each kept character, where its source code point ends in the input. */
  readonly ends: number[];
  /** For each kept character, how many characters were dropped just before it. */
  readonly gaps: number[];
};

/**
 * Keeps only the characters matching `keep`, NFKC-normalized and case
 * folded, with decimal digits read as 0-9, one code point, percent escape,
 * or HTML character reference at a time, and records where each kept
 * character came from.
 */
function normalize(text: string, keep: RegExp): Normalized {
  let out = "";
  const starts: number[] = [];
  const ends: number[] = [];
  const gaps: number[] = [];
  let gap = 0;
  let i = 0;
  while (i < text.length) {
    let unit = String.fromCodePoint(text.codePointAt(i)!);
    let width = unit.length;
    const escape = text.slice(i, i + 3);
    if (PERCENT_ESCAPE.test(escape)) {
      const byte = parseInt(escape.slice(1), 16);
      // Multi-byte UTF-8 escapes stay separators: formatters emit ASCII.
      unit = byte < 0x80 ? String.fromCharCode(byte) : "%";
      width = 3;
    } else if (text[i] === "&") {
      HTML_REFERENCE.lastIndex = i;
      const ref = HTML_REFERENCE.exec(text);
      if (ref) {
        const cp = ref[1] ? parseInt(ref[1], 10) : parseInt(ref[2] ?? "", 16);
        unit = cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "&";
        width = ref[0].length;
      }
    }
    for (const ch of unit.normalize("NFKC").toLowerCase()) {
      if (!keep.test(ch)) {
        gap++;
        continue;
      }
      out += DIGIT.test(ch) ? digitValue(ch) : ch;
      starts.push(i);
      ends.push(i + width);
      gaps.push(gap);
      gap = 0;
    }
    i += width;
  }
  return { text: out, starts, ends, gaps };
}

/**
 * The 0-9 value of a decimal digit in any script. Unicode lays each
 * script's digits out as a contiguous run starting at zero.
 */
function digitValue(ch: string): string {
  if (ch >= "0" && ch <= "9") return ch;
  let cp = ch.codePointAt(0)!;
  let n = 0;
  while (DIGIT.test(String.fromCodePoint(cp - 1))) {
    cp--;
    n++;
  }
  return String(n % 10);
}

/** Whether no gap between kept characters `first`..`last` exceeds MAX_GAP. */
function withinGap(gaps: number[], first: number, last: number): boolean {
  for (let k = first + 1; k <= last; k++) {
    if (gaps[k]! > MAX_GAP) return false;
  }
  return true;
}

/** The loose form of a value: its letters and digits, folded. */
const looseForm = (value: string): string => normalize(value, ALNUM).text;

type Pattern = {
  readonly value: string;
  readonly secretIds: readonly string[];
};

type LoosePattern = {
  readonly form: string;
  /** Which characters of a text take part in the comparison. */
  readonly keep: RegExp;
  readonly secretIds: readonly string[];
};

/** The scan list, compiled once per registry change and shared by a batch. */
type Compiled = {
  /** Longest first. */
  readonly patterns: readonly Pattern[];
  readonly byValue: ReadonlyMap<string, Pattern>;
  /** One alternation over all patterns; used when there are many. */
  readonly regex: RegExp | undefined;
  readonly loose: readonly LoosePattern[];
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
  loose: [],
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
  return {
    patterns,
    byValue: new Map(patterns.map((p) => [p.value, p])),
    // Longest first, so at any position the alternation takes the longest
    // registered value that starts there.
    regex:
      patterns.length > REGEX_THRESHOLD
        ? new RegExp(patterns.map((p) => escapeRegExp(p.value)).join("|"), "g")
        : undefined,
    loose: [...looseValues.entries()].map(([form, ids]) => ({
      form,
      // A value made only of digits compares on digits only, so letters
      // between its groups count as separators too.
      keep: /^[0-9]*$/.test(form) ? DIGIT : ALNUM,
      secretIds: [...ids].sort(),
    })),
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
  /** secret ID -> registered value -> expiry (Infinity for none). */
  #expiry = new Map<string, Map<string, number>>();
  /** Earliest finite expiry, or Infinity. */
  #nextExpiry = Infinity;
  #now: () => number;
  /** Compiled scan list, rebuilt lazily after a change. */
  #compiled: Compiled | undefined;

  constructor(options: RedactionRegistryOptions = {}) {
    this.#encodedVariants = options.encodedVariants ?? true;
    this.#minValueLength = options.minValueLength ?? DEFAULT_MIN_VALUE_LENGTH;
    this.#marker = options.marker ?? defaultMarker;
    this.#now = options.now ?? Date.now;
  }

  /**
   * Registers a live plaintext. Call it as soon as the value exists in
   * memory. Returns false when the value is shorter than `minValueLength`
   * and so is not text-scanned.
   */
  registerValue(
    value: string,
    secretId: string,
    options: { readonly expiresAt?: number } = {},
  ): boolean {
    return this.registerValues([{ value, secretId, ...options }]).length === 0;
  }

  /**
   * Registers several plaintexts with one rebuild of the scan list. Returns
   * the IDs of secrets with a non-empty value shorter than `minValueLength`,
   * which are not text-scanned. Hosts should keep such values out of
   * agent-visible text paths by other means.
   */
  registerValues(entries: readonly RedactionValue[]): string[] {
    return this.#register(entries, this.#now());
  }

  /** `registerValues` at a given clock reading, so `#sweep` can pass its own. */
  #register(entries: readonly RedactionValue[], now: number): string[] {
    const skipped = new Set<string>();
    for (const { value, secretId, expiresAt: rawExpiry } of entries) {
      if (typeof value !== "string" || value.length === 0) continue;
      if (value.length < this.#minValueLength) {
        skipped.add(secretId);
        continue;
      }
      // An invalid or past expiry fails closed: the value never expires.
      const expiresAt =
        typeof rawExpiry === "number" && rawExpiry > now ? rawExpiry : Infinity;
      let byValue = this.#expiry.get(secretId);
      if (!byValue) this.#expiry.set(secretId, (byValue = new Map()));
      byValue.set(value, Math.max(byValue.get(value) ?? 0, expiresAt));
      this.#nextExpiry = Math.min(this.#nextExpiry, expiresAt);
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
    // The scan folds one code point at a time, so a decomposed copy of the
    // value (NFD) has its own loose form.
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
    this.#releaseValues(secretId);
    this.#expiry.delete(secretId);
    for (const [key, ids] of this.#targets) {
      ids.delete(secretId);
      if (ids.size === 0) this.#targets.delete(key);
    }
    for (const [doc, keys] of this.#targetsByDocument) {
      for (const key of keys) if (!this.#targets.has(key)) keys.delete(key);
      if (keys.size === 0) this.#targetsByDocument.delete(doc);
    }
  }

  #releaseValues(secretId: string): void {
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
    this.#compiled = undefined;
  }

  /**
   * Drops expired values. A secret with an expired value is released and
   * its live values are registered again, so a form it shares with a live
   * value keeps matching. Target tags do not expire.
   */
  #sweep(): void {
    const now = this.#now();
    if (now < this.#nextExpiry) return;
    this.#nextExpiry = Infinity;
    for (const [secretId, byValue] of [...this.#expiry]) {
      const live = [...byValue].filter(([, at]) => at > now);
      if (live.length === byValue.size) {
        for (const [, at] of live) {
          this.#nextExpiry = Math.min(this.#nextExpiry, at);
        }
        continue;
      }
      this.#releaseValues(secretId);
      this.#expiry.delete(secretId);
      // The same `now` as the filter above. A second clock read could pass
      // a live expiry, which would then count as no expiry at all.
      this.#register(
        live.map(([value, expiresAt]) => ({ value, secretId, expiresAt })),
        now,
      );
    }
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
    this.#expiry.clear();
    this.#nextExpiry = Infinity;
    this.#compiled = undefined;
  }

  /** Number of distinct exact scan strings, including encoded forms. */
  get valueCount(): number {
    this.#sweep();
    return this.#values.size;
  }

  get targetCount(): number {
    return this.#targets.size;
  }

  #patterns(): Compiled {
    this.#sweep();
    return (this.#compiled ??= compile(this.#values, this.#looseValues));
  }

  /**
   * Every registered value in `text`, in any form `scrubText` matches, as
   * sorted spans with overlapping matches merged. Snapshot serializers use
   * it to elide a value the page split over several elements: join the
   * element values, and elide every element a span touches.
   */
  findMatches(text: string): RedactionMatch[] {
    return mergeMatches(collectMatches(this.#patterns(), text));
  }

  /**
   * The secrets with a registered value in `text`, sorted. Empty when there
   * are none. Snapshot serializers use it to elide elements that hold a
   * copy of a secret, such as a field the page re-rendered or an order
   * summary, as they elide registered targets.
   */
  findSecretIds(text: string): string[] {
    const ids = new Set(this.findMatches(text).flatMap((m) => m.secretIds));
    return [...ids].sort();
  }

  /**
   * Replaces every occurrence of a registered value in `text`. Overlapping
   * or nested matches, including matches of different secrets, merge into
   * one replacement, so no fragment of a secret survives next to a marker.
   */
  scrubText(text: string): string {
    return scrubWith(this.#patterns(), this.#marker, text);
  }

  /**
   * Scrubs a JSON-like value: strings, and the keys and values of arrays,
   * plain objects, `Map`s, and `Set`s, recursively. The input is not
   * changed. Returns a new value, except when nothing is registered: then it
   * returns `value` itself, so copy it before changing the result.
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
  // merge later instead of leaving a fragment.
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
  // Loose matches: compare the kept characters of the text with each form
  // and map every hit back to the span of the original text it came from.
  const normalized = new Map<RegExp, Normalized>();
  for (const { form, keep, secretIds } of compiled.loose) {
    let hay = normalized.get(keep);
    if (!hay) normalized.set(keep, (hay = normalize(text, keep)));
    for (let at = hay.text.indexOf(form); at !== -1; ) {
      const last = at + form.length - 1;
      if (withinGap(hay.gaps, at, last)) {
        (starts ??= []).push(hay.starts[at]!);
        ends.push(hay.ends[last]!);
        owners.push(secretIds);
        sorted = false;
      }
      at = hay.text.indexOf(form, at + 1);
    }
  }
  return starts ? { starts, ends, owners, sorted } : undefined;
}

/** Sorts the intervals and merges every overlap into one span. */
function mergeMatches(matches: Matches | undefined): RedactionMatch[] {
  if (!matches) return [];
  const { starts, ends, owners, sorted } = matches;
  const order = starts.map((_, i) => i);
  if (!sorted) order.sort((a, b) => starts[a]! - starts[b]!);
  const spans: { start: number; end: number; ids: Set<string> }[] = [];
  for (const k of order) {
    const last = spans[spans.length - 1];
    if (last && starts[k]! < last.end) {
      if (ends[k]! > last.end) last.end = ends[k]!;
      for (const id of owners[k]!) last.ids.add(id);
    } else {
      spans.push({ start: starts[k]!, end: ends[k]!, ids: new Set(owners[k]) });
    }
  }
  return spans.map((s) =>
    Object.freeze({
      start: s.start,
      end: s.end,
      secretIds: Object.freeze([...s.ids].sort()),
    }),
  );
}

function scrubWith(
  compiled: Compiled,
  marker: (secretIds: readonly string[]) => string,
  text: string,
): string {
  const spans = mergeMatches(collectMatches(compiled, text));
  if (spans.length === 0) return text;
  const parts: string[] = [];
  let cursor = 0;
  for (const span of spans) {
    parts.push(text.slice(cursor, span.start), marker(span.secretIds));
    cursor = span.end;
  }
  parts.push(text.slice(cursor));
  return parts.join("");
}
