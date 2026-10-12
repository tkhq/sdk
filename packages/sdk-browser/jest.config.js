/** @type {import("@jest/types").Config.InitialOptions} */
const config = {
  transform: {
    "\\.[jt]sx?$": "@turnkey/jest-config/transformer.js",
  },
  moduleNameMapper: {
    "^@constants$": "<rootDir>/src/constants.ts",
    "^@models$": "<rootDir>/src/models.ts",
    "^@polyfills/(.*)$": "<rootDir>/src/__polyfills__/$1",
    "^@storage$": "<rootDir>/src/storage.ts",
    "^@types$": "<rootDir>/src/__types__/base.ts",
    "^@utils$": "<rootDir>/src/utils.ts",
  },
  testMatch: ["**/__tests__/**/*-(spec|test).[jt]s?(x)"],
  testPathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/node_modules/"],
  testTimeout: 30 * 1000, // For slow CI machines
};

module.exports = config;
