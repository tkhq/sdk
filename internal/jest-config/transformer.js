const { createTransformer } = require("babel-jest");

module.exports = createTransformer({
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    "@babel/preset-typescript",
    "@babel/preset-flow",
    ["@babel/preset-react", { runtime: "automatic" }],
  ],
});
