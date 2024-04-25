/** @type {import("@jest/types").Config.InitialOptions} */
const config = {
  transform: {
    "\\.[jt]sx?$": "@turnkey/jest-config/transformer.js",
  },
  testMatch: ["**/__tests__/**/*-(spec|test).[jt]s?(x)"],
  testPathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/node_modules/"],
  testTimeout: 30 * 1000, // For slow CI machines
  // testEnvironment: "jsdom",
  testEnvironment: "./jest.environment.js",
  // setupFiles: ["./jest.setup.js"],
  // setupFiles: ["jest-localstorage-mock"],
  setupFiles: ["jest-localstorage-mock", "./jest.setup.js"],
};

module.exports = config;
