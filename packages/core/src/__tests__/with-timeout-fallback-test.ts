import { describe, expect, it, jest } from "@jest/globals";

import { withTimeoutFallback } from "../utils";

describe("withTimeoutFallback", () => {
  it("clears its timer once the promise settles first", async () => {
    jest.useFakeTimers();
    try {
      await withTimeoutFallback(Promise.resolve("value"), "fallback", 5000);

      // The pending fallback timer must not outlive the race.
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it("still returns the fallback when the promise is slower", async () => {
    jest.useFakeTimers();
    try {
      const slow = new Promise<string>(() => {});
      const raced = withTimeoutFallback(slow, "fallback", 5000);

      await jest.advanceTimersByTimeAsync(5000);

      expect(await raced).toBe("fallback");
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
