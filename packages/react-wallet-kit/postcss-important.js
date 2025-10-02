// This script adds !important to all padding/margin declarations except those that use revert-layer
// This is because (for some reason) Safari on iOS 26 and MacOS 26 now forces 0 padding and margin when using revert-layer. This seems to be a bug/oversight.
// We fix this by forcing !important on all padding/margin declarations that come from tailwind's.

const postcss = require("postcss");

module.exports = postcss.plugin("postcss-important-padding-margin", () => {
  return (root) => {
    root.walkDecls((decl) => {
      const prop = decl.prop.toLowerCase();

      // Match padding/margin and their shorthands
      if (
        prop === "padding" ||
        prop === "margin" ||
        prop.startsWith("padding-") ||
        prop.startsWith("margin-")
      ) {
        // Skip if this is a revert-layer reset
        if (decl.value && decl.value.includes("revert-layer")) {
          return;
        }

        // Only add if it doesn't already have !important
        if (!decl.important) {
          decl.important = true;
        }
      }
    });
  };
});
