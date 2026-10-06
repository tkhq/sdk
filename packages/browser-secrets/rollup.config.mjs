import rollup from "../../rollup.config.base.mjs";

// Two entry points: the package itself and the `./testing` subpath.
export default (options) =>
  rollup().map((config) => ({
    ...config,
    input: ["src/index.ts", "src/testing.ts"],
  }));
