import { describe, expect, jest, it } from "@jest/globals";
import {
  Session,
  SessionType,
  TurnkeyError,
  TurnkeyErrorCodes,
} from "@turnkey/sdk-types";
import {
  isValidSession,
  parseOAuthRedirect,
  withTurnkeyErrorHandling,
} from "../utils/utils";

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
    const result = await withTurnkeyErrorHandling(async () => 42);
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
      withTurnkeyErrorHandling(async () => {
        throw new Error("boom");
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        message: "An unknown error occurred",
        code: TurnkeyErrorCodes.UNKNOWN,
      }),
    );
  });

  it("does not require callbacks; still wraps and throws", async () => {
    await expect(
      withTurnkeyErrorHandling(async () => {
        throw new Error("no callbacks here");
      }),
    ).rejects.toBeInstanceOf(TurnkeyError);
  });
});

describe("parseOAuthRedirect", () => {
  describe("Apple redirects", () => {
    it("parses an Apple hash with unencoded state and id_token at the end", () => {
      const hash =
        "state=provider=apple&flow=redirect&publicKey=pk_abc123&openModal=true&sessionKey=sess_1&code=xyz&id_token=apple.id.token";
      const out = parseOAuthRedirect(hash);

      expect(out).toEqual({
        idToken: "apple.id.token",
        provider: "apple",
        flow: "redirect",
        publicKey: "pk_abc123",
        openModal: "true",
        sessionKey: "sess_1",
      });
    });

    it("returns nulls for state fields when &code= is missing, but still extracts id_token if last", () => {
      const hash = "state=provider=apple&id_token=final.apple.token";
      const out = parseOAuthRedirect(hash);

      expect(out).toEqual({
        idToken: "final.apple.token",
        provider: null,
        flow: null,
        publicKey: null,
        openModal: null,
        sessionKey: null,
      });
    });

    it("returns null idToken if id_token is not the last parameter", () => {
      // Implementation’s regex requires id_token at the end ($).
      const hash =
        "state=provider=apple&flow=redirect&publicKey=pk&openModal=true&sessionKey=sess&id_token=apple123&code=zzz";
      const out = parseOAuthRedirect(hash);

      expect(out.idToken).toBeNull(); // because id_token is not at the end
      expect(out.provider).toBe("apple");
      expect(out.flow).toBe("redirect");
      expect(out.publicKey).toBe("pk");
      expect(out.openModal).toBe("true");
      expect(out.sessionKey).toBe("sess");
    });
  });

  describe("Google redirects", () => {
    it("parses a Google hash with URL-encoded state (recommended / typical)", () => {
      // state value is URL-encoded so URLSearchParams reads it as a single field
      const state = encodeURIComponent(
        "provider=google&flow=popup&publicKey=pk_g123&openModal=false&sessionKey=sess_g1",
      );
      const hash = `id_token=google.id.token&state=${state}`;
      const out = parseOAuthRedirect(hash);

      expect(out).toEqual({
        idToken: "google.id.token",
        provider: "google",
        flow: "popup",
        publicKey: "pk_g123",
        openModal: "false",
        sessionKey: "sess_g1",
      });
    });

    it("with UNencoded state only captures the first segment as state (current behavior)", () => {
      // URLSearchParams will split on '&', so only 'provider=google' is captured as the state value.
      const hash =
        "id_token=tok123&state=provider=google&flow=popup&publicKey=pk&openModal=true&sessionKey=sess";
      const out = parseOAuthRedirect(hash);

      // current behavior:
      expect(out.idToken).toBe("tok123");
      expect(out.provider).toBe("google");
      expect(out.flow).toBeNull(); // not in the captured state segment
      expect(out.publicKey).toBeNull();
      expect(out.openModal).toBeNull();
      expect(out.sessionKey).toBeNull();
    });

    it("returns nulls if neither id_token nor state are present", () => {
      const out = parseOAuthRedirect("access_token=abc123");
      expect(out).toEqual({
        idToken: null,
        provider: null,
        flow: null,
        publicKey: null,
        openModal: null,
        sessionKey: null,
      });
    });
  });

  describe("Provider detection logic", () => {
    it("uses Apple path only when hash starts with 'state=provider=apple'", () => {
      // Starts with something else: should go down the Google path
      const hash =
        "id_token=zzz&state=" +
        encodeURIComponent(
          "provider=apple&flow=redirect&publicKey=pk&openModal=true&sessionKey=sess",
        );
      const out = parseOAuthRedirect(hash);

      // Parsed by Google path (since it didn't start with 'state=provider=apple')
      expect(out.provider).toBe("apple");
      expect(out.flow).toBe("redirect");
      expect(out.publicKey).toBe("pk");
      expect(out.openModal).toBe("true");
      expect(out.sessionKey).toBe("sess");
      expect(out.idToken).toBe("zzz");
    });

    it("routes to Apple path when prefix matches exactly", () => {
      const hash =
        "state=provider=apple&flow=redirect&publicKey=pk&openModal=true&sessionKey=sess&code=abc&id_token=tok";
      const out = parseOAuthRedirect(hash);
      expect(out.provider).toBe("apple");
    });
  });
});
