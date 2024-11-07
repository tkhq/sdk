/** @type {import("@jest/types").Config.InitialOptions} */
const config = {
  transform: {
    "\\.[jt]sx?$": "@turnkey/jest-config/transformer.js",
  },
  testPathIgnorePatterns: [
    "<rootDir>/dist/",
    "<rootDir>/node_modules/",
    "<rootDir>/src/__tests__/shared.ts",
  ],
  testTimeout: 30 * 1000, // For Github CI machines. Locally tests are quite fast.
  testEnvironment: "./src/util/telegram-environment.ts", // state that the tests should be run in a browser environment
  resetMocks: false,
  setupFiles: [
    "jest-localstorage-mock"
  ]
};

module.exports = config;
