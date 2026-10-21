/** @type {import("@jest/types").Config.InitialOptions} */
const config = {
  transform: {
    "\\.[jt]sx?$": "@turnkey/jest-config/transformer.js",
  },
  moduleNameMapper: {
    "^@polyfills/(.*)$": "<rootDir>/src/__polyfills__/$1",
    "^@constants$": "<rootDir>/src/constants",
    "^@models$": "<rootDir>/src/models",
    "^@storage$": "<rootDir>/src/storage",
    "^@types$": "<rootDir>/src/__types__/base",
    "^@utils$": "<rootDir>/src/utils",
  },
  testMatch: ["**/__tests__/**/*-(spec|test).[jt]s?(x)"],
  testPathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/node_modules/"],
  testTimeout: 30 * 1000, // For slow CI machines
};

module.exports = config;
