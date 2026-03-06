import { beforeEach, describe, expect, it } from "@jest/globals";
import { OAuthProviders, TurnkeyErrorCodes } from "@turnkey/sdk-types";
import {
  OAUTH_STATE_KEY,
  buildOAuthState,
  buildOAuthUrl,
  consumeOAuthState,
  parseStateParam,
  parseOAuthResponse,
} from "../utils/oauth";

function setStoredOAuthState(state: string) {
  localStorage.setItem(OAUTH_STATE_KEY, state);
}

beforeEach(() => {
  let store: Record<string, string> = {};

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    },
  });
});

describe("parseOAuthRedirect", () => {
  describe("Apple redirects", () => {
    it("parses an Apple hash with unencoded state and id_token at the end", () => {
      const storedState =
        "provider=apple&flow=redirect&publicKey=pk_abc123&openModal=true&sessionKey=sess_1";
      setStoredOAuthState(storedState);
      const url =
        "https://example.com/callback#state=provider=apple&flow=redirect&publicKey=pk_abc123&openModal=true&sessionKey=sess_1&code=xyz&id_token=apple.id.token";
      const out = parseOAuthResponse(url);

      expect(out).toEqual({
        idToken: "apple.id.token",
        authCode: null,
        provider: "apple",
        flow: "redirect",
        publicKey: "pk_abc123",
        openModal: "true",
        sessionKey: "sess_1",
        oauthIntent: null,
        nonce: null,
        captchaToken: null,
      });
    });

    it("throws when Apple redirect response is missing a parseable state", () => {
      const url =
        "https://example.com/callback#state=provider=apple&id_token=final.apple.token";
      expect(() => parseOAuthResponse(url)).toThrow(
        expect.objectContaining({
          code: TurnkeyErrorCodes.INVALID_OAUTH_STATE,
          message: "Missing OAuth state in redirect response",
        }),
      );
    });

    it("throws if Apple state is malformed because id_token appears before code", () => {
      // Implementation’s regex requires id_token at the end ($).
      const storedState =
        "provider=apple&flow=redirect&publicKey=pk&openModal=true&sessionKey=sess";
      setStoredOAuthState(storedState);
      const url =
        "https://example.com/callback#state=provider=apple&flow=redirect&publicKey=pk&openModal=true&sessionKey=sess&id_token=apple123&code=zzz";
      expect(() => parseOAuthResponse(url)).toThrow(
        expect.objectContaining({
          code: TurnkeyErrorCodes.INVALID_OAUTH_STATE,
          message: "OAuth state mismatch",
        }),
      );
    });
  });

  describe("Google redirects", () => {
    it("parses a Google hash with URL-encoded state (recommended / typical)", () => {
      // state value is URL-encoded so URLSearchParams reads it as a single field
      const rawState =
        "provider=google&flow=popup&publicKey=pk_g123&openModal=false&sessionKey=sess_g1";
      setStoredOAuthState(rawState);
      const state = encodeURIComponent(rawState);
      const url = `https://example.com/callback#id_token=google.id.token&state=${state}`;
      const out = parseOAuthResponse(url);

      expect(out).toEqual({
        idToken: "google.id.token",
        authCode: null,
        provider: "google",
        flow: "popup",
        publicKey: "pk_g123",
        openModal: "false",
        sessionKey: "sess_g1",
        oauthIntent: null,
        nonce: null,
        captchaToken: null,
      });
    });

    it("with UNencoded state only captures the first segment as state (current behavior)", () => {
      // URLSearchParams will split on '&', so only 'provider=google' is captured as the state value.
      setStoredOAuthState("provider=google");
      const url =
        "https://example.com/callback#id_token=tok123&state=provider=google&flow=popup&publicKey=pk&openModal=true&sessionKey=sess";
      const out = parseOAuthResponse(url);

      // current behavior:
      expect(out?.idToken).toBe("tok123");
      expect(out?.provider).toBe("google");
      expect(out?.flow).toBeNull(); // not in the captured state segment
      expect(out?.publicKey).toBeNull();
      expect(out?.openModal).toBeNull();
      expect(out?.sessionKey).toBeUndefined();
    });

    it("throws if neither id_token nor state are present", () => {
      const url = "https://example.com/callback#access_token=abc123";
      expect(() => parseOAuthResponse(url)).toThrow(
        expect.objectContaining({
          code: TurnkeyErrorCodes.INVALID_OAUTH_STATE,
          message: "Missing OAuth state in redirect response",
        }),
      );
    });
  });

  describe("Provider detection logic", () => {
    it("uses Apple path only when hash starts with 'state=provider=apple'", () => {
      // Starts with something else: should go down the Google path
      const rawState =
        "provider=apple&flow=redirect&publicKey=pk&openModal=true&sessionKey=sess";
      setStoredOAuthState(rawState);
      const url =
        "https://example.com/callback#id_token=zzz&state=" +
        encodeURIComponent(rawState);
      const out = parseOAuthResponse(url);

      // Parsed by Google path (since it didn't start with 'state=provider=apple')
      expect(out?.provider).toBe("apple");
      expect(out?.flow).toBe("redirect");
      expect(out?.publicKey).toBe("pk");
      expect(out?.openModal).toBe("true");
      expect(out?.sessionKey).toBe("sess");
      expect(out?.idToken).toBe("zzz");
    });

    it("routes to Apple path when prefix matches exactly", () => {
      const storedState =
        "provider=apple&flow=redirect&publicKey=pk&openModal=true&sessionKey=sess";
      setStoredOAuthState(storedState);
      const url =
        "https://example.com/callback#state=provider=apple&flow=redirect&publicKey=pk&openModal=true&sessionKey=sess&code=abc&id_token=tok";
      const out = parseOAuthResponse(url);
      expect(out?.provider).toBe("apple");
    });
  });
});

describe("OAuth utils", () => {
  describe("consumeOAuthState", () => {
    it("clears stored state even when validation throws", () => {
      setStoredOAuthState("expected_state");

      expect(() => consumeOAuthState("different_state")).toThrow(
        expect.objectContaining({
          code: TurnkeyErrorCodes.INVALID_OAUTH_STATE,
          message: "OAuth state mismatch",
        }),
      );
      expect(localStorage.getItem(OAUTH_STATE_KEY)).toBeNull();
    });
  });

  describe("buildOAuthState + parseStateParam", () => {
    it("builds and parses state with additional params", () => {
      const state = buildOAuthState({
        provider: OAuthProviders.GOOGLE,
        flow: "popup",
        publicKey: "pk_123",
        nonce: "nonce_abc",
        additionalState: { openModal: "true", sessionKey: "sess_1" },
      });

      const parsed = parseStateParam(state);
      expect(parsed.provider).toBe("google");
      expect(parsed.flow).toBe("popup");
      expect(parsed.publicKey).toBe("pk_123");
      expect(parsed.nonce).toBe("nonce_abc");
      expect(parsed.openModal).toBe("true");
      expect(parsed.sessionKey).toBe("sess_1");
    });

    it("returns empty object for null/undefined state", () => {
      expect(parseStateParam(null)).toEqual({});
      expect(parseStateParam(undefined)).toEqual({});
    });
  });

  describe("buildOAuthUrl", () => {
    it("builds Google URL with nonce in params and prompt", () => {
      const url = buildOAuthUrl({
        provider: OAuthProviders.GOOGLE,
        clientId: "client_google",
        redirectUri: "https://example.com/callback",
        publicKey: "pk_google",
        nonce: "nonce_google",
        flow: "redirect",
        additionalState: { sessionKey: "sess_google" },
      });

      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe(
        "https://accounts.google.com/o/oauth2/v2/auth",
      );
      expect(parsed.searchParams.get("client_id")).toBe("client_google");
      expect(parsed.searchParams.get("redirect_uri")).toBe(
        "https://example.com/callback",
      );
      expect(parsed.searchParams.get("response_type")).toBe("id_token");
      expect(parsed.searchParams.get("scope")).toBe("openid email profile");
      expect(parsed.searchParams.get("nonce")).toBe("nonce_google");
      expect(parsed.searchParams.get("prompt")).toBe("select_account");

      const state = parsed.searchParams.get("state");
      expect(state).toBeTruthy();
      const stateParams = parseStateParam(state);
      expect(stateParams.provider).toBe("google");
      expect(stateParams.flow).toBe("redirect");
      expect(stateParams.publicKey).toBe("pk_google");
      expect(stateParams.sessionKey).toBe("sess_google");
      expect(stateParams.nonce).toBeUndefined();
    });

    it("builds Discord URL with PKCE and nonce in state", () => {
      const url = buildOAuthUrl({
        provider: OAuthProviders.DISCORD,
        clientId: "client_discord",
        redirectUri: "https://example.com/discord",
        publicKey: "pk_discord",
        nonce: "nonce_discord",
        flow: "popup",
        codeChallenge: "challenge_123",
      });

      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe(
        "https://discord.com/oauth2/authorize",
      );
      expect(parsed.searchParams.get("client_id")).toBe("client_discord");
      expect(parsed.searchParams.get("redirect_uri")).toBe(
        "https://example.com/discord",
      );
      expect(parsed.searchParams.get("response_type")).toBe("code");
      expect(parsed.searchParams.get("scope")).toBe("identify email");
      expect(parsed.searchParams.get("code_challenge")).toBe("challenge_123");
      expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
      expect(parsed.searchParams.get("nonce")).toBeNull();

      const state = parsed.searchParams.get("state");
      expect(state).toBeTruthy();
      const stateParams = parseStateParam(state);
      expect(stateParams.provider).toBe("discord");
      expect(stateParams.flow).toBe("popup");
      expect(stateParams.publicKey).toBe("pk_discord");
      expect(stateParams.nonce).toBe("nonce_discord");
    });
  });

  describe("parseOAuthResponse (popup flows)", () => {
    it("parses non-PKCE popup hash (Google) with provider validation", () => {
      const rawState =
        "provider=google&flow=popup&publicKey=pk1&sessionKey=sess1";
      setStoredOAuthState(rawState);
      const state = encodeURIComponent(rawState);
      const url = `https://example.com/callback#id_token=tok123&state=${state}`;

      const result = parseOAuthResponse(url, OAuthProviders.GOOGLE);
      expect(result).toEqual({
        idToken: "tok123",
        authCode: null,
        sessionKey: "sess1",
        provider: "google",
        flow: "popup",
        publicKey: "pk1",
        openModal: null,
        oauthIntent: null,
        nonce: null,
        captchaToken: null,
      });
    });

    it("parses PKCE popup search params (Discord) with provider validation", () => {
      const rawState =
        "provider=discord&flow=popup&publicKey=pk2&sessionKey=sess2";
      setStoredOAuthState(rawState);
      const state = encodeURIComponent(rawState);
      const url = "https://example.com/discord?code=code123&state=" + state;

      const result = parseOAuthResponse(url, OAuthProviders.DISCORD);
      expect(result).toEqual({
        idToken: null,
        authCode: "code123",
        sessionKey: "sess2",
        provider: "discord",
        flow: "popup",
        publicKey: "pk2",
        openModal: null,
        oauthIntent: null,
        nonce: null,
        captchaToken: null,
      });
    });
  });
});
