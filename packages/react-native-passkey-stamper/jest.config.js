/** @type {import("@jest/types").Config.InitialOptions} */
const config = {
  preset: "@react-native/jest-preset",
  transform: {
    "\\.[jt]sx?$": "@turnkey/jest-config/transformer-react-native.js",
  },
  testPathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/node_modules/"],
  transformIgnorePatterns: [
    "<rootDir>/node_modules/(?!(@react-native+js-polyfills)/)",
  ],
};

module.exports = config;
