const { mkdirSync, readFileSync, writeFileSync } = require("fs");

const md = {
  esc: (t = "") => String(t).replace(/</g, "&lt;").replace(/>/g, "&gt;"),
};

function extractSummaryText(comment) {
  if (!comment) return "";
  if (Array.isArray(comment.summary) && comment.summary.length) {
    return comment.summary
      .map((p) =>
        p.kind === "code" ? "`" + (p.text || "") + "`" : p.text || "",
      )
      .join("");
  }
  return (comment?.shortText || comment?.text || "").trim();
}

// Basic inline markdown → HTML (works inside <li> and plain paragraphs)
function inlineMdToHtml(s) {
  if (!s) return "";
  return (
    s
      // bold
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      // inline code
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      // links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  );
}

// Turn bullet-y text into HTML lists for JSX children
function formatTextToListMDX(raw) {
  if (!raw) return "";
  const lines = raw.replace(/\r\n/g, "\n").split("\n");

  const bulletRe = /^\s*[-*•]\s+(.+)/;
  const numRe = /^\s*(\d+)[.)]\s+(.+)/;

  const out = [];
  let paraBuf = [];
  let listBuf = null; // {type:'ul'|'ol', items:[]}

  const flushPara = () => {
    if (!paraBuf.length) return;
    const txt = paraBuf.join(" ").trim();
    const safe = inlineMdToHtml(md.esc(txt));
    out.push(safe);
    paraBuf = [];
  };
  const flushList = () => {
    if (!listBuf || !listBuf.items.length) return;
    const tag = listBuf.type === "ol" ? "ol" : "ul";
    out.push(
      `<${tag}>\n` +
        listBuf.items.map((it) => `  <li>${it}</li>`).join("\n") +
        `\n</${tag}>`,
    );
    listBuf = null;
  };

  for (const line of lines) {
    const b = bulletRe.exec(line);
    if (b) {
      if (!listBuf || listBuf.type !== "ul") {
        flushPara();
        flushList();
        listBuf = { type: "ul", items: [] };
      }
      listBuf.items.push(inlineMdToHtml(md.esc(b[1])));
      continue;
    }
    const n = numRe.exec(line);
    if (n) {
      if (!listBuf || listBuf.type !== "ol") {
        flushPara();
        flushList();
        listBuf = { type: "ol", items: [] };
      }
      listBuf.items.push(inlineMdToHtml(md.esc(n[2])));
      continue;
    }
    // blank line
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    if (listBuf) {
      flushList();
    }
    paraBuf.push(line.trim());
  }
  flushPara();
  flushList();
  return out.join("\n\n");
}

function formatCommentToMDX(comment) {
  return formatTextToListMDX(extractSummaryText(comment));
}

// Plain, YAML-safe frontmatter description (single line, no HTML/markdown)
function toFrontmatterDescription({ primary, fallback }) {
  const raw = (primary || fallback || "")
    // drop list markers and newlines
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\r?\n+/g, " ")
    // strip inline markdown markers (keep words)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .trim();
  // keep it concise
  const oneLine = raw.replace(/\s+/g, " ").slice(0, 200);
  // JSON.stringify gives us properly quoted YAML-safe text
  return JSON.stringify(oneLine);
}

const toKebab = (s) =>
  String(s)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

function pickSummary(comment) {
  if (!comment) return "";
  if (Array.isArray(comment.summary)) {
    return comment.summary
      .map((p) => p.text || "")
      .join("")
      .trim();
  }
  return (comment.shortText || comment.text || "").trim();
}

function extractSummaryText(comment) {
  if (!comment) return "";
  if (Array.isArray(comment.summary) && comment.summary.length) {
    return comment.summary
      .map((p) => {
        // handle TypeDoc "text" / "code" chunks
        if (p.kind === "code") return "`" + (p.text || "") + "`";
        return p.text || "";
      })
      .join("");
  }
  return (comment.shortText || comment.text || "").trim();
}

// Convert any bullet-y text into HTML lists that render inside JSX.
// Supports "-", "*", "•" and "1." style lists. Keeps a leading paragraph if present.
function formatTextToListMDX(raw) {
  if (!raw) return "";
  const lines = raw.replace(/\r\n/g, "\n").split("\n");

  const bulletRe = /^\s*[-*•]\s+(.+)/;
  const numRe = /^\s*(\d+)[.)]\s+(.+)/;

  const out = [];
  let paraBuf = [];
  let listBuf = null; // {type: 'ul'|'ol', items: []}

  const flushPara = () => {
    if (!paraBuf.length) return;
    // Don’t wrap in <p> to avoid double <p> if your components add one;
    // plain text works fine.
    out.push(md.esc(paraBuf.join(" ").trim()));
    paraBuf = [];
  };

  const flushList = () => {
    if (!listBuf || !listBuf.items.length) return;
    const tag = listBuf.type === "ol" ? "ol" : "ul";
    out.push(
      `<${tag}>\n` +
        listBuf.items.map((it) => `  <li>${md.esc(it)}</li>`).join("\n") +
        `\n</${tag}>`,
    );
    listBuf = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      // blank line: separate blocks
      flushPara();
      flushList();
      continue;
    }

    const b = bulletRe.exec(line);
    if (b) {
      // start/continue UL
      if (!listBuf || listBuf.type !== "ul") {
        flushPara();
        flushList();
        listBuf = { type: "ul", items: [] };
      }
      listBuf.items.push(b[1]);
      continue;
    }

    const n = numRe.exec(line);
    if (n) {
      // start/continue OL
      if (!listBuf || listBuf.type !== "ol") {
        flushPara();
        flushList();
        listBuf = { type: "ol", items: [] };
      }
      listBuf.items.push(n[2]);
      continue;
    }

    // normal text line
    if (listBuf) {
      // a non-bullet ends current list
      flushList();
    }
    paraBuf.push(trimmed);
  }

  flushPara();
  flushList();

  return out.join("\n\n");
}

function formatCommentToMDX(comment) {
  return formatTextToListMDX(extractSummaryText(comment));
}

function isOptionalParam(p) {
  return !!(p?.flags?.isOptional || p?.flags?.optional);
}

// Core type resolver: stringify + optional “shape” for expansion
function resolveType(t) {
  if (!t) return { text: "unknown", shape: null };

  // Intrinsic: string, number, boolean, void, unknown, any
  if (t.type === "intrinsic") return { text: t.name, shape: null };

  // Literals: 'abc', 123, true, null
  if (t.type === "literal") {
    return {
      text: t.value === null ? "null" : JSON.stringify(t.value),
      shape: null,
    };
  }

  // Arrays
  if (t.type === "array") {
    const inner = resolveType(t.elementType);
    return {
      text: `${inner.text}[]`,
      shape: { kind: "array", element: inner },
    };
  }

  // Tuples
  if (t.type === "tuple") {
    const parts = (t.elements || []).map((e) => resolveType(e).text);
    return { text: `[${parts.join(", ")}]`, shape: null };
  }

  // Unions / Intersections
  if (t.type === "union") {
    const parts = t.types.map((x) => resolveType(x));
    return {
      text: parts.map((p) => p.text).join(" | "),
      shape: { kind: "union", parts },
    };
  }
  if (t.type === "intersection") {
    const parts = t.types.map((x) => resolveType(x));
    return {
      text: parts.map((p) => p.text).join(" & "),
      shape: { kind: "intersection", parts },
    };
  }

  // Inline object/function type
  if (t.type === "reflection") {
    return { text: "object", shape: t.declaration || null };
  }

  // typeof Query
  if (t.type === "query") {
    const inner = resolveType(t.queryType);
    return { text: `typeof ${inner.text}`, shape: null };
  }

  // References: named types, Promise<T>, CryptoKeyPair, etc.
  if (t.type === "reference") {
    const typeArgs = (t.typeArguments || []).map((a) => resolveType(a));
    const txt = typeArgs.length
      ? `${t.name}<${typeArgs.map((a) => a.text).join(", ")}>`
      : t.name;
    // If reference inlines a declaration (rare), use it
    const shape = t.reflection || null;
    return { text: txt, shape, typeArguments: typeArgs, name: t.name };
  }

  // Fallback
  return { text: t.name || "unknown", shape: null };
}

function unwrapPromise(rt) {
  // Accepts a signature.return type 't' and returns { display, innerType(Resolved) }
  const r = resolveType(rt);
  if (
    r.name === "Promise" &&
    Array.isArray(r.typeArguments) &&
    r.typeArguments.length === 1
  ) {
    return {
      display: r.typeArguments[0].text,
      inner: r.typeArguments[0],
    };
  }
  // Also handle stringified Promise<...> just in case
  const match = /^Promise<(.+)>$/.test(r.text);
  if (match && r.typeArguments?.[0]) {
    return { display: r.typeArguments[0].text, inner: r.typeArguments[0] };
  }
  return { display: r.text, inner: r };
}

// Find call signatures inside a type (reflection or unions that contain a function type)
function getCallSignaturesFromType(t) {
  if (!t) return [];
  if (t.type === "reflection" && t.declaration?.signatures?.length) {
    return t.declaration.signatures;
  }
  if (t.type === "union" && Array.isArray(t.types)) {
    return t.types.flatMap((x) => getCallSignaturesFromType(x));
  }
  if (t.type === "reference" && t.reflection?.declaration?.signatures?.length) {
    return t.reflection.declaration.signatures;
  }
  return [];
}

function posixJoin() {
  return path.posix.join(...arguments);
}
function isGroupObject(x) {
  return (
    x &&
    typeof x === "object" &&
    !Array.isArray(x) &&
    "group" in x &&
    "pages" in x
  );
}

function findTab(nav, tabName) {
  return (nav?.tabs || []).find((t) => t?.tab === tabName);
}
function findGroupIn(arr, name) {
  if (!Array.isArray(arr)) return null;
  return arr.find((item) => isGroupObject(item) && item.group === name) || null;
}
function ensureGroupIn(arr, name) {
  let g = findGroupIn(arr, name);
  if (!g) {
    g = { group: name, pages: [] };
    arr.push(g);
  }
  if (!Array.isArray(g.pages)) g.pages = [];
  return g;
}
function addPagesDedup(targetPagesArray, pagesToAdd) {
  const existing = new Set(
    targetPagesArray.filter((p) => typeof p === "string"),
  );
  for (const p of pagesToAdd) {
    if (!existing.has(p)) {
      targetPagesArray.push(p);
      existing.add(p);
    }
  }
}

// “@turnkey/http” -> “http”;  “react-wallet-kit” -> “react-wallet-kit”
function unscopedFolder(pkgName) {
  return String(pkgName).replace(/^@[^/]+\//, "");
}

// “react-native-passkey-stamper” -> “React Native Passkey Stamper”
function humanTitleFromPkg(pkgName) {
  const base = unscopedFolder(pkgName).replace(/[-_]+/g, " ").trim();

  // Title-case each word, but leave existing ALLCAPS alone (e.g., HTTP)
  const titleCased = base
    .split(/\s+/)
    .map((w) =>
      /^[A-Z0-9]{2,}$/.test(w) ? w : w.replace(/^\w/, (c) => c.toUpperCase()),
    )
    .join(" ");

  // Force-capitalize SDK / SDKs regardless of how it appeared
  return titleCased.replace(/\bSdk\b/g, "SDK").replace(/\bSdks\b/g, "SDKs");
}

// Force-case for specific doc words
function normalizeDocCase(s = "") {
  return s
    .replace(/\breadme\b/gi, "readme")
    .replace(/\bchangelog\b/gi, "changelog");
}

// Flatten TypeDoc “document.content” array into markdown
function flattenDocContent(contentArray = []) {
  const flat = contentArray
    .map((chunk) => {
      if (!chunk) return "";
      switch (chunk.kind) {
        case "text":
        case "code":
        case "relative-link":
          return chunk.text || "";
        default:
          return chunk.text || "";
      }
    })
    .join("");

  return normalizeDocCase(flat);
}

module.exports = {
  extractSummaryText,
  inlineMdToHtml,
  formatTextToListMDX,
  flattenDocContent,
  formatCommentToMDX,
  toFrontmatterDescription,
  toKebab,
  pickSummary,
  isOptionalParam,
  resolveType,
  unwrapPromise,
  getCallSignaturesFromType,
  posixJoin,
  isGroupObject,
  findTab,
  findGroupIn,
  ensureGroupIn,
  addPagesDedup,
  unscopedFolder,
  humanTitleFromPkg,
  md,
};
