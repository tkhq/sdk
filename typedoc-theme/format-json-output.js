#!/usr/bin/env node
/**
 * Monorepo TypeDoc JSON -> Mintlify MDX generator (packages -> methods/functions)
 *
 * Usage:
 *   typedoc --json sdks.json --entryPoints <all your packages or tsconfigs>
 *   node scripts/typedoc-to-mintlify-mono.js --in sdks.json --out docs/sdk
 */
const {
  md,
  unwrapPromise,
  resolveType,
  getCallSignaturesFromType,
  toKebab,
  pickSummary,
  isOptionalParam,
  formatCommentToMDX,
  findTab,
  ensureGroupIn,
  addPagesDedup,
  flattenDocContent,
  humanTitleFromPkg,
  unscopedFolder,
} = require("./utils");

const SDK_DOCS_INDEX_PATH = "generated-docs/sdk-docs.json";
const DOCS_INDEX_PATH = "generated-docs/docs.json";
const CHANGELOG_ROOT = "generated-docs/changelogs";

const { mkdirSync, readFileSync, writeFileSync } = require("fs");
const { join, posix: posixPath } = require("path");

// ---------- args ----------
function parseMulti(argv) {
  const out = {};
  let key = null;
  for (const tok of argv) {
    if (tok.startsWith("--")) {
      // support --flag=value too
      const [flag, firstVal] = tok.split("=", 2);
      key = flag;
      if (!out[key]) out[key] = [];
      if (firstVal) out[key].push(firstVal);
    } else if (key) {
      out[key].push(tok);
    } else {
      (out._ ??= []).push(tok); // positional args (unused)
    }
  }
  return out;
}

// Track changelog pages for an optional index file
const changelogPages = []; // { package: string, page: string }

const argv = process.argv.slice(2);
const args = parseMulti(argv);

// Support comma-separated input too: --packages=a,b,c
const PACKAGES_TO_SYNC = (args["--packages"] ?? [])
  .flatMap((v) => v.split(","))
  .map((s) => s.trim())
  .filter(Boolean);

const GROUPS_TO_SYNC = (args["--groups"] ?? [])
  .flatMap((v) => v.split(","))
  .map((s) => s.trim())
  .filter(Boolean);

if (PACKAGES_TO_SYNC.length === 0 || GROUPS_TO_SYNC.length === 0) {
  console.error(
    'Usage: node format-json-output.js --packages react-wallet-kit core --groups "React" "TypeScript | Frontend"'
  );
  process.exit(1);
}

// Optional: if a single group is provided, apply it to all packages
const groupsNormalized =
  GROUPS_TO_SYNC.length === 1
    ? Array(PACKAGES_TO_SYNC.length).fill(GROUPS_TO_SYNC[0])
    : GROUPS_TO_SYNC;

// Optional safety: warn if lengths differ
if (groupsNormalized.length !== PACKAGES_TO_SYNC.length) {
  console.warn(
    `[warn] --packages (${PACKAGES_TO_SYNC.length}) and --groups (${groupsNormalized.length}) differ. ` +
      `Extra items will be ignored/last group reused.`
  );
}

const INPUT = "generated-docs/sdks.json";
const OUTDIR = "generated-docs/formatted";

const MDX_IMPORTS = `
import { H3Bordered } from "/snippets/h3-bordered.mdx";
import { NestedParam } from "/snippets/nested-param.mdx";
`;

const KINDS = {
  Project: 1,
  Module: 2,
  Namespace: 4,
  Enum: 8,
  EnumMember: 16,
  Variable: 32,
  Function: 64,
  Class: 128,
  Interface: 256,
  Constructor: 512,
  Property: 1024,
  PropertySignature: 1024,
  Method: 2048,
  CallSignature: 4096,
  IndexSignature: 8192,
  ConstructorSignature: 16384,
  Parameter: 32768,
  TypeLiteral: 65536,
};

function writeChangelogForPackage(pkgNode) {
  const pkgName = pkgNode.name || "package";
  const doc = (pkgNode.documents || []).find(
    (d) => String(d.name || "").toLowerCase() === "changelog"
  );
  if (!doc) return; // nothing to do

  const title = humanTitleFromPkg(pkgName);
  const body = flattenDocContent(doc.content || []);

  const frontmatter = `---\ntitle: "${md.esc(title)}"\nmode: wide\n---\n\n`;

  // Destination: generated-docs/changelogs/<unscoped-pkg>/{index,readme}.mdx
  const folder = unscopedFolder(pkgName);
  const outDir = join(CHANGELOG_ROOT, folder);
  ensureDir(outDir);

  const mdx = frontmatter + body;
  writeFileSync(join(outDir, "readme.mdx"), mdx, "utf8"); // alias for existing nav patterns

  // For convenience when merging into nav later
  const route = `${CHANGELOG_ROOT}/${folder}`; // without extension
  changelogPages.push({ package: pkgName, page: route });

  console.log(`✓ Wrote changelog for ${pkgName} → ${route}`);
}

// Track pages per package
const groupPages = new Map(); // pkgName -> Set<string>

function pkgFolderSegment(pkgName) {
  // mirrors your pkgDir() logic
  const safe = pkgName.replace(/^@/, "").replace(/\//g, "__");
  return pkgName.startsWith("@") ? `@${safe}` : safe;
}

function addPage(pkgName, filename) {
  // Build a POSIX-style path without .mdx extension
  const page = posixPath.join(
    OUTDIR,
    pkgFolderSegment(pkgName),
    filename.replace(/\.mdx$/i, "")
  );
  if (!groupPages.has(pkgName)) groupPages.set(pkgName, new Set());
  groupPages.get(pkgName).add(page);
}

function renderNestedParams({ parentKey, declaration }) {
  if (!declaration) return "";
  const props = (declaration.children || []).filter(
    (c) =>
      c.kind === KINDS.Property ||
      c.kind === KINDS.PropertySignature ||
      c.kind === KINDS.Parameter
  );
  if (!props.length) return "";

  let out = "";
  for (const p of props) {
    const { text: typeText, shape } = resolveType(p.type);
    const requiredAttr = isOptionalParam(p)
      ? " required={false}"
      : " required={true}";
    const desc = pickSummary(p.comment);
    const childKey = p.name;

    out += `    <NestedParam parentKey="${md.esc(parentKey)}" childKey="${md.esc(childKey)}" type='${md.esc(
      typeText
    )}'${requiredAttr}>${desc ? `\n${md.esc(desc)}\n` : ""}</NestedParam>\n`;

    // Expand if nested object-ish with known declaration
    const subDecl = shape?.declaration || shape;
    if (subDecl?.children?.length) {
      out += `    <Expandable title="${md.esc(childKey)} details">\n`;
      out += renderNestedParams({
        parentKey: `${parentKey}.${childKey}`,
        declaration: subDecl,
      });
      out += `    </Expandable>\n`;
    }
  }
  return out;
}

function renderParamFieldFromParam(param) {
  const name = param.name || "param";
  const { text: typeText, shape } = resolveType(param.type);
  const requiredAttr = isOptionalParam(param)
    ? " required={false}"
    : " required={true}";
  const desc = pickSummary(param.comment);
  const decl = shape?.declaration || shape;
  let s = `<ParamField body="${md.esc(name)}" type='${md.esc(typeText)}'${requiredAttr}${
    typeText === "object" ? ` path="${md.esc(name)}"` : ""
  } ${desc.trim() || decl?.children?.length ? "" : "/"}>\n`;

  if (desc) s += `  ${md.esc(desc)}\n`;

  if (decl?.children?.length) {
    s += `  <Expandable title="${md.esc(name)} details">\n`;
    s += renderNestedParams({ parentKey: name, declaration: decl });
    s += `  </Expandable>\n`;
  }
  if (desc.trim() || decl?.children?.length) {
    s += `</ParamField>\n`;
  }
  return s;
}

function renderResponseFromSignature(signature) {
  const ret = signature.type;
  if (!ret) return "";

  const { display, inner } = unwrapPromise(ret);
  let out = `<H3Bordered text="Response" />\nA successful response returns the following fields:\n\n`;
  out += `<ResponseField name="returns" type="${md.esc(display)}" required={true}>\n`;

  const returnsText =
    (signature.comment?.blockTags || [])
      .filter((t) => t.tag === "@returns")
      .map((t) =>
        Array.isArray(t.content)
          ? t.content.map((p) => p.text || "").join("")
          : t.text || ""
      )
      .join("")
      .trim() || pickSummary(signature.comment?.returns);
  if (returnsText) out += `  ${md.esc(returnsText)}\n`;

  const decl = inner?.shape?.declaration || inner?.shape;
  if (decl?.children?.length) {
    out += `  <Expandable title="return details">\n`;
    out += renderNestedParams({ parentKey: "returns", declaration: decl });
    out += `  </Expandable>\n`;
  }
  out += `</ResponseField>\n`;
  return out;
}

function renderResponse(signature) {
  const ret = signature.type;
  if (!ret) return "";

  const { display, inner } = unwrapPromise(ret);

  // Returns description (TypeDoc JSON stores this as `comment.blockTags` sometimes; we’ll use .comment.returns if present)
  const returnsText =
    (signature.comment?.blockTags || [])
      .filter((t) => t.tag === "@returns")
      .map((t) =>
        Array.isArray(t.content)
          ? t.content.map((p) => p.text || "").join("")
          : t.text || ""
      )
      .join("")
      .trim() || pickSummary(signature.comment?.returns);

  const decl = inner?.shape?.declaration || inner?.shape;

  let out = `<H3Bordered text="Response" />\nA successful response returns the following fields:\n\n`;
  out += `<ResponseField name="returns" type="${md.esc(display)}" required={true} ${returnsText || decl?.children?.length ? "" : "/"}>\n`;
  if (returnsText) out += `  ${md.esc(returnsText)}\n`;

  if (decl?.children?.length) {
    out += `  <Expandable title="return details">\n`;
    out += renderNestedParams({ parentKey: "returns", declaration: decl });
    out += `  </Expandable>\n`;
  }
  if (returnsText || decl?.children?.length) {
    out += `</ResponseField>\n`;
  }
  return out;
}

function buildMethodMDX({ pkgName, node }) {
  const sig = (node.signatures || [])[0];
  if (!sig) return null;

  const title = `${node.name}()`;
  const descMDX =
    formatCommentToMDX(sig.comment) || formatCommentToMDX(node.comment);
  const definedIn = (node.sources || [])[0];

  const frontmatter = `---\ntitle: "${md.esc(title)}"\n---\n\n`;
  const imports = MDX_IMPORTS.trim() + "\n\n";

  let pkgBadge = `<p><strong>Package:</strong> <code>${md.esc(pkgName)}</code></p>\n\n`;
  if (definedIn?.url) {
    pkgBadge += `<p><strong>Defined in:</strong> <a href="${definedIn.url}">${md.esc(definedIn.fileName)}:${definedIn.line}</a></p>\n\n`;
  }

  const overview = descMDX
    ? `<H3Bordered text="Overview" />\n\n${descMDX}\n\n`
    : "";

  // Params
  let paramsBlock = "";
  const params = sig.parameters || [];
  paramsBlock += `<H3Bordered text="Parameters" />\n\n`;
  if (params.length) {
    params.forEach((p) => (paramsBlock += renderParamFieldFromParam(p) + "\n"));
  } else {
    paramsBlock += `<p>No parameters.</p>\n\n`;
  }

  const responseBlock =
    renderResponse(sig) ||
    `<H3Bordered text="Response" />\n<p>No response documented.</p>\n`;

  return (
    frontmatter + imports + overview + pkgBadge + paramsBlock + responseBlock
  );
}

function buildCallablePropMDX({ pkgName, propNode, signature }) {
  const title = `${propNode.name}()`;
  const descMDX =
    formatCommentToMDX(propNode.comment) ||
    formatCommentToMDX(signature.comment);

  const definedIn = (propNode.sources || [])[0];

  const frontmatter = `---\ntitle: "${md.esc(title)}"\n---\n\n`;
  const imports = MDX_IMPORTS.trim() + "\n\n";

  let meta = `<p><strong>Package:</strong> <code>${md.esc(pkgName)}</code></p>\n\n`;
  if (definedIn?.url) {
    meta += `<p><strong>Defined in:</strong> <a href="${definedIn.url}">${md.esc(definedIn.fileName)}:${definedIn.line}</a></p>\n\n`;
  }

  const overview = descMDX
    ? `<H3Bordered text="Overview" />\n\n${descMDX}\n\n`
    : "";

  let paramsBlock = `<H3Bordered text="Parameters" />\n\n`;
  const params = signature.parameters || [];
  if (params.length) {
    params.forEach((p) => (paramsBlock += renderParamFieldFromParam(p) + "\n"));
  } else {
    paramsBlock += `<p>No parameters.</p>\n\n`;
  }

  const responseBlock =
    renderResponseFromSignature(signature) ||
    `<H3Bordered text="Response" />\n<p>No response documented.</p>\n`;
  return frontmatter + imports + meta + overview + paramsBlock + responseBlock;
}

// ---- traversal -------------------------------------------------------------

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

function pkgDir(base, pkgName) {
  // keep scoped package folder structure readable
  const safe = pkgName.replace(/^@/, "").replace(/\//g, "__");
  return join(base, pkgName.startsWith("@") ? `@${safe}` : safe);
}

const json = JSON.parse(readFileSync(INPUT, "utf8"));
ensureDir(OUTDIR);

let generated = 0;

function walkPackage(pkgNode) {
  const pkgName = pkgNode.name || "package";
  const outForPkg = pkgDir(OUTDIR, pkgName);
  ensureDir(outForPkg);

  writeChangelogForPackage(pkgNode);

  if (!PACKAGES_TO_SYNC.includes(pkgNode.name)) return;

  function visit(node, ctx = {}) {
    // Classes: emit method pages
    if (node.kind === KINDS.Class) {
      const className = node.name;
      for (const child of node.children || []) {
        if (
          (child.kind === KINDS.Method || child.kind === KINDS.Constructor) &&
          child.signatures?.length
        ) {
          const mdx = buildMethodMDX({ pkgName, className, node: child });
          if (!mdx) continue;
          const filename =
            child.kind === KINDS.Constructor
              ? `${toKebab(className)}-constructor.mdx`
              : `${toKebab(className)}-${toKebab(child.name)}.mdx`;
          writeFileSync(join(outForPkg, filename), mdx, "utf8");
          addPage(pkgName, filename);
          generated++;
        }
      }
    }

    // Top-level functions
    if (node.kind === KINDS.Function && node.signatures?.length) {
      const mdx = buildMethodMDX({ pkgName, className: "", node });
      if (mdx) {
        const filename = `${toKebab(node.name)}.mdx`;
        writeFileSync(join(outForPkg, filename), mdx, "utf8");
        addPage(pkgName, filename);
        generated++;
      }
    }

    if (node.kind === KINDS.Interface) {
      const interfaceName = node.name;
      for (const prop of node.children || []) {
        if (
          prop.kind === KINDS.Property ||
          prop.kind === KINDS.PropertySignature
        ) {
          const sigs = getCallSignaturesFromType(prop.type);
          for (const sig of sigs) {
            const mdx = buildCallablePropMDX({
              pkgName,
              interfaceName,
              propNode: prop,
              signature: sig,
            });
            const filename = `${toKebab(interfaceName)}-${toKebab(prop.name)}.mdx`;
            writeFileSync(join(outForPkg, filename), mdx, "utf8");
            addPage(pkgName, filename);
            generated++;
          }
        }
      }
    }

    // Recurse
    for (const c of node.children || []) visit(c, ctx);
  }

  visit(pkgNode);
}

// Top-level children are packages/modules in your monorepo JSON
for (const child of json.children || []) {
  if (child.kind === KINDS.Module) {
    walkPackage(child);
  }
}

console.log(`✓ Generated ${generated} MDX file(s) in ${OUTDIR}`);

// Build a stable, sorted docs index
const docsIndex = Array.from(groupPages.entries())
  .map(([group, pagesSet]) => ({
    group,
    pages: Array.from(pagesSet).sort(),
  }))
  .sort((a, b) => a.group.localeCompare(b.group));

writeFileSync(SDK_DOCS_INDEX_PATH, JSON.stringify(docsIndex, null, 2), "utf8");
console.log(`✓ Wrote docs index: ${SDK_DOCS_INDEX_PATH}`);

// Merge the sdk-doc with the doc repo's docs.json
// ---------- load data ----------
const index = JSON.parse(readFileSync(SDK_DOCS_INDEX_PATH, "utf8"));
const pkgToPages = new Map(
  index.map((entry) => [entry.group, entry.pages || []])
);
const docs = JSON.parse(readFileSync(DOCS_INDEX_PATH, "utf8"));

// ---------- locate SDK reference bucket ----------
const sdkTab = findTab(docs.navigation, "SDK reference");
if (!sdkTab) {
  console.error('Could not find tab "SDK reference" in docs.json');
  process.exit(1);
}
if (!Array.isArray(sdkTab.groups)) sdkTab.groups = [];
const topSdkRefGroup = ensureGroupIn(sdkTab.groups, "SDK reference"); // the big group inside the tab

// ---------- merge per package ----------
const summary = [];
for (let i = 0; i < PACKAGES_TO_SYNC.length; i++) {
  const pkg = PACKAGES_TO_SYNC[i];
  const displayGroup = GROUPS_TO_SYNC[i];
  const pages = pkgToPages.get(pkg);

  if (!pages || pages.length === 0) {
    console.warn(`[warn] No pages found in index for package "${pkg}"`);
    continue;
  }

  // Find the top-level group (e.g., "React", "TypeScript | Frontend") inside the big SDK reference group
  const productGroup = ensureGroupIn(topSdkRefGroup.pages, displayGroup);

  // Inside that, find or create the nested "SDK reference" group
  const nestedSdkRef = ensureGroupIn(productGroup.pages, "SDK reference");

  addPagesDedup(nestedSdkRef.pages, pages);
  summary.push({ pkg, group: displayGroup, added: pages.length });
}

// ---------- inject changelog readmes into "Changelogs" tab ----------
{
  // Turn collected routes like "generated-docs/changelogs/<pkg>" into "changelogs/<pkg>/readme"
  const changelogRoutes = Array.from(
    new Set(
      changelogPages.map(
        (e) =>
          // strip "generated-docs/" and append "/readme"
          e.page.replace(/^generated-docs\//, "") + "/readme"
      )
    )
  ).sort((a, b) => a.localeCompare(b));

  if (changelogRoutes.length === 0) {
    console.warn(
      "[warn] No CHANGELOG readmes discovered; skipping changelog injection."
    );
  } else {
    const changelogsTab = findTab(docs.navigation, "Changelogs");
    if (!changelogsTab) {
      console.warn(
        'Could not find tab "Changelogs" in docs.json; skipping changelog injection.'
      );
    } else {
      changelogsTab.pages ||= [];
      // Ensure "Changelogs" group inside the tab
      const topChangelogsGroup = ensureGroupIn(
        changelogsTab.pages,
        "Changelogs"
      );
      // Ensure nested "SDK changelogs" group
      const sdkChangelogsGroup = ensureGroupIn(
        topChangelogsGroup.pages,
        "SDK changelogs"
      );
      // Add all discovered readmes, deduped
      addPagesDedup(sdkChangelogsGroup.pages, changelogRoutes);
      console.log(
        ` + Injected ${changelogRoutes.length} changelog readme(s) into Changelogs → SDK changelogs`
      );
    }
  }
}

// ---------- write result ----------
writeFileSync(DOCS_INDEX_PATH, JSON.stringify(docs, null, 2), "utf8");

// ---------- log ----------
console.log(`Updated `);
for (const row of summary) {
  console.log(` - ${row.pkg} -> ${row.group} (+${row.added} pages)`);
}
