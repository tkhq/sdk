import rollup from "../../rollup.config.base.mjs";

export default (options) =>
  rollup().map((c) => ({ ...c, input: "src/index.mts" }));
