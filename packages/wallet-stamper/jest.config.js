module.exports = config;
/** @type {import("@jest/types").Config.InitialOptions} */
const config = {
  transform: {
    '\\.[jt]sx?$': '@turnkey/jest-config/transformer.js',
  },
  testPathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/node_modules/'],
  // transformIgnorePatterns: ["<rootDir>/node_modules/(?!viem/)"],
  setupFiles: ['dotenv/config'],
};

module.exports = config;
