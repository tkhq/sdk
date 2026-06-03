import rollup from "../../rollup.config.base.mjs";

export default (options) =>
  rollup(options).map((c) => ({ ...c, input: "src/index.mts" }));
