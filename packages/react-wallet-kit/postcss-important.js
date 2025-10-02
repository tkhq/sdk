// Clone only spacing rules and scope them under `.tk-modal` with !important.
// Leaves original Tailwind utilities untouched (so no global side-effects).
// This is because (for some reason) Safari on iOS 26 and MacOS 26 now forces 0 padding and margin
// when using revert-layer. This seems to be a bug/oversight.
// We fix this by forcing !important on all padding/margin declarations that come from tailwind
// but only scoping it to `.tk-modal`.
//
// Options:
//   prefix: string  — default ":where(.tk-modal)"
//   strict: boolean — default true; only target Tailwind spacing utilities

// Matches Tailwind spacing utilities, including variants and negatives:
// .p-4 .mt-2 .-mt-2 .md\:p-4 .hover\:mt-2 .ps-3 .me-1 .m-[3px] etc.
const TAILWIND_SPACING_SELECTOR_RE =
  /(^|[^\\])\.(?:-)?(?:[\w-]+\\:)*!?-?(?:m|p)(?:[trblxyse])?-\[(?:[^\]]+)\]|(^|[^\\])\.(?:-)?(?:[\w-]+\\:)*!?-?(?:m|p)(?:[trblxyse])?-[\w./]+/;

function isSpacingDecl(decl) {
  const prop = decl.prop.toLowerCase();
  if (
    prop === "margin" ||
    prop === "padding" ||
    prop.startsWith("margin-") ||
    prop.startsWith("padding-")
  ) {
    if (decl.value && decl.value.includes("revert-layer")) return false; // don't fight resets
    return true;
  }
  return false;
}

function prefixSelectors(selector, prefix) {
  // Prefix each comma-separated selector with the parent scope.
  return selector
    .split(",")
    .map((s) => `${prefix} ${s.trim()}`)
    .join(", ");
}

const plugin = (opts = {}) => {
  const prefix = opts.prefix || ":where(.tk-modal)";
  const strict = opts.strict !== false; // default true

  return {
    postcssPlugin: "postcss-tkmodal-spacing-important",
    Once(root) {
      root.walkRules((rule) => {
        // Avoid re-processing already-scoped rules
        if (rule.selector.includes(".tk-modal")) return;
        if (rule.selector.includes(":where(.tk-modal)")) return;

        // Only touch Tailwind spacing utilities
        if (strict) {
          if (!TAILWIND_SPACING_SELECTOR_RE.test(rule.selector)) return;
        }

        // Check if this rule sets any spacing declarations we care about
        let hasSpacing = false;
        rule.walkDecls((decl) => {
          if (isSpacingDecl(decl)) hasSpacing = true;
        });
        if (!hasSpacing) return;

        // Clone the rule and scope it
        const clone = rule.clone();
        clone.selector = prefixSelectors(rule.selector, prefix);

        // Add !important only to spacing decls, still skipping revert-layer
        clone.walkDecls((decl) => {
          if (isSpacingDecl(decl) && !decl.important) {
            decl.important = true;
          }
        });

        // Emit the override *after* the original so it wins in source order
        rule.after(clone);
      });
    },
  };
};

plugin.postcss = true;

module.exports = plugin;
