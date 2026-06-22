import type { Config } from "@jest/types";

export default {
  transform: {
    "\\.[jt]sx?$": "@turnkey/jest-config/transformer.js",
  },
  testPathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/node_modules/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@generated/(.*)$": "<rootDir>/src/__generated__/$1",
  },
  setupFilesAfterEnv: ["dotenv/config"],
} satisfies Config.InitialOptions;
