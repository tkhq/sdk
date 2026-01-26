import { describe, expect, jest, it } from "@jest/globals";
import {
  Session,
  SessionType,
  TurnkeyError,
  TurnkeyErrorCodes,
} from "@turnkey/sdk-types";
import { isValidSession, withTurnkeyErrorHandling } from "../utils/utils";

describe("isValidSession", () => {
  const validSession: Session = {
    sessionType: SessionType.READ_WRITE,
    userId: "user123",
    organizationId: "org123",
    expiry: (Date.now() + 1000 * 60 * 60) / 1000, // 1 hour in the future
    expirationSeconds: "3600",
    token: "<token>",
    publicKey: "<publicKey>",
  };
  const expiredSession: Session = {
    sessionType: SessionType.READ_WRITE,
    userId: "user123",
    organizationId: "org123",
    expiry: (Date.now() - 1000 * 60 * 60) / 1000, // 1 hour in the past
    expirationSeconds: "3600",
    token: "<token>",
    publicKey: "<publicKey>",
  };

  it("returns true for a valid session", () => {
    expect(isValidSession(validSession)).toBe(true);
  });

  it("returns false for an expired session", () => {
    expect(isValidSession(expiredSession)).toBe(false);
  });
});

describe("withTurnkeyErrorHandling", () => {
  it("resolves with the fn result on success", async () => {
    const result = await withTurnkeyErrorHandling(
      async () => 42,
      async () => {},
    );
    expect(result).toBe(42);
  });

  it("rethrows the same TurnkeyError instance if fn throws one", async () => {
    const original = new TurnkeyError(
      "boom",
      TurnkeyErrorCodes.INVALID_REQUEST,
    );
    const onError = jest.fn();

    await expect(
      withTurnkeyErrorHandling(
        async () => {
          throw original;
        },
        async () => {},
        { onError },
        "fallback msg",
        TurnkeyErrorCodes.UNKNOWN,
      ),
    ).rejects.toBe(original); // identity check

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(original);
  });

  it("wraps a non-Turnkey error using provided fallback message/code", async () => {
    const cause = new Error("network kaboom");
    const onError = jest.fn();

    await expect(
      withTurnkeyErrorHandling(
        async () => {
          throw cause;
        },
        async () => {},
        { onError },
        "Custom fallback",
        TurnkeyErrorCodes.NETWORK_ERROR, // pick any code that exists in your enum
      ),
    ).rejects.toEqual(
      expect.objectContaining({
        message: "Custom fallback",
        code: TurnkeyErrorCodes.NETWORK_ERROR,
      }),
    );

    expect(onError).toHaveBeenCalledTimes(1);
    const wrapped = onError.mock.calls?.[0]?.[0];
    expect(wrapped).toBeInstanceOf(TurnkeyError);
    expect(onError.mock.calls?.[0]?.[0]).toBeInstanceOf(TurnkeyError);
  });

  it("wraps a thrown non-Error value (e.g., string) and still calls onError", async () => {
    const onError = jest.fn();

    await expect(
      withTurnkeyErrorHandling(
        async () => {
          // eslint-disable-next-line no-throw-literal
          throw "stringly-typed error";
        },
        async () => {},
        { onError },
        "Wrapped non-error",
        TurnkeyErrorCodes.UNKNOWN,
      ),
    ).rejects.toEqual(
      expect.objectContaining({
        message: "Wrapped non-error",
        code: TurnkeyErrorCodes.UNKNOWN,
      }),
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls?.[0]?.[0]).toBeInstanceOf(TurnkeyError);
  });

  it("uses default fallback message/code when none are provided", async () => {
    await expect(
      withTurnkeyErrorHandling(
        async () => {
          throw new Error("boom");
        },
        async () => {},
      ),
    ).rejects.toEqual(
      expect.objectContaining({
        message: "An unknown error occurred",
        code: TurnkeyErrorCodes.UNKNOWN,
      }),
    );
  });

  it("does not require callbacks; still wraps and throws", async () => {
    await expect(
      withTurnkeyErrorHandling(
        async () => {
          throw new Error("no callbacks here");
        },
        async () => {},
      ),
    ).rejects.toBeInstanceOf(TurnkeyError);
  });

  it("logs out if TurnkeyErrorCodes.SESSION_EXPIRED is encountered", async () => {
    const logout = jest.fn();

    await expect(
      withTurnkeyErrorHandling(
        async () => {
          throw new TurnkeyError(
            "session expired",
            TurnkeyErrorCodes.SESSION_EXPIRED,
          );
        },
        async () => {
          logout();
          return;
        },
        {},
        "session expired",
        TurnkeyErrorCodes.SESSION_EXPIRED,
      ),
    ).rejects.toEqual(
      expect.objectContaining({
        message: "session expired",
        code: TurnkeyErrorCodes.SESSION_EXPIRED,
      }),
    );

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
