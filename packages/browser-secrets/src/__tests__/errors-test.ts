import { inspect } from "node:util";
import { describe, expect, test } from "@jest/globals";

import {
  BrowserSecretsError,
  DENY_REASONS,
  DENY_REASON_MESSAGES,
  authorize,
  isBrowserSecretsError,
  toSafeError,
} from "../index";

const canary = "sk-canary-8c1e";

describe("BrowserSecretsError", () => {
  test("every deny reason has a fixed message", () => {
    for (const reason of DENY_REASONS) {
      const error = new BrowserSecretsError("destination_denied", reason);
      expect(error.message).toBe(DENY_REASON_MESSAGES[reason]);
      expect(error.toJSON()).toEqual({
        name: "BrowserSecretsError",
        code: "destination_denied",
        reason,
        message: DENY_REASON_MESSAGES[reason],
      });
    }
  });

  test("fromDecision maps a denial", () => {
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
  });

  test("unknown codes fall back to internal_error", () => {
    const error = new BrowserSecretsError(canary as never);
    expect(error.code).toBe("internal_error");
    expect(error.message).not.toContain(canary);
  });
});

describe("toSafeError", () => {
  test("drops the message, body, and cause of foreign errors", () => {
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
  });

  test("passes safe errors through and wraps non-errors", () => {
    const safe = new BrowserSecretsError("invalid_request");
    expect(toSafeError(safe)).toBe(safe);
    expect(toSafeError(canary).code).toBe("internal_error");
    expect(isBrowserSecretsError(toSafeError({ canary }))).toBe(true);
  });
});
