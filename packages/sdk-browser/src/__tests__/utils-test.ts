import { test, expect } from "@jest/globals";
import {
    createEmbeddedAPIKey,
} from "../utils";

// Test to see that createEmbeddedAPIKey succeeds with a valid uncompressed public key
test("createEmbeddedAPIKey", async function () {
    const result = await createEmbeddedAPIKey("04413029cb9a5a4a0b087a9b8a060116d0d32bb22d14aebf7778215744811bb6ce40780d7bb9e2e068879f443e05b21b8fc0b62c9c811008064d988856077e35e7");
    expect(result).toBe({});
});