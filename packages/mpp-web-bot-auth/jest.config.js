/** @type {import("@jest/types").Config.InitialOptions} */
module.exports = {
  transform: { "\\.[jt]sx?$": "@turnkey/jest-config/transformer.js" },
  testMatch: ["<rootDir>/src/__tests__/**/*-test.ts"],
  testPathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/node_modules/"],
  testTimeout: 30 * 1000,
};
