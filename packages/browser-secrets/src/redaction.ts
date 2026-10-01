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
 * live previews, or transformed copies of a secret. JS strings cannot be
 * zeroized: `releaseSecret` and `clear` drop references only.
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
   * Also register the JSON-string-escaped and URL-encoded forms of each value
   * when they differ from it. Default: true.
   */
  encodedVariants?: boolean;
  /** Builds the replacement text. Default: `[REDACTED:<secretId>]`. */
  marker?: (secretIds: readonly string[]) => string;
};

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
};

/**
 * Below this many scan strings, one native `indexOf` pass per string is
 * fastest. Above it, a single regex alternation scans the text once.
 */
const REGEX_THRESHOLD = 8;

const EMPTY: Compiled = { patterns: [], byValue: new Map(), regex: undefined };

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");

function compile(values: ReadonlyMap<string, ReadonlySet<string>>): Compiled {
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

function encodedForms(value: string): string[] {
  const forms = new Set<string>();
  forms.add(JSON.stringify(value).slice(1, -1));
  try {
    const uri = encodeURIComponent(value);
    forms.add(uri);
    forms.add(uri.replace(/%20/g, "+"));
  } catch {
    // Lone surrogates cannot be URI-encoded; the raw value still registers.
  }
  forms.delete(value);
  forms.delete("");
  return [...forms];
}

export class RedactionRegistry {
  #encodedVariants: boolean;
  #marker: (secretIds: readonly string[]) => string;
  /** value -> secret IDs that registered it (raw or encoded form). */
  #values = new Map<string, Set<string>>();
  /** secret ID -> values it registered, for release. */
  #valuesBySecret = new Map<string, Set<string>>();
  /** target key -> secret ID. */
  #targets = new Map<string, string>();
  /** document key -> target keys, for release on document replacement. */
  #targetsByDocument = new Map<string, Set<string>>();
  /** Compiled scan list, rebuilt lazily after a change. */
  #compiled: Compiled | undefined;

  constructor(options: RedactionRegistryOptions = {}) {
    this.#encodedVariants = options.encodedVariants ?? true;
    this.#marker = options.marker ?? defaultMarker;
  }

  /** Registers a live plaintext. Call it as soon as the value exists in memory. */
  registerValue(value: string, secretId: string): void {
    this.registerValues([{ value, secretId }]);
  }

  /** Registers several plaintexts with one rebuild of the scan list. */
  registerValues(
    entries: readonly { readonly value: string; readonly secretId: string }[],
  ): void {
    for (const { value, secretId } of entries) {
      if (typeof value !== "string" || value.length === 0) continue;
      const forms = this.#encodedVariants
        ? [value, ...encodedForms(value)]
        : [value];
      let owned = this.#valuesBySecret.get(secretId);
      if (!owned) this.#valuesBySecret.set(secretId, (owned = new Set()));
      for (const form of forms) {
        let ids = this.#values.get(form);
        if (!ids) this.#values.set(form, (ids = new Set()));
        ids.add(secretId);
        owned.add(form);
      }
    }
    this.#compiled = undefined;
  }

  /** Registers an element that received (or is about to receive) a secret. */
  registerTarget(target: RedactionTarget, secretId: string): void {
    const key = targetKey(target);
    this.#targets.set(key, secretId);
    const doc = documentKey(target);
    let keys = this.#targetsByDocument.get(doc);
    if (!keys) this.#targetsByDocument.set(doc, (keys = new Set()));
    keys.add(key);
  }

  isRegisteredTarget(target: RedactionTarget): boolean {
    return this.#targets.has(targetKey(target));
  }

  /** The secret registered for a target, if any. */
  secretIdForTarget(target: RedactionTarget): string | undefined {
    return this.#targets.get(targetKey(target));
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
    for (const [key, id] of this.#targets) {
      if (id === secretId) this.#targets.delete(key);
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
    this.#targets.clear();
    this.#targetsByDocument.clear();
    this.#compiled = undefined;
  }

  /** Number of distinct scan strings, including encoded forms. */
  get valueCount(): number {
    return this.#values.size;
  }

  get targetCount(): number {
    return this.#targets.size;
  }

  #patterns(): Compiled {
    return (this.#compiled ??= compile(this.#values));
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
   * Scrubs a JSON-like value: strings, and the keys and values of arrays and
   * plain objects, recursively. Returns a new value; the input is not
   * changed. Other objects are copied as plain objects of their own
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
      if (active.has(input)) return "[Circular]";
      active.add(input);
      try {
        if (Array.isArray(input)) return input.map(walk);
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

function scrubWith(
  compiled: Compiled,
  marker: (secretIds: readonly string[]) => string,
  text: string,
): string {
  if (compiled.patterns.length === 0 || text.length === 0) return text;
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
  if (!starts) return text;

  let order: number[] = starts.map((_, i) => i);
  if (!sorted) order = order.sort((a, b) => starts![a]! - starts![b]!);

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
