/** @jest-environment jsdom */
import "./browser-environment";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { useContext } from "react";
import {
  SessionType,
  type Session,
  TurnkeyError,
  TurnkeyErrorCodes,
} from "@turnkey/sdk-types";
import { ClientProvider } from "../providers/client/Provider";
import {
  ClientContext,
  type ClientContextType,
} from "../providers/client/Types";
import {
  AuthState,
  ClientState,
  type TurnkeyProviderConfig,
} from "../types/base";

jest.mock("@marsidev/react-turnstile", () => ({ Turnstile: () => null }));
jest.mock("@lottiefiles/react-lottie-player", () => ({ Player: () => null }));
jest.mock("../providers/modal/Hook", () => ({
  useModal: () => ({ isMobile: false }),
}));
jest.mock("@turnkey/core", () => ({
  ...jest.requireActual<typeof import("@turnkey/core")>("@turnkey/core"),
  TurnkeyClient: jest.fn(() => mockClient),
  applyPasskeyScope: jest.fn(),
  resetPasskeyScope: jest.fn(),
}));

let mockSessions: Record<string, Session>;
let mockActiveKey: string | undefined;
const mockClient = {
  config: { passkeyConfig: {} },
  init: jest.fn(async () => {}),
  getActiveSessionKey: jest.fn(async () => mockActiveKey),
  getAllSessions: jest.fn(async () => ({ ...mockSessions })),
  getSession: jest.fn(async (params?: { sessionKey?: string }) => {
    const key = params?.sessionKey ?? mockActiveKey;
    return key ? mockSessions[key] : undefined;
  }),
  clearSession: jest.fn(async (params?: { sessionKey?: string }) => {
    const key = params?.sessionKey ?? mockActiveKey;
    if (!key || !mockSessions[key])
      throw new TurnkeyError("Session missing", TurnkeyErrorCodes.NOT_FOUND);
    delete mockSessions[key];
    if (mockActiveKey === key) mockActiveKey = undefined;
  }),
  logout: jest.fn(async (params?: { sessionKey?: string }) => {
    const key = params?.sessionKey ?? mockActiveKey;
    if (!key || !mockSessions[key])
      throw new TurnkeyError(
        "Session missing",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    delete mockSessions[key];
    if (mockActiveKey === key) mockActiveKey = undefined;
  }),
};
const config: TurnkeyProviderConfig = {
  organizationId: "org",
  autoRefreshManagedState: false,
  auth: { autoRefreshSession: false },
  walletConfig: {
    features: { auth: false, connecting: false },
    chains: { ethereum: { native: false }, solana: { native: false } },
  },
};
const callbacks = { onError: jest.fn(), onSessionExpired: jest.fn() };
let current: ClientContextType;
let root: Root;
function Probe() {
  const value = useContext(ClientContext);
  if (!value) throw new Error("Provider is missing");
  current = value;
  return null;
}
function session(userId: string, seconds: number): Session {
  return {
    sessionType: SessionType.READ_WRITE,
    userId,
    organizationId: "org",
    expiry: Date.now() / 1000 + seconds,
    expirationSeconds: String(seconds),
    token: "test-token",
    publicKey: "test-public-key",
  };
}
async function mount() {
  root = createRoot(document.createElement("div"));
  await act(async () => {
    root.render(
      <ClientProvider config={config} callbacks={callbacks}>
        <Probe />
      </ClientProvider>,
    );
  });
  expect(current.clientState).toBe(ClientState.Ready);
  expect(callbacks.onError).not.toHaveBeenCalled();
}
beforeEach(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    value: true,
    configurable: true,
  });
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  jest.clearAllMocks();
  mockSessions = {};
  mockActiveKey = undefined;
});
afterEach(async () => {
  if (root)
    await act(async () => {
      root.unmount();
    });
  jest.useRealTimers();
});

describe("session expiry", () => {
  it("clears the active session once without a second logout or cleanup error", async () => {
    mockSessions = { a: session("owner-a", 10) };
    mockActiveKey = "a";
    await mount();
    expect(current.authState).toBe(AuthState.Authenticated);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });
    expect(mockClient.clearSession).toHaveBeenCalledTimes(1);
    expect(mockClient.clearSession).toHaveBeenCalledWith({ sessionKey: "a" });
    expect(mockClient.logout).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(callbacks.onSessionExpired).toHaveBeenCalledWith({
      sessionKey: "a",
    });
    expect(mockSessions).toEqual({});
    expect(current.allSessions).toEqual({});
    expect(current.session).toBeUndefined();
    expect(current.authState).toBe(AuthState.Unauthenticated);
  });

  it("keeps the active session and its provider state when another session expires", async () => {
    const active = session("owner-b", 120);
    mockSessions = { a: session("owner-a", 10), b: active };
    mockActiveKey = "b";
    await mount();
    expect(current.session).toEqual(active);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });
    expect(mockClient.clearSession).toHaveBeenCalledWith({ sessionKey: "a" });
    expect(mockClient.logout).not.toHaveBeenCalled();
    expect(mockActiveKey).toBe("b");
    expect(mockSessions).toEqual({ b: active });
    expect(current.allSessions).toEqual({ b: active });
    expect(current.session).toEqual(active);
    expect(current.authState).toBe(AuthState.Authenticated);
    expect(callbacks.onError).not.toHaveBeenCalled();
  });
});

it("does not restore removed sessions when two sessions are cleared together", async () => {
  const active = session("owner-c", 120);
  mockSessions = {
    a: session("owner-a", 120),
    b: session("owner-b", 120),
    c: active,
  };
  mockActiveKey = "c";
  await mount();
  await act(async () => {
    await Promise.all([
      current.clearSession({ sessionKey: "a" }),
      current.clearSession({ sessionKey: "b" }),
    ]);
  });
  expect(mockSessions).toEqual({ c: active });
  expect(current.allSessions).toEqual({ c: active });
  expect(current.session).toEqual(active);
  expect(current.authState).toBe(AuthState.Authenticated);
  expect(mockClient.logout).not.toHaveBeenCalled();
  expect(callbacks.onError).not.toHaveBeenCalled();
});
