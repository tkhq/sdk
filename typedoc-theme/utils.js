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

function pickSummaryFromHighlightedProperties(comments) {
  if (!comments || !Array.isArray(comments)) return "";
  if (Array.isArray(comments)) {
    return comments
      .map((c) => c.text || "")
      .join("")
      .trim();
  }
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
  getCallSignaturesFromType,
  posixJoin,
  isGroupObject,
  findTab,
  findGroupIn,
  ensureGroupIn,
  addPagesDedup,
  unscopedFolder,
  humanTitleFromPkg,
  pickSummaryFromHighlightedProperties,
  md,
};
