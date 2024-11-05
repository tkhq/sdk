/** @type {import("@jest/types").Config.InitialOptions} */
const config = {
  transform: {
    "\\.[jt]sx?$": "@turnkey/jest-config/transformer.js",
  },
  testPathIgnorePatterns: [
    "<rootDir>/dist/",
    "<rootDir>/node_modules/",
    "<rootDir>/src/__tests__/wallet-interfaces.ts",
    "<rootDir>/src/__tests__/constants.ts",
    "<rootDir>/src/__tests__/utils.ts",
  ],
  setupFiles: ["dotenv/config"],
};

module.exports = config;
