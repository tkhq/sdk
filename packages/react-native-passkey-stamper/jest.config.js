/** @type {import("@jest/types").Config.InitialOptions} */
const config = {
  preset: "react-native",
  transform: {
    "\\.[jt]sx?$": "@turnkey/jest-config/transformer.js",
  },
  testPathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/node_modules/"],
  transformIgnorePatterns: [
    "<rootDir>/node_modules/(?!(@react-native+js-polyfills)/)",
  ],
};

module.exports = config;
