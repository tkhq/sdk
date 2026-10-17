import { inspect } from "node:util";
import { describe, expect, test } from "@jest/globals";

import {
  BrowserSecretsError,
  authorize,
  isBrowserSecretsError,
  toSafeError,
} from "../index";

const canary = "sk-canary-8c1e";

describe("BrowserSecretsError", () => {
  test("fromDecision carries the code and the deny reason", () => {
    const decision = authorize(
      { secretId: "s", staticProperties: {} },
      { targets: [{ elementId: "e" }] },
      {
        browserSessionId: "b",
        tabId: "t",
        topLevelUrl: "https://x.example/",
        targets: [],
      },
    );
    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    const error = BrowserSecretsError.fromDecision(decision);
    expect(error.code).toBe("destination_denied");
    expect(error.reason).toBe("unbound_secret");
    expect(error.toJSON()).toEqual({
      name: "BrowserSecretsError",
      code: "destination_denied",
      reason: "unbound_secret",
      message: error.message,
    });
  });

  test("toSafeError drops the message, body, and cause of foreign errors", () => {
    const raw = Object.assign(new Error(`Turnkey said: ${canary}`), {
      body: { details: canary },
      cause: new Error(canary),
    });
    const safe = toSafeError(raw, "backend_error");
    expect(safe.code).toBe("backend_error");
    for (const text of [
      safe.message,
      safe.stack ?? "",
      JSON.stringify(safe),
      inspect(safe),
      String(safe),
    ]) {
      expect(text).not.toContain(canary);
    }
    expect((safe as { cause?: unknown }).cause).toBeUndefined();
    // Safe errors pass through; non-errors are wrapped.
    expect(toSafeError(safe)).toBe(safe);
    expect(isBrowserSecretsError(toSafeError(canary))).toBe(true);
    expect(toSafeError(canary).code).toBe("internal_error");
  });
});
