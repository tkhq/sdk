/** @type {import("@jest/types").Config.InitialOptions} */
const config = {
  transform: {
    "\\.[jt]sx?$": "@turnkey/jest-config/transformer.js",
  },
  testPathIgnorePatterns: [
    "<rootDir>/dist/",
    "<rootDir>/node_modules/",
    "<rootDir>/src/__tests__/typechain-types/",
  ],
  setupFiles: ["dotenv/config"],
  testTimeout: 30 * 1000, // For slow CI machines
};

module.exports = config;
