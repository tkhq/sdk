/** @type {import("@jest/types").Config.InitialOptions} */
const config = {
  transform: {
    "\\.[jt]sx?$": "@turnkey/jest-config/transformer.js",
  },
  testMatch: ["**/__tests__/**/*-(spec|test).[jt]s?(x)"],
  testPathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/node_modules/"],
  testTimeout: 30 * 1000,
  moduleNameMapper: {
    "^@turnkey/crypto$": "<rootDir>/../crypto/src/index.ts",
    "^@turnkey/sdk-server$": "<rootDir>/../sdk-server/src/index.ts",
    "^@turnkey/api-key-stamper$": "<rootDir>/../api-key-stamper/src/index.ts",
  },
};

module.exports = config;
