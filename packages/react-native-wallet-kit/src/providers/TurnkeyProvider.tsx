"use client";

import {
  isValidSession,
  SESSION_WARNING_THRESHOLD_MS,
  withTurnkeyErrorHandling,
  TURNKEY_OAUTH_ORIGIN_URL,
  TURNKEY_OAUTH_REDIRECT_URL,
  DISCORD_AUTH_URL,
  X_AUTH_URL,
  generateChallengePair,
  exchangeCodeForToken,
  type TimerMap,
  clearKey,
  clearAll,
  setCappedTimeoutInMap,
  setTimeoutInMap,
  clearKeys,
} from "../utils";

import {
  getAuthProxyConfig,
  DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
  OtpType,
  TurnkeyClient,
  type AddOauthProviderParams,
  type AddPasskeyParams,
  type ClearSessionParams,
  type CompleteOauthParams,
  type CompleteOtpParams,
  type CreateApiKeyPairParams,
  type CreatePasskeyParams,
  type CreatePasskeyResult,
  type CreateWalletAccountsParams,
  type CreateWalletParams,
  type DeleteSubOrganizationParams,
  type ExportBundle,
  type FetchOrCreateP256ApiKeyUserParams,
  type FetchOrCreatePoliciesParams,
  type FetchOrCreatePoliciesResult,
  type FetchPrivateKeysParams,
  type FetchUserParams,
  type FetchWalletAccountsParams,
  type FetchWalletsParams,
  type GetSessionParams,
  type InitOtpParams,
  type LoginWithOauthParams,
  type LoginWithOtpParams,
  type LoginWithPasskeyParams,
  type LogoutParams,
  type RefreshSessionParams,
  type RemoveOauthProvidersParams,
  type RemovePasskeyParams,
  type RemoveUserEmailParams,
  type RemoveUserPhoneNumberParams,
  type SetActiveSessionParams,
  type SignAndSendTransactionParams,
  type SignMessageParams,
  type SignTransactionParams,
  type SignUpWithOauthParams,
  type SignUpWithOtpParams,
  type SignUpWithPasskeyParams,
  type StoreSessionParams,
  type UpdateUserEmailParams,
  type UpdateUserNameParams,
  type UpdateUserPhoneNumberParams,
  type VerifyOtpParams,
  type Wallet,
  type WalletAccount,
  type VerifyOtpResult,
  type CreateHttpClientParams,
  type TurnkeySDKClientBase,
  type FetchBootProofForAppProofParams,
} from "@turnkey/core";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import DeviceInfo from "react-native-device-info";
import { InAppBrowser } from "react-native-inappbrowser-reborn";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  TurnkeyError,
  TurnkeyErrorCodes,
  TurnkeyNetworkError,
  type Session,
  type TDeleteSubOrganizationResponse,
  type TStampLoginResponse,
  type ProxyTGetWalletKitConfigResponse,
  type v1SignRawPayloadResult,
  type v1User,
  type v1PrivateKey,
  type BaseAuthResult,
  AuthAction,
  type PasskeyAuthResult,
  v1BootProof,
} from "@turnkey/sdk-types";

import {
  type TurnkeyCallbacks,
  type TurnkeyProviderConfig,
  AuthMethod,
  AuthState,
  ClientState,
} from "../types";

import type {
  HandleAppleOauthParams,
  HandleDiscordOauthParams,
  HandleFacebookOauthParams,
  HandleGoogleOauthParams,
  HandleXOauthParams,
  RefreshUserParams,
  RefreshWalletsParams,
  ExportWalletParams,
  ExportPrivateKeyParams,
  ExportWalletAccountParams,
  ImportWalletParams,
  ImportPrivateKeyParams,
} from "../types/methods";
import { ClientContext } from "../types";
import { decryptExportBundle, generateP256KeyPair } from "@turnkey/crypto";
import {
  encryptWalletToBundle,
  encryptPrivateKeyToBundle,
} from "@turnkey/crypto";

/**
 * @inline
 */
interface TurnkeyProviderProps {
  children: ReactNode;
  config: TurnkeyProviderConfig;
  callbacks?: TurnkeyCallbacks | undefined;
}

/**
 * Provides Turnkey client authentication, session management, wallet operations, and user profile management
 * for the React Native Wallet Kit SDK. This context provider encapsulates all core authentication flows (Passkey, OTP, OAuth),
 * session lifecycle (creation, expiration, refresh), wallet import/export, and user profile updates (email, phone, name).
 *
 * The provider automatically initializes the Turnkey client, fetches configuration (including proxy auth config if needed),
 * and synchronizes session and authentication state. It exposes a comprehensive set of methods for authentication flows,
 * wallet management, and user profile operations, as well as UI handlers for modal-driven flows.
 *
 * Features:
 * - Passkey, OTP (Email/SMS), and OAuth (Google, Apple, Facebook, Discord, X) authentication and sign-up flows.
 * - React Native-specific OAuth: opens an in-app browser (Custom Tabs/Safari View Controller) and deep-links back via the configured app scheme.
 * - Session management: creation, expiration scheduling, refresh, and clearing.
 * - Wallet management: fetch, import, export, account management.
 * - User profile management: email, phone, name, OAuth provider, and passkey linking/removal.
 * - Error handling and callback integration for custom error and event responses.
 *
 * Usage:
 * Wrap your application with `TurnkeyProvider` to enable authentication and wallet features via context.
 *
 * @param config - The Turnkey provider configuration object.
 * @param children - React children to be rendered within the provider.
 * @param callbacks - Optional callbacks for error handling and session events.
 *
 * @returns A React context provider exposing authentication, wallet, and user management methods and state.
 */
export const TurnkeyProvider: React.FC<TurnkeyProviderProps> = ({
  config,
  children,
  callbacks,
}) => {
  const [client, setClient] = useState<TurnkeyClient | undefined>(undefined);
  const [session, setSession] = useState<Session | undefined>(undefined);
  const [masterConfig, setMasterConfig] = useState<
    TurnkeyProviderConfig | undefined
  >(undefined);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [user, setUser] = useState<v1User | undefined>(undefined);
  const [clientState, setClientState] = useState<ClientState>();
  const [authState, setAuthState] = useState<AuthState>(
    AuthState.Unauthenticated,
  );

  const expiryTimeoutsRef = useRef<TimerMap>({});
  const proxyAuthConfigRef = useRef<ProxyTGetWalletKitConfigResponse | null>(
    null,
  );

  const [allSessions, setAllSessions] = useState<
    Record<string, Session> | undefined
  >(undefined);

  const buildConfig = (
    proxyAuthConfig?: ProxyTGetWalletKitConfigResponse | undefined,
  ) => {
    // Juggle the local overrides with the values set in the dashboard (proxyAuthConfig).
    // Normalize potentially empty string values coming from the app-level config
    const sanitizedAuthProxyUrl =
      config.authProxyUrl && config.authProxyUrl.trim()
        ? config.authProxyUrl
        : undefined;
    // Resolve OTP enablement
    const emailOtpEnabled =
      config.auth?.otp?.email ??
      proxyAuthConfig?.enabledProviders.includes("email") ??
      false;
    const smsOtpEnabled =
      config.auth?.otp?.sms ??
      proxyAuthConfig?.enabledProviders.includes("sms") ??
      false;

    // Resolve shared redirect; do NOT attach scheme here. We'll attach in handler on demand.
    const appScheme = config.auth?.oauth?.appScheme ?? undefined;
    const redirectUrl =
      config.auth?.oauth?.redirectUri ??
      proxyAuthConfig?.oauthRedirectUrl ??
      TURNKEY_OAUTH_REDIRECT_URL;

    // Warn if they are trying to set auth proxy only settings directly
    if (config.auth?.sessionExpirationSeconds) {
      console.warn(
        "Turnkey SDK warning. You have set sessionExpirationSeconds directly in the TurnkeyProvider. This setting will be ignored because you are using an auth proxy. Please configure session expiration in the Turnkey dashboard.",
      );
    }
    if (config.auth?.otp?.alphanumeric !== undefined) {
      console.warn(
        "Turnkey SDK warning. You have set otpAlphanumeric directly in the TurnkeyProvider. This setting will be ignored because you are using an auth proxy. Please configure OTP settings in the Turnkey dashboard.",
      );
    }
    if (config.auth?.otp?.length) {
      console.warn(
        "Turnkey SDK warning. You have set otpLength directly in the TurnkeyProvider. This setting will be ignored because you are using an auth proxy. Please configure OTP settings in the Turnkey dashboard.",
      );
    }
    // These are settings that can only be set via the auth proxy config
    const authProxyOnlySettings = {
      sessionExpirationSeconds: proxyAuthConfig?.sessionExpirationSeconds,
      otp: {
        alphanumeric: proxyAuthConfig?.otpAlphanumeric ?? true, // This fallback will never be hit. This is purely for the tests to pass before mono is released
        length: proxyAuthConfig?.otpLength ?? "6", // This fallback will never be hit. This is purely for the tests to pass before mono is released
      },
    };

    return {
      ...config,
      // Ensure empty strings are not forwarded as URLs
      authProxyUrl: sanitizedAuthProxyUrl,

      // Overrides:
      auth: {
        ...config.auth,
        // Proxy-controlled settings
        sessionExpirationSeconds:
          authProxyOnlySettings.sessionExpirationSeconds,
        otp: {
          ...config.auth?.otp,
          // Enablement flags
          email: emailOtpEnabled,
          sms: smsOtpEnabled,
          // Proxy-only settings
          alphanumeric: authProxyOnlySettings.otp.alphanumeric,
          length: authProxyOnlySettings.otp.length,
        },
        // OAuth shared settings
        oauth: {
          ...config.auth?.oauth,
          ...(appScheme && { appScheme }),
          redirectUri: redirectUrl,
        },
        autoRefreshSession: config.auth?.autoRefreshSession ?? true,
      },
      autoRefreshManagedState: config.autoRefreshManagedState ?? true,
    } as TurnkeyProviderConfig;
  };

  const getOauthProviderSettings = (
    provider: "google" | "apple" | "facebook" | "x" | "discord",
  ) => {
    const oauth = masterConfig?.auth?.oauth;
    const providerConfig = oauth ? (oauth as any)[provider] : undefined;
    const providerObjectConfig =
      providerConfig && typeof providerConfig === "object"
        ? (providerConfig as { clientId?: string; redirectUri?: string })
        : undefined;

    const proxyClientIds = proxyAuthConfigRef.current?.oauthClientIds as
      | Record<string, string | undefined>
      | undefined;

    const clientId =
      providerObjectConfig?.clientId ??
      (proxyClientIds ? proxyClientIds[provider] : undefined);

    const appScheme = oauth?.appScheme;

    // For Discord and X, default to scheme-based deep link if not explicitly provided.
    const redirectUri =
      providerObjectConfig?.redirectUri ??
      ((provider === "discord" || provider === "x") && appScheme
        ? `${appScheme}://`
        : (oauth?.redirectUri ??
          proxyAuthConfigRef.current?.oauthRedirectUrl ??
          TURNKEY_OAUTH_REDIRECT_URL));

    return { clientId, redirectUri, appScheme } as const;
  };

  /**
   * Initializes the Turnkey client with the provided configuration.
   * This function sets up the client, fetches the proxy auth config if needed,
   * and prepares the client for use in authentication and wallet operations.
   *
   * @internal
   */
  const initializeClient = async () => {
    if (!masterConfig || client || clientState == ClientState.Loading) return;

    try {
      setClientState(ClientState.Loading);
      const turnkeyClient = new TurnkeyClient({
        apiBaseUrl: masterConfig.apiBaseUrl,
        authProxyUrl: masterConfig.authProxyUrl,
        authProxyConfigId: masterConfig.authProxyConfigId,
        organizationId: masterConfig.organizationId,
        defaultStamperType: masterConfig.defaultStamperType,

        // Define passkey and wallet config here. If we don't pass it into the client, Mr. Client will assume that we don't want to use passkeys/wallets and not create the stamper!
        passkeyConfig: {
          rpId: masterConfig.passkeyConfig?.rpId,
          timeout: masterConfig.passkeyConfig?.timeout || 60000, // 60 seconds
          userVerification:
            masterConfig.passkeyConfig?.userVerification || "preferred",
          allowCredentials: masterConfig.passkeyConfig?.allowCredentials || [],
        },
      });

      await turnkeyClient.init();
      setClient(turnkeyClient);

      // Don't set clientState to ready until we fetch the proxy auth config (See other fetchProxyAuthConfig useEffect)
    } catch (error) {
      setClientState(ClientState.Error);
      if (
        error instanceof TurnkeyError ||
        error instanceof TurnkeyNetworkError
      ) {
        callbacks?.onError?.(error);
      } else {
        callbacks?.onError?.(
          new TurnkeyError(
            `Failed to initialize Turnkey client`,
            TurnkeyErrorCodes.INITIALIZE_CLIENT_ERROR,
            error,
          ),
        );
      }
    }
  };

  /**
   * @internal
   * Schedules a session expiration and warning timer for the given session key.
   *
   * - Sets up two timers: one for warning before expiry and one for actual expiry.
   * - Uses capped timeouts under the hood so delays > 24.8 days are safe (see utils/timers.ts).
   *
   * @param params.sessionKey - The key of the session to schedule expiration for.
   * @param params.expiry - The expiration time in seconds since epoch.
   * @throws {TurnkeyError} If an error occurs while scheduling the session expiration.
   */
  async function scheduleSessionExpiration(params: {
    sessionKey: string;
    expiry: number; // seconds since epoch
  }) {
    const { sessionKey, expiry } = params;

    try {
      const warnKey = `${sessionKey}-warning`;

      // Replace any prior timers for this session
      clearKey(expiryTimeoutsRef.current, sessionKey);
      clearKey(expiryTimeoutsRef.current, warnKey);

      const now = Date.now();
      const expiryMs = expiry * 1000;
      const timeUntilExpiry = expiryMs - now;

      const beforeExpiry = async () => {
        const activeSession = await getSession();

        if (!activeSession && expiryTimeoutsRef.current[warnKey]) {
          // Keep nudging until session materializes (short 10s timer is fine)
          setTimeoutInMap(
            expiryTimeoutsRef.current,
            warnKey,
            beforeExpiry,
            10_000,
          );
          return;
        }

        const session = await getSession({ sessionKey });
        if (!session) return;

        callbacks?.beforeSessionExpiry?.({ sessionKey });

        if (masterConfig?.auth?.autoRefreshSession) {
          await refreshSession({
            expirationSeconds: session.expirationSeconds!,
            sessionKey,
          });
        }
      };

      const expireSession = async () => {
        const expiredSession = await getSession({ sessionKey });
        if (!expiredSession) return;

        callbacks?.onSessionExpired?.({ sessionKey });

        if ((await getActiveSessionKey()) === sessionKey) {
          setSession(undefined);
        }

        setAllSessions((prev) => {
          if (!prev) return prev;
          const next = { ...prev };
          delete next[sessionKey];
          return next;
        });

        await clearSession({ sessionKey });

        // Remove timers for this session
        clearKey(expiryTimeoutsRef.current, sessionKey);
        clearKey(expiryTimeoutsRef.current, warnKey);

        await logout();
      };

      // Already expired → expire immediately
      if (timeUntilExpiry <= 0) {
        await expireSession();
        return;
      }

      // Warning timer (if threshold is in the future)
      const warnAt = expiryMs - SESSION_WARNING_THRESHOLD_MS;
      if (warnAt <= now) {
        void beforeExpiry(); // fire-and-forget is fine
      } else {
        setCappedTimeoutInMap(
          expiryTimeoutsRef.current,
          warnKey,
          beforeExpiry,
          warnAt - now,
        );
      }

      // Actual expiry timer (safe for long delays)
      setCappedTimeoutInMap(
        expiryTimeoutsRef.current,
        sessionKey,
        expireSession,
        timeUntilExpiry,
      );
    } catch (error) {
      if (
        error instanceof TurnkeyError ||
        error instanceof TurnkeyNetworkError
      ) {
        callbacks?.onError?.(error);
      } else {
        callbacks?.onError?.(
          new TurnkeyError(
            `Failed to schedule session expiration for ${sessionKey}`,
            TurnkeyErrorCodes.SCHEDULE_SESSION_EXPIRY_ERROR,
            error,
          ),
        );
      }
    }
  }

  /**
   * Clears all scheduled session timers (warning + expiry).
   *
   * - Removes all active timers managed by this client.
   * - Useful on re-init or logout to avoid stale timers.
   *
   * @throws {TurnkeyError} If an error occurs while clearing the timers.
   */
  function clearSessionTimeouts(sessionKeys?: string[]) {
    try {
      if (sessionKeys) {
        clearKeys(expiryTimeoutsRef.current, sessionKeys);
      } else {
        clearAll(expiryTimeoutsRef.current); // clears & deletes everything
      }
    } catch (error) {
      if (
        error instanceof TurnkeyError ||
        error instanceof TurnkeyNetworkError
      ) {
        callbacks?.onError?.(error);
      } else {
        callbacks?.onError?.(
          new TurnkeyError(
            "Failed to clear session timeouts",
            TurnkeyErrorCodes.CLEAR_SESSION_TIMEOUTS_ERROR,
            error,
          ),
        );
      }
    }
  }

  /**
   * Initializes the user sessions by fetching all active sessions and setting up their state.
   * @internal
   */
  const initializeSessions = async () => {
    setSession(undefined);
    setAllSessions(undefined);
    try {
      const allLocalStorageSessions = await getAllSessions();
      if (!allLocalStorageSessions) return;

      await Promise.all(
        Object.keys(allLocalStorageSessions).map(async (sessionKey) => {
          const s = allLocalStorageSessions?.[sessionKey];
          if (!isValidSession(s)) {
            await clearSession({ sessionKey });
            if (sessionKey === (await getActiveSessionKey())) {
              setSession(undefined);
            }
            delete allLocalStorageSessions[sessionKey];
            return;
          }

          await scheduleSessionExpiration({
            sessionKey,
            expiry: s!.expiry,
          });
        }),
      );

      setAllSessions(allLocalStorageSessions || undefined);
      const activeSessionKey = await client?.getActiveSessionKey();
      if (activeSessionKey) {
        if (!allLocalStorageSessions[activeSessionKey]) {
          return;
        }
        setSession(allLocalStorageSessions[activeSessionKey]);
        await refreshUser();
        await refreshWallets();
        return;
      }
    } catch (error) {
      if (
        error instanceof TurnkeyError ||
        error instanceof TurnkeyNetworkError
      ) {
        callbacks?.onError?.(error);
      } else {
        callbacks?.onError?.(
          new TurnkeyError(
            `Failed to initialize sessions`,
            TurnkeyErrorCodes.INITIALIZE_SESSION_ERROR,
            error,
          ),
        );
      }
    }
  };

  /**
   * @internal
   * Handles the post-authentication flow.
   *
   * - This function is called after a successful authentication (login or sign-up) via any supported method (Passkey, Wallet, OTP, OAuth).
   * - It fetches the active session and all sessions, updates the session state, and schedules session expiration and warning timeouts.
   * - It also refreshes the user's wallets and profile information to ensure the provider state is up to date.
   * - This function is used internally after all authentication flows to synchronize state and trigger any necessary callbacks.
   *
   * @returns A void promise.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error during the process.
   */
  const handlePostAuth = async (params: {
    method: AuthMethod;
    action: AuthAction;
    identifier: string;
  }) => {
    const { method, action, identifier } = params;
    try {
      const sessionKey = await getActiveSessionKey();
      const session = await getSession({
        ...(sessionKey && { sessionKey }),
      });

      if (session && sessionKey)
        await scheduleSessionExpiration({
          sessionKey,
          expiry: session.expiry,
        });

      const allSessions = await client!.getAllSessions();

      setSession(session);
      setAllSessions(allSessions);

      await refreshWallets();
      await refreshUser();

      callbacks?.onAuthenticationSuccess?.({
        session,
        method,
        action,
        identifier,
      });
    } catch (error) {
      if (
        error instanceof TurnkeyError ||
        error instanceof TurnkeyNetworkError
      ) {
        callbacks?.onError?.(error);
      } else {
        callbacks?.onError?.(
          new TurnkeyError(
            `Failed to handle post-authentication`,
            TurnkeyErrorCodes.HANDLE_POST_AUTH_ERROR,
            error,
          ),
        );
      }
    }
  };

  /**
   * @internal
   * Handles the post-logout flow.
   *
   * - This function is called after a successful logout or session clear.
   * - It clears all scheduled session expiration and warning timeouts associated to the session key to prevent memory leaks.
   * - It resets the session state, removes user data from memory, the logged out session from all sessions state, and clears the wallets list.
   * - This ensures that all sensitive information is removed from the provider state after logout.
   * - Called internally after logout or when all sessions are cleared.
   *
   * @returns void
   * @throws {TurnkeyError} If there is an error during the post-logout process.
   */
  const handlePostLogout = (sessionKey?: string) => {
    try {
      clearSessionTimeouts(
        sessionKey ? [sessionKey, `${sessionKey}-warning`] : undefined,
      );
      setAllSessions((prev) => {
        if (!prev) return prev;
        if (sessionKey) {
          const next = { ...prev };
          delete next[sessionKey];
          return next;
        }
        return {};
      });
      setSession(undefined);
      setUser(undefined);
      setWallets([]);
    } catch (error) {
      callbacks?.onError?.(
        new TurnkeyError(
          `Failed to initialize sessions`,
          TurnkeyErrorCodes.HANDLE_POST_LOGOUT_ERROR,
          error,
        ),
      );
    }
  };

  const createPasskey = useCallback(
    async (params?: CreatePasskeyParams): Promise<CreatePasskeyResult> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      return withTurnkeyErrorHandling(
        () => client.createPasskey({ ...params }),
        () => logout(),
        callbacks,
        "Failed to create passkey",
      );
    },
    [client, callbacks],
  );

  const createHttpClient = useCallback(
    (params?: CreateHttpClientParams): TurnkeySDKClientBase => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      return client.createHttpClient(params);
    },
    [client],
  );

  const logout: (params?: LogoutParams) => Promise<void> = useCallback(
    async (params?: { sessionKey?: string }): Promise<void> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      await withTurnkeyErrorHandling(
        async () => {
          // If no sessionKey is provided, we try to get the active one.
          let sessionKey = params?.sessionKey;
          if (!sessionKey) sessionKey = await getActiveSessionKey();
          await client.logout(params);
          // We only handle post logout if the sessionKey is defined since that means we actually logged out of a session.
          if (sessionKey) handlePostLogout(sessionKey);
        },
        () => logout(),
        callbacks,
        "Failed to logout",
      );

      return;
    },
    [client, callbacks],
  );

  const loginWithPasskey = useCallback(
    async (params?: LoginWithPasskeyParams): Promise<PasskeyAuthResult> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }

      const expirationSeconds =
        masterConfig?.auth?.sessionExpirationSeconds ??
        DEFAULT_SESSION_EXPIRATION_IN_SECONDS;
      const res = await withTurnkeyErrorHandling(
        () => client.loginWithPasskey({ ...params, expirationSeconds }),
        () => logout(),
        callbacks,
        "Failed to login with passkey",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Passkey,
          action: AuthAction.LOGIN,
          identifier: res.credentialId,
        });
      }
      return res;
    },
    [client, callbacks],
  );

  const signUpWithPasskey = useCallback(
    async (params?: SignUpWithPasskeyParams): Promise<PasskeyAuthResult> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      if (!masterConfig) {
        throw new TurnkeyError(
          "Config is not ready yet!",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }
      // If createSubOrgParams is not provided, use the default from masterConfig
      let createSubOrgParams =
        params?.createSubOrgParams ??
        masterConfig.auth?.createSuborgParams?.passkeyAuth;
      params =
        createSubOrgParams !== undefined
          ? { ...params, createSubOrgParams }
          : { ...params };

      const expirationSeconds =
        masterConfig?.auth?.sessionExpirationSeconds ??
        DEFAULT_SESSION_EXPIRATION_IN_SECONDS;

      const websiteName =
        Platform.OS === "web" && typeof window !== "undefined"
          ? window.location.hostname
          : DeviceInfo.getApplicationName() ||
            DeviceInfo.getBundleId() ||
            "mobile-app";
      const timestamp =
        new Date().toLocaleDateString() +
        "-" +
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

      // We allow passkeyName to be passed in thru the provider or thru the params of this function directly.
      // This is because signUpWithPasskey will create a new passkey using that name.
      // Any extra authenticators will be created after the first one. (see core implementation)
      const passkeyName =
        params?.passkeyDisplayName ??
        masterConfig.auth?.createSuborgParams?.passkeyAuth?.passkeyName ??
        `${websiteName}-${timestamp}`;

      const res = await withTurnkeyErrorHandling(
        () =>
          client.signUpWithPasskey({
            ...params,
            passkeyDisplayName: passkeyName,
            expirationSeconds,
          }),
        () => logout(),
        callbacks,
        "Failed to sign up with passkey",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Passkey,
          action: AuthAction.SIGNUP,
          identifier: res.credentialId,
        });
      }
      return res;
    },
    [client, callbacks],
  );

  const initOtp = useCallback(
    async (params: InitOtpParams): Promise<string> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      return withTurnkeyErrorHandling(
        () => client.initOtp(params),
        () => logout(),
        callbacks,
        "Failed to initialize OTP",
      );
    },
    [client, callbacks],
  );

  const verifyOtp = useCallback(
    async (params: VerifyOtpParams): Promise<VerifyOtpResult> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      return withTurnkeyErrorHandling(
        () => client.verifyOtp(params),
        () => logout(),
        callbacks,
        "Failed to verify OTP",
      );
    },
    [client, callbacks],
  );

  const loginWithOtp = useCallback(
    async (params: LoginWithOtpParams): Promise<BaseAuthResult> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }

      const res = await withTurnkeyErrorHandling(
        () => client.loginWithOtp(params),
        () => logout(),
        callbacks,
        "Failed to login with OTP",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Otp,
          action: AuthAction.LOGIN,
          identifier: params.verificationToken,
        });
      }
      return res;
    },
    [client, callbacks],
  );

  const signUpWithOtp = useCallback(
    async (params: SignUpWithOtpParams): Promise<BaseAuthResult> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      if (!masterConfig) {
        throw new TurnkeyError(
          "Config is not ready yet!",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }
      // If createSubOrgParams is not provided, use the default from masterConfig
      let createSubOrgParams = params.createSubOrgParams;
      if (!createSubOrgParams && masterConfig?.auth?.createSuborgParams) {
        if (params.otpType === OtpType.Email) {
          createSubOrgParams =
            masterConfig.auth.createSuborgParams.emailOtpAuth;
        } else if (params.otpType === OtpType.Sms) {
          createSubOrgParams = masterConfig.auth.createSuborgParams.smsOtpAuth;
        }
      }
      params =
        createSubOrgParams !== undefined
          ? { ...params, createSubOrgParams }
          : { ...params };

      const res = await withTurnkeyErrorHandling(
        () => client.signUpWithOtp(params),
        () => logout(),
        callbacks,
        "Failed to sign up with OTP",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Otp,
          action: AuthAction.SIGNUP,
          identifier: params.verificationToken,
        });
      }
      return res;
    },
    [client, callbacks, masterConfig],
  );

  const completeOtp = useCallback(
    async (
      params: CompleteOtpParams,
    ): Promise<
      BaseAuthResult & { verificationToken: string; action: AuthAction }
    > => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      if (!masterConfig) {
        throw new TurnkeyError(
          "Config is not ready yet!",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }

      // If createSubOrgParams is not provided, use the default from masterConfig
      let createSubOrgParams = params.createSubOrgParams;
      if (!createSubOrgParams && masterConfig?.auth?.createSuborgParams) {
        if (params.otpType === OtpType.Email) {
          createSubOrgParams =
            masterConfig.auth.createSuborgParams.emailOtpAuth;
        } else if (params.otpType === OtpType.Sms) {
          createSubOrgParams = masterConfig.auth.createSuborgParams.smsOtpAuth;
        }
      }
      params =
        createSubOrgParams !== undefined
          ? { ...params, createSubOrgParams }
          : { ...params };

      const res = await withTurnkeyErrorHandling(
        () => client.completeOtp(params),
        () => logout(),
        callbacks,
        "Failed to complete OTP",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Otp,
          action: res.action,
          identifier: res.verificationToken,
        });
      }
      return res;
    },
    [client, callbacks, masterConfig],
  );

  const loginWithOauth = useCallback(
    async (params: LoginWithOauthParams): Promise<BaseAuthResult> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }

      const res = await withTurnkeyErrorHandling(
        () => client.loginWithOauth(params),
        () => logout(),
        callbacks,
        "Failed to login with OAuth",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Oauth,
          action: AuthAction.LOGIN,
          identifier: params.oidcToken,
        });
      }
      return res;
    },
    [client, callbacks],
  );

  const signUpWithOauth = useCallback(
    async (params: SignUpWithOauthParams): Promise<BaseAuthResult> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      if (!masterConfig) {
        throw new TurnkeyError(
          "Config is not ready yet!",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }
      // If createSubOrgParams is not provided, use the default from masterConfig
      let createSubOrgParams =
        params.createSubOrgParams ??
        masterConfig.auth?.createSuborgParams?.oauth;
      params =
        createSubOrgParams !== undefined
          ? { ...params, createSubOrgParams }
          : { ...params };

      const res = await withTurnkeyErrorHandling(
        () => client.signUpWithOauth(params),
        () => logout(),
        callbacks,
        "Failed to sign up with OAuth",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Oauth,
          action: AuthAction.SIGNUP,
          identifier: params.oidcToken,
        });
      }
      return res;
    },
    [client, callbacks, masterConfig],
  );

  const completeOauth = useCallback(
    async (
      params: CompleteOauthParams,
    ): Promise<BaseAuthResult & { action: AuthAction }> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      if (!masterConfig) {
        throw new TurnkeyError(
          "Config is not ready yet!",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }

      // If createSubOrgParams is not provided, use the default from masterConfig
      const createSubOrgParams =
        params.createSubOrgParams ??
        masterConfig.auth?.createSuborgParams?.oauth;

      params =
        createSubOrgParams !== undefined
          ? { ...params, createSubOrgParams }
          : { ...params };

      const res = await withTurnkeyErrorHandling(
        () => client.completeOauth(params),
        () => logout(),
        callbacks,
        "Failed to complete OAuth",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Oauth,
          action: res.action,
          identifier: params.oidcToken,
        });
      }
      return res;
    },
    [client, callbacks, masterConfig],
  );

  const fetchWallets = useCallback(
    async (params?: FetchWalletsParams): Promise<Wallet[]> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      return withTurnkeyErrorHandling(
        () => client.fetchWallets(params),
        () => logout(),
        callbacks,
        "Failed to fetch wallets",
      );
    },
    [client, callbacks],
  );

  const fetchWalletAccounts = useCallback(
    async (params: FetchWalletAccountsParams): Promise<WalletAccount[]> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      return withTurnkeyErrorHandling(
        () => client.fetchWalletAccounts(params),
        () => logout(),
        callbacks,
        "Failed to fetch wallet accounts",
      );
    },
    [client, callbacks],
  );

  const fetchPrivateKeys = useCallback(
    async (params?: FetchPrivateKeysParams): Promise<v1PrivateKey[]> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      return withTurnkeyErrorHandling(
        () => client.fetchPrivateKeys(params),
        () => logout(),
        callbacks,
        "Failed to fetch private keys",
      );
    },
    [client, callbacks],
  );

  const fetchBootProofForAppProof = useCallback(
    async (params: FetchBootProofForAppProofParams): Promise<v1BootProof> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.fetchBootProofForAppProof(params),
        () => logout(),
        callbacks,
        "Failed to fetch or create delegated access user",
      );
    },
    [client, callbacks],
  );

  const signMessage = useCallback(
    async (params: SignMessageParams): Promise<v1SignRawPayloadResult> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.signMessage(params),
        () => logout(),
        callbacks,
        "Failed to sign message",
      );
    },
    [client, callbacks],
  );

  const signTransaction = useCallback(
    async (params: SignTransactionParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.signTransaction(params),
        () => logout(),
        callbacks,
        "Failed to sign transaction",
      );
    },
    [client, callbacks],
  );

  const signAndSendTransaction = useCallback(
    async (params: SignAndSendTransactionParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.signAndSendTransaction(params),
        () => logout(),
        callbacks,
        "Failed to sign transaction",
      );
    },
    [client, callbacks],
  );

  const fetchUser = useCallback(
    async (params?: FetchUserParams): Promise<v1User> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.fetchUser(params),
        () => logout(),
        callbacks,
        "Failed to fetch user",
      );
    },
    [client, callbacks],
  );

  const fetchOrCreateP256ApiKeyUser = useCallback(
    async (params: FetchOrCreateP256ApiKeyUserParams): Promise<v1User> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.fetchOrCreateP256ApiKeyUser(params),
        () => logout(),
        callbacks,
        "Failed to fetch or create delegated access user",
      );
    },
    [client, callbacks],
  );

  const fetchOrCreatePolicies = useCallback(
    async (
      params: FetchOrCreatePoliciesParams,
    ): Promise<FetchOrCreatePoliciesResult> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.fetchOrCreatePolicies(params),
        () => logout(),
        callbacks,
        "Failed to fetch or create delegated access user",
      );
    },
    [client, callbacks],
  );

  const updateUserEmail = useCallback(
    async (params: UpdateUserEmailParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.updateUserEmail(params),
        () => logout(),
        callbacks,
        "Failed to update user email",
      );
      if (res)
        await refreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks],
  );

  const removeUserEmail = useCallback(
    async (params?: RemoveUserEmailParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.removeUserEmail(params),
        () => logout(),
        callbacks,
        "Failed to remove user email",
      );
      if (res)
        await refreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks],
  );

  const updateUserPhoneNumber = useCallback(
    async (params: UpdateUserPhoneNumberParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.updateUserPhoneNumber(params),
        () => logout(),
        callbacks,
        "Failed to update user phone number",
      );
      if (res)
        await refreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks],
  );

  const removeUserPhoneNumber = useCallback(
    async (params?: RemoveUserPhoneNumberParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.removeUserPhoneNumber(params),
        () => logout(),
        callbacks,
        "Failed to remove user phone number",
      );
      if (res)
        await refreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks],
  );

  const updateUserName = useCallback(
    async (params: UpdateUserNameParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.updateUserName(params),
        () => logout(),
        callbacks,
        "Failed to update user name",
      );
      if (res)
        await refreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks],
  );

  const addOauthProvider = useCallback(
    async (params: AddOauthProviderParams): Promise<string[]> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.addOauthProvider(params),
        () => logout(),
        callbacks,
        "Failed to add OAuth provider",
      );
      if (res)
        await refreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks],
  );

  const removeOauthProviders = useCallback(
    async (params: RemoveOauthProvidersParams): Promise<string[]> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.removeOauthProviders(params),
        () => logout(),
        callbacks,
        "Failed to remove OAuth providers",
      );
      if (res)
        await refreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks],
  );

  const addPasskey = useCallback(
    async (params?: AddPasskeyParams): Promise<string[]> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.addPasskey(params),
        () => logout(),
        callbacks,
        "Failed to add passkey",
      );
      if (res)
        await refreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks],
  );

  const removePasskeys = useCallback(
    async (params: RemovePasskeyParams): Promise<string[]> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.removePasskeys(params),
        () => logout(),
        callbacks,
        "Failed to remove passkeys",
      );
      if (res)
        await refreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks],
  );

  const createWallet = useCallback(
    async (params: CreateWalletParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.createWallet(params),
        () => logout(),
        callbacks,
        "Failed to create wallet",
      );
      const s = await getSession();
      if (res && s)
        await refreshWallets({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
        });
      return res;
    },
    [client, session, callbacks],
  );

  const createWalletAccounts = useCallback(
    async (params: CreateWalletAccountsParams): Promise<string[]> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.createWalletAccounts(params),
        () => logout(),
        callbacks,
        "Failed to create wallet accounts",
      );
      const s = await getSession();
      if (res && s)
        await refreshWallets({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
        });
      return res;
    },
    [client, session, callbacks],
  );

  const exportWallet = useCallback(
    async (params: ExportWalletParams): Promise<ExportBundle | string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );

      // Default: decrypt unless explicitly disabled
      const shouldDecrypt = params?.decrypt !== false;

      if (!shouldDecrypt) {
        const res = await withTurnkeyErrorHandling(
          () =>
            client.exportWallet({
              walletId: params.walletId,
              targetPublicKey: params.targetPublicKey!,
              ...(params.organizationId && {
                organizationId: params.organizationId,
              }),
              ...(params.stampWith && { stampWith: params.stampWith }),
            }),
          () => logout(),
          callbacks,
          "Failed to export wallet",
        );
        const s = await getSession();
        if (res && s)
          await refreshWallets({
            stampWith: params?.stampWith,
            ...(params?.organizationId && {
              organizationId: params.organizationId,
            }),
          });
        return res;
      }

      // Decrypting path: generate P-256 keypair, export, then decrypt to mnemonic
      try {
        const { privateKey, publicKeyUncompressed } = generateP256KeyPair();
        const targetPublicKey = publicKeyUncompressed;

        const exportParams = {
          walletId: params.walletId,
          targetPublicKey,
          ...(params.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params.stampWith && { stampWith: params.stampWith }),
        };

        const bundle = await withTurnkeyErrorHandling(
          () => client.exportWallet(exportParams),
          () => logout(),
          callbacks,
          "Failed to export wallet",
        );

        const session = await getSession();

        const orgId = session?.organizationId;
        if (!orgId) {
          throw new TurnkeyError(
            "Missing organizationId in session for decryption",
            TurnkeyErrorCodes.INVALID_REQUEST,
          );
        }

        const mnemonic = await decryptExportBundle({
          exportBundle: bundle as string,
          embeddedKey: privateKey,
          organizationId: orgId,
          returnMnemonic: true,
          keyFormat: "HEXADECIMAL",
        });

        return mnemonic;
      } catch (error) {
        throw error;
      }
    },
    [client, session, callbacks],
  );

  const exportPrivateKey = useCallback(
    async (params: ExportPrivateKeyParams): Promise<ExportBundle | string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );

      const shouldDecrypt = params?.decrypt !== false;
      if (!shouldDecrypt) {
        const res = await withTurnkeyErrorHandling(
          () =>
            client.exportPrivateKey({
              privateKeyId: params.privateKeyId,
              targetPublicKey: params.targetPublicKey!,
              ...(params.organizationId && {
                organizationId: params.organizationId,
              }),
              ...(params.stampWith && { stampWith: params.stampWith }),
            }),
          () => logout(),
          callbacks,
          "Failed to export private key",
        );
        return res;
      }

      try {
        const { privateKey, publicKeyUncompressed } = generateP256KeyPair();
        const targetPublicKey = publicKeyUncompressed;

        const exportParams = {
          privateKeyId: params.privateKeyId,
          targetPublicKey,
          ...(params.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params.stampWith && { stampWith: params.stampWith }),
        };

        const bundle = await withTurnkeyErrorHandling(
          () => client.exportPrivateKey(exportParams),
          () => logout(),
          callbacks,
          "Failed to export private key",
        );

        const session = await getSession();
        const orgId = session?.organizationId;
        if (!orgId) {
          throw new TurnkeyError(
            "Missing organizationId in session for decryption",
            TurnkeyErrorCodes.INVALID_REQUEST,
          );
        }

        const rawPrivateKey = await decryptExportBundle({
          exportBundle: bundle as string,
          embeddedKey: privateKey,
          organizationId: orgId,
          returnMnemonic: false,
          keyFormat: "HEXADECIMAL",
        });

        return rawPrivateKey;
      } catch (error) {
        throw error;
      }
    },
    [client, callbacks],
  );

  const exportWalletAccount = useCallback(
    async (
      params: ExportWalletAccountParams,
    ): Promise<ExportBundle | string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );

      const shouldDecrypt = params?.decrypt !== false;
      if (!shouldDecrypt) {
        const res = await withTurnkeyErrorHandling(
          () =>
            client.exportWalletAccount({
              address: params.address,
              targetPublicKey: params.targetPublicKey!,
              ...(params.organizationId && {
                organizationId: params.organizationId,
              }),
              ...(params.stampWith && { stampWith: params.stampWith }),
            }),
          () => logout(),
          callbacks,
          "Failed to export wallet accounts",
        );
        return res;
      }

      try {
        const { privateKey, publicKeyUncompressed } = generateP256KeyPair();
        const targetPublicKey = publicKeyUncompressed;

        const exportParams = {
          address: params.address,
          targetPublicKey,
          ...(params.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params.stampWith && { stampWith: params.stampWith }),
        };

        const bundle = await withTurnkeyErrorHandling(
          () => client.exportWalletAccount(exportParams),
          () => logout(),
          callbacks,
          "Failed to export wallet accounts",
        );

        const session = await getSession();
        const orgId = session?.organizationId;
        if (!orgId) {
          throw new TurnkeyError(
            "Missing organizationId in session for decryption",
            TurnkeyErrorCodes.INVALID_REQUEST,
          );
        }

        const decryptedKey = await decryptExportBundle({
          exportBundle: bundle as string,
          embeddedKey: privateKey,
          organizationId: orgId,
          returnMnemonic: false,
          keyFormat: "HEXADECIMAL",
        });

        return decryptedKey;
      } catch (error) {
        throw error;
      }
    },
    [client, callbacks, masterConfig, session, user],
  );

  const importWallet = useCallback(
    async (params: ImportWalletParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );

      const {
        mnemonic,
        walletName,
        accounts,
        organizationId,
        userId,
        stampWith,
      } = params;

      // Resolve org/user from params or current session
      const currentSession = await getSession();
      const effectiveOrgId = organizationId ?? currentSession?.organizationId;
      const effectiveUserId = userId ?? currentSession?.userId;
      if (!effectiveOrgId || !effectiveUserId) {
        throw new TurnkeyError(
          "Missing organizationId or userId for wallet import",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }

      // Step 1: init import to obtain importBundle
      const initRes = await withTurnkeyErrorHandling(
        () =>
          client.httpClient?.initImportWallet(
            {
              organizationId: effectiveOrgId,
              userId: effectiveUserId,
            },
            stampWith,
          ),
        () => logout(),
        callbacks,
        "Failed to init wallet import",
      );

      const importBundle = initRes?.importBundle;
      if (!importBundle) {
        throw new TurnkeyError(
          "Failed to retrieve import bundle",
          TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
        );
      }

      // Step 2: encrypt mnemonic to encryptedBundle
      const encryptedBundle = await encryptWalletToBundle({
        mnemonic,
        importBundle,
        userId: effectiveUserId,
        organizationId: effectiveOrgId,
      });

      // Step 3: call importWallet with encrypted bundle
      const res = await withTurnkeyErrorHandling(
        () =>
          client.importWallet({
            encryptedBundle,
            walletName,
            ...(accounts && { accounts }),
            organizationId: effectiveOrgId,
            userId: effectiveUserId,
            ...(stampWith && { stampWith }),
          }),
        () => logout(),
        callbacks,
        "Failed to import wallet",
      );

      // Refresh state after import
      if (res)
        await refreshWallets({
          ...(stampWith && { stampWith }),
          organizationId: effectiveOrgId,
          userId: effectiveUserId,
        });
      return res;
    },
    [client, callbacks, masterConfig, session, user],
  );

  const importPrivateKey = useCallback(
    async (params: ImportPrivateKeyParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );

      const {
        privateKey,
        privateKeyName,
        addressFormats,
        curve,
        keyFormat = "HEXADECIMAL",
        organizationId,
        userId,
        stampWith,
      } = params;

      // Resolve org/user
      const currentSession = await getSession();
      const effectiveOrgId = organizationId ?? currentSession?.organizationId;
      const effectiveUserId = userId ?? currentSession?.userId;
      if (!effectiveOrgId || !effectiveUserId) {
        throw new TurnkeyError(
          "Missing organizationId or userId for private key import",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }

      // Init import to get bundle
      const initRes = await withTurnkeyErrorHandling(
        () =>
          client.httpClient?.initImportPrivateKey(
            {
              organizationId: effectiveOrgId,
              userId: effectiveUserId,
            },
            stampWith,
          ),
        () => logout(),
        callbacks,
        "Failed to init private key import",
      );

      const importBundle = initRes?.importBundle;
      if (!importBundle) {
        throw new TurnkeyError(
          "Failed to retrieve import bundle",
          TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
        );
      }

      // Encrypt provided private key to bundle
      const encryptedBundle = await encryptPrivateKeyToBundle({
        privateKey,
        keyFormat,
        importBundle,
        userId: effectiveUserId,
        organizationId: effectiveOrgId,
      });

      // Import
      const res = await withTurnkeyErrorHandling(
        () =>
          client.importPrivateKey({
            encryptedBundle,
            privateKeyName,
            addressFormats,
            curve: curve ?? "CURVE_SECP256K1",
            organizationId: effectiveOrgId,
            userId: effectiveUserId,
            ...(stampWith && { stampWith }),
          }),
        () => logout(),
        callbacks,
        "Failed to import private key",
      );
      return res;
    },
    [client, callbacks, masterConfig, session, user],
  );

  const deleteSubOrganization = useCallback(
    async (
      params?: DeleteSubOrganizationParams,
    ): Promise<TDeleteSubOrganizationResponse> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.deleteSubOrganization(params),
        () => logout(),
        callbacks,
        "Failed to delete sub-organization",
      );
    },
    [client, callbacks, masterConfig, session, user],
  );

  const storeSession = useCallback(
    async (params: StoreSessionParams): Promise<void> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      await withTurnkeyErrorHandling(
        () => client.storeSession(params),
        () => logout(),
        callbacks,
        "Failed to store session",
      );
      const sessionKey = await getActiveSessionKey();
      const session = await getSession({
        ...(sessionKey && { sessionKey }),
      });

      if (session && sessionKey)
        await scheduleSessionExpiration({ sessionKey, expiry: session.expiry });

      const allSessions = await getAllSessions();

      setSession(session);
      setAllSessions(allSessions);
      return;
    },
    [client, callbacks, masterConfig, session, user],
  );

  const clearSession = useCallback(
    async (params?: ClearSessionParams): Promise<void> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      await withTurnkeyErrorHandling(
        async () => client.clearSession(params),
        () => logout(),
        callbacks,
        "Failed to clear session",
      );
      const sessionKey = params?.sessionKey ?? (await getActiveSessionKey());
      if (!sessionKey) return;
      if (!params?.sessionKey) {
        setSession(undefined);
      }
      clearSessionTimeouts([sessionKey]);
      // clear only the cleared session from allSessions
      const newAllSessions = { ...allSessions };
      if (newAllSessions) {
        delete newAllSessions[sessionKey];
      }
      setAllSessions(newAllSessions);
      return;
    },
    [client, callbacks, session, user, masterConfig],
  );

  const clearAllSessions = useCallback(async (): Promise<void> => {
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    setSession(undefined);
    setAllSessions(undefined);
    clearSessionTimeouts();
    return await withTurnkeyErrorHandling(
      () => client.clearAllSessions(),
      () => logout(),
      callbacks,
      "Failed to clear all sessions",
    );
  }, [client, callbacks, session, user, masterConfig]);

  const refreshSession = useCallback(
    async (
      params?: RefreshSessionParams,
    ): Promise<TStampLoginResponse | undefined> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }

      const activeSessionKey = await client.getActiveSessionKey();
      if (!activeSessionKey) {
        throw new TurnkeyError(
          "No active session found.",
          TurnkeyErrorCodes.NO_SESSION_FOUND,
        );
      }

      const sessionKey = params?.sessionKey ?? activeSessionKey;

      const res = await withTurnkeyErrorHandling(
        () => client.refreshSession({ ...params }),
        () => logout(),
        callbacks,
        "Failed to refresh session",
      );
      const session = await getSession({ sessionKey });

      if (session && sessionKey) {
        await scheduleSessionExpiration({
          sessionKey,
          expiry: session.expiry,
          ...(params?.expirationSeconds && {
            expirationSeconds: params?.expirationSeconds,
          }),
        });
      }

      const allSessions = await getAllSessions();
      setSession(session);
      setAllSessions(allSessions);
      return res;
    },
    [client, callbacks, scheduleSessionExpiration, session, user, masterConfig],
  );

  const getSession = useCallback(
    async (params?: GetSessionParams): Promise<Session | undefined> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.getSession(params),
        () => logout(),
        callbacks,
        "Failed to get session",
      );
    },
    [client, callbacks, masterConfig, session, user],
  );

  const getAllSessions = useCallback(async (): Promise<
    Record<string, Session> | undefined
  > => {
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    return withTurnkeyErrorHandling(
      () => client.getAllSessions(),
      () => logout(),
      callbacks,
      "Failed to get all sessions",
    );
  }, [client, callbacks, masterConfig, session, user]);

  const setActiveSession = useCallback(
    async (params: SetActiveSessionParams): Promise<void> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const session = await withTurnkeyErrorHandling(
        () => client.getSession({ sessionKey: params.sessionKey }),
        () => logout(),
        callbacks,
        "Failed to get session",
      );
      const s = await getSession();
      if (!s) {
        throw new TurnkeyError(
          "Session not found.",
          TurnkeyErrorCodes.NOT_FOUND,
        );
      }
      await withTurnkeyErrorHandling(
        () => client.setActiveSession(params),
        () => logout(),
        callbacks,
        "Failed to set active session",
      );
      setSession(session);
      await withTurnkeyErrorHandling(
        async () => {
          await refreshWallets();
          await refreshUser();
        },
        () => logout(),
        callbacks,
        "Failed to refresh data after setting active session",
      );
      return;
    },
    [client, callbacks, session, user, masterConfig],
  );

  const getActiveSessionKey = useCallback(async (): Promise<
    string | undefined
  > => {
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    return withTurnkeyErrorHandling(
      () => client.getActiveSessionKey(),
      () => logout(),
      callbacks,
      "Failed to get active session key",
    );
  }, [client, callbacks, masterConfig, session, user]);

  const clearUnusedKeyPairs = useCallback(async (): Promise<void> => {
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    return withTurnkeyErrorHandling(
      () => client.clearUnusedKeyPairs(),
      () => logout(),
      callbacks,
      "Failed to clear unused key pairs",
    );
  }, [client, callbacks, masterConfig, session, user]);

  const createApiKeyPair = useCallback(
    async (params?: CreateApiKeyPairParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.createApiKeyPair(params),
        () => logout(),
        callbacks,
        "Failed to create API key pair",
      );
    },
    [client, callbacks, session, user, masterConfig],
  );

  const getProxyAuthConfig =
    useCallback(async (): Promise<ProxyTGetWalletKitConfigResponse> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.getProxyAuthConfig(),
        () => logout(),
        callbacks,
        "Failed to get proxy auth config",
      );
    }, [client, callbacks, masterConfig, session, user]);

  const refreshUser = useCallback(
    async (params?: RefreshUserParams): Promise<void> => {
      if (!masterConfig?.autoRefreshManagedState) return;
      const { stampWith, organizationId, userId } = params || {};
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const user = await withTurnkeyErrorHandling(
        () =>
          fetchUser({
            stampWith,
            ...(organizationId && { organizationId }),
            ...(userId && { userId }),
          }),
        () => logout(),
        callbacks,
        "Failed to refresh user",
      );
      if (user) {
        setUser(user);
      }
    },
    [client, callbacks, fetchUser, masterConfig, session, user],
  );

  const refreshWallets = useCallback(
    async (params?: RefreshWalletsParams): Promise<Wallet[]> => {
      if (!masterConfig?.autoRefreshManagedState) return [];

      const { stampWith, organizationId, userId } = params || {};

      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );

      const wallets = await withTurnkeyErrorHandling(
        () =>
          fetchWallets({
            stampWith,
            ...(organizationId && { organizationId }),
            ...(userId && { userId }),
          }),
        () => logout(),
        callbacks,
        "Failed to refresh wallets",
      );
      if (wallets) {
        setWallets(wallets);
      }

      return wallets;
    },
    [client, callbacks, fetchWallets, masterConfig, session, user],
  );

  const handleDiscordOauth = useCallback(
    async (params?: HandleDiscordOauthParams): Promise<void> => {
      const { additionalState: additionalParameters } = params || {};
      const {
        clientId,
        redirectUri,
        appScheme: scheme,
      } = getOauthProviderSettings("discord");
      try {
        if (!masterConfig) {
          throw new TurnkeyError(
            "Config is not ready yet!",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        if (!clientId) {
          throw new TurnkeyError(
            "Discord Client ID is not configured.",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        if (!redirectUri) {
          throw new TurnkeyError(
            "OAuth Redirect URI is not configured.",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        if (!scheme) {
          throw new TurnkeyError(
            "Missing appScheme. Please set auth.oauth.appScheme.",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        // Create key pair and generate nonce
        const publicKey = await createApiKeyPair();
        if (!publicKey) {
          throw new TurnkeyError(
            "Failed to create public key for OAuth.",
            TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
          );
        }
        const nonce = bytesToHex(sha256(publicKey));

        // Generate PKCE challenge pair
        const { verifier, codeChallenge } = await generateChallengePair();
        await AsyncStorage.setItem("discord_verifier", verifier);

        // Create state parameter
        let state = `provider=discord&flow=redirect&publicKey=${encodeURIComponent(publicKey)}&nonce=${nonce}`;
        if (additionalParameters) {
          const extra = Object.entries(additionalParameters)
            .map(
              ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
            )
            .join("&");
          if (extra) state += `&${extra}`;
        }

        // Construct Discord Auth URL
        const discordAuthUrl =
          DISCORD_AUTH_URL +
          `?client_id=${encodeURIComponent(clientId)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&response_type=code` +
          `&code_challenge=${encodeURIComponent(codeChallenge)}` +
          `&code_challenge_method=S256` +
          `&scope=${encodeURIComponent("identify email")}` +
          `&state=${encodeURIComponent(state)}`;

        if (!(await InAppBrowser.isAvailable())) {
          throw new TurnkeyError(
            "InAppBrowser is not available",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        const result = await InAppBrowser.openAuth(discordAuthUrl, scheme, {
          dismissButtonStyle: "cancel",
          animated: true,
          modalPresentationStyle: "fullScreen",
          modalTransitionStyle: "coverVertical",
          modalEnabled: true,
          enableBarCollapsing: false,
          showTitle: true,
          enableUrlBarHiding: true,
          enableDefaultShare: true,
        });

        if (!result || result.type !== "success" || !result.url) {
          throw new TurnkeyError(
            "OAuth flow did not complete successfully",
            TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
          );
        }

        // Extract params from deep link
        const qsIndex = result.url.indexOf("?");
        const queryString =
          qsIndex >= 0 ? result.url.substring(qsIndex + 1) : "";
        const urlParams = new URLSearchParams(queryString);
        const authCode = urlParams.get("code");
        const stateParam = urlParams.get("state");
        const sessionKey = stateParam
          ?.split("&")
          .find((param) => param.startsWith("sessionKey="))
          ?.split("=")[1];

        if (!authCode) {
          throw new TurnkeyError(
            "Missing authorization code from Discord OAuth",
            TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
          );
        }

        const storedVerifier = await AsyncStorage.getItem("discord_verifier");
        if (!storedVerifier) {
          throw new TurnkeyError(
            "Missing PKCE verifier",
            TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
          );
        }

        try {
          const resp = await client?.httpClient?.proxyOAuth2Authenticate({
            provider: "OAUTH2_PROVIDER_DISCORD",
            authCode,
            redirectUri,
            codeVerifier: storedVerifier,
            clientId,
            nonce,
          });

          await AsyncStorage.removeItem("discord_verifier");

          const oidcToken = resp?.oidcToken as string;
          if (!oidcToken) {
            throw new TurnkeyError(
              "Missing oidcToken from OAuth exchange",
              TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
            );
          }

          if (params?.onOauthSuccess) {
            params.onOauthSuccess({
              oidcToken,
              providerName: "discord",
              publicKey,
              ...(sessionKey && { sessionKey }),
            });
            return;
          }

          if (callbacks?.onOauthRedirect) {
            callbacks.onOauthRedirect({
              idToken: oidcToken,
              publicKey,
              ...(sessionKey && { sessionKey }),
            });
            return;
          }

          await completeOauth({
            oidcToken,
            publicKey,
            providerName: "discord",
            ...(sessionKey && { sessionKey }),
          });
          return;
        } finally {
          // Ensure cleanup even on error
          await AsyncStorage.removeItem("discord_verifier");
        }
      } catch (error) {
        throw error;
      }
    },
    [client, callbacks, masterConfig, session, user],
  );

  const handleXOauth = useCallback(
    async (params?: HandleXOauthParams): Promise<void> => {
      const { additionalState: additionalParameters } = params || {};
      const {
        clientId,
        redirectUri,
        appScheme: scheme,
      } = getOauthProviderSettings("x");
      try {
        if (!masterConfig) {
          throw new TurnkeyError(
            "Config is not ready yet!",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        if (!clientId) {
          throw new TurnkeyError(
            "Twitter Client ID is not configured.",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        if (!redirectUri) {
          throw new TurnkeyError(
            "OAuth Redirect URI is not configured.",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        if (!scheme) {
          throw new TurnkeyError(
            "Missing appScheme. Please set auth.oauth.appScheme.",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        const publicKey = await createApiKeyPair();
        if (!publicKey) {
          throw new TurnkeyError(
            "Failed to create public key for OAuth.",
            TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
          );
        }
        const nonce = bytesToHex(sha256(publicKey));

        const { verifier, codeChallenge } = await generateChallengePair();
        await AsyncStorage.setItem("twitter_verifier", verifier);

        let state = `provider=twitter&flow=redirect&publicKey=${encodeURIComponent(publicKey)}&nonce=${nonce}`;
        if (additionalParameters) {
          const extra = Object.entries(additionalParameters)
            .map(
              ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
            )
            .join("&");
          if (extra) state += `&${extra}`;
        }
        const twitterAuthUrl =
          X_AUTH_URL +
          `?client_id=${encodeURIComponent(clientId)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&response_type=code` +
          `&code_challenge=${encodeURIComponent(codeChallenge)}` +
          `&code_challenge_method=S256` +
          `&scope=${encodeURIComponent("tweet.read users.read")}` +
          `&state=${encodeURIComponent(state)}`;

        if (!(await InAppBrowser.isAvailable())) {
          throw new TurnkeyError(
            "InAppBrowser is not available",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        const result = await InAppBrowser.openAuth(twitterAuthUrl, scheme, {
          dismissButtonStyle: "cancel",
          animated: true,
          modalPresentationStyle: "fullScreen",
          modalTransitionStyle: "coverVertical",
          modalEnabled: true,
          enableBarCollapsing: false,
          showTitle: true,
          enableUrlBarHiding: true,
          enableDefaultShare: true,
        });

        if (!result || result.type !== "success" || !result.url) {
          throw new TurnkeyError(
            "OAuth flow did not complete successfully",
            TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
          );
        }

        const qsIndex = result.url.indexOf("?");
        const queryString =
          qsIndex >= 0 ? result.url.substring(qsIndex + 1) : "";
        const urlParams = new URLSearchParams(queryString);
        const authCode = urlParams.get("code");
        const stateParam = urlParams.get("state");
        const sessionKey = stateParam
          ?.split("&")
          .find((param) => param.startsWith("sessionKey="))
          ?.split("=")[1];

        if (!authCode) {
          throw new TurnkeyError(
            "Missing authorization code from Twitter OAuth",
            TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
          );
        }

        const storedVerifier = await AsyncStorage.getItem("twitter_verifier");
        if (!storedVerifier) {
          throw new TurnkeyError(
            "Missing PKCE verifier",
            TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
          );
        }

        try {
          const resp = await client?.httpClient?.proxyOAuth2Authenticate({
            provider: "OAUTH2_PROVIDER_X",
            authCode,
            redirectUri,
            codeVerifier: storedVerifier,
            clientId,
            nonce,
          });

          await AsyncStorage.removeItem("twitter_verifier");

          const oidcToken = resp?.oidcToken as string;
          if (!oidcToken) {
            throw new TurnkeyError(
              "Missing oidcToken from OAuth exchange",
              TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
            );
          }

          if (params?.onOauthSuccess) {
            params.onOauthSuccess({
              oidcToken,
              providerName: "twitter",
              publicKey,
              ...(sessionKey && { sessionKey }),
            });
            return;
          }

          if (callbacks?.onOauthRedirect) {
            callbacks.onOauthRedirect({
              idToken: oidcToken,
              publicKey,
              ...(sessionKey && { sessionKey }),
            });
            return;
          }

          await completeOauth({
            oidcToken,
            publicKey,
            providerName: "twitter",
            ...(sessionKey && { sessionKey }),
          });
          return;
        } finally {
          // Ensure cleanup even on error
          await AsyncStorage.removeItem("twitter_verifier");
        }
      } catch (error) {
        throw error;
      }
    },
    [client, callbacks, masterConfig, session, user],
  );

  const handleGoogleOauth = useCallback(
    async (params?: HandleGoogleOauthParams): Promise<void> => {
      const {} = params || {};
      const {
        clientId,
        redirectUri,
        appScheme: scheme,
      } = getOauthProviderSettings("google");

      try {
        if (!masterConfig) {
          throw new TurnkeyError(
            "Config is not ready yet!",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        if (!clientId) {
          throw new TurnkeyError(
            "Google Client ID is not configured.",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        if (!redirectUri) {
          throw new TurnkeyError(
            "OAuth Redirect URI is not configured.",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        if (!scheme) {
          throw new TurnkeyError(
            "Missing appScheme. Please set auth.oauth.appScheme.",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        const finalRedirectUri = `${redirectUri}?scheme=${encodeURIComponent(scheme)}`;

        // Create key pair and generate nonce
        const publicKey = await createApiKeyPair();
        if (!publicKey) {
          throw new TurnkeyError(
            "Failed to create public key for OAuth.",
            TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
          );
        }
        const nonce = bytesToHex(sha256(publicKey));

        // Build OAuth Origin URL which will redirect to Google
        const oauthUrl =
          TURNKEY_OAUTH_ORIGIN_URL +
          `?provider=google` +
          `&clientId=${encodeURIComponent(clientId)}` +
          `&redirectUri=${encodeURIComponent(finalRedirectUri)}` +
          `&nonce=${encodeURIComponent(nonce)}`;

        if (!(await InAppBrowser.isAvailable())) {
          throw new TurnkeyError(
            "InAppBrowser is not available",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        const result = await InAppBrowser.openAuth(oauthUrl, scheme, {
          dismissButtonStyle: "cancel",
          animated: true,
          modalPresentationStyle: "fullScreen",
          modalTransitionStyle: "coverVertical",
          modalEnabled: true,
          enableBarCollapsing: false,
          showTitle: true,
          enableUrlBarHiding: true,
          enableDefaultShare: true,
        });

        if (!result || result.type !== "success" || !result.url) {
          throw new TurnkeyError(
            "OAuth flow did not complete successfully",
            TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
          );
        }

        // result.url is expected to be like: <scheme>://?id_token=...&state=... (from oauth-redirect)
        const qsIndex = result.url.indexOf("?");
        const queryString =
          qsIndex >= 0 ? result.url.substring(qsIndex + 1) : "";
        const urlParams = new URLSearchParams(queryString);
        const idToken = urlParams.get("id_token");
        const sessionKey = urlParams.get("sessionKey") || undefined;

        if (!idToken) {
          throw new TurnkeyError(
            "oidcToken not found in the response",
            TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
          );
        }

        if (params?.onOauthSuccess) {
          params.onOauthSuccess({
            oidcToken: idToken,
            providerName: "google",
            publicKey,
            ...(sessionKey && { sessionKey }),
          });
          return;
        }

        if (callbacks?.onOauthRedirect) {
          callbacks.onOauthRedirect({
            idToken,
            publicKey,
            ...(sessionKey && { sessionKey }),
          });
          return;
        }

        await completeOauth({
          oidcToken: idToken,
          publicKey,
          providerName: "google",
          ...(sessionKey && { sessionKey }),
        });
        return;
      } catch (error) {
        throw error;
      }
    },
    [client, callbacks, masterConfig, session, user],
  );

  const handleAppleOauth = useCallback(
    async (params?: HandleAppleOauthParams): Promise<void> => {
      const { additionalState: additionalParameters } = params || {};
      const {
        clientId,
        redirectUri,
        appScheme: scheme,
      } = getOauthProviderSettings("apple");

      try {
        if (!masterConfig) {
          throw new TurnkeyError(
            "Config is not ready yet!",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        if (!clientId) {
          throw new TurnkeyError(
            "Apple Client ID is not configured.",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        if (!redirectUri) {
          throw new TurnkeyError(
            "OAuth Redirect URI is not configured.",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        if (!scheme) {
          throw new TurnkeyError(
            "Missing appScheme. Please set auth.oauth.appScheme.",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        const finalRedirectUri = `${redirectUri}?scheme=${encodeURIComponent(scheme)}`;

        // Create key pair and generate nonce
        const publicKey = await createApiKeyPair();
        if (!publicKey) {
          throw new TurnkeyError(
            "Failed to create public key for OAuth.",
            TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
          );
        }
        const nonce = bytesToHex(sha256(publicKey));

        // Create state parameter (parity with web Provider.tsx)
        let state = `provider=apple&flow=redirect&publicKey=${encodeURIComponent(publicKey)}`;
        if (additionalParameters) {
          const extra = Object.entries(additionalParameters)
            .map(
              ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
            )
            .join("&");
          if (extra) state += `&${extra}`;
        }

        // Build OAuth Origin URL which will redirect to Apple
        const oauthUrl =
          TURNKEY_OAUTH_ORIGIN_URL +
          `?provider=apple` +
          `&clientId=${encodeURIComponent(clientId)}` +
          `&redirectUri=${encodeURIComponent(finalRedirectUri)}` +
          `&nonce=${encodeURIComponent(nonce)}` +
          `&state=${encodeURIComponent(state)}`;

        if (!(await InAppBrowser.isAvailable())) {
          throw new TurnkeyError(
            "InAppBrowser is not available",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        const result = await InAppBrowser.openAuth(oauthUrl, scheme, {
          dismissButtonStyle: "cancel",
          animated: true,
          modalPresentationStyle: "fullScreen",
          modalTransitionStyle: "coverVertical",
          modalEnabled: true,
          enableBarCollapsing: false,
          showTitle: true,
          enableUrlBarHiding: true,
          enableDefaultShare: true,
        });

        if (!result || result.type !== "success" || !result.url) {
          throw new TurnkeyError(
            "OAuth flow did not complete successfully",
            TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
          );
        }

        // Extract params from deep link
        const qsIndex = result.url.indexOf("?");
        const queryString =
          qsIndex >= 0 ? result.url.substring(qsIndex + 1) : "";
        const urlParams = new URLSearchParams(queryString);
        const idToken = urlParams.get("id_token");
        const stateParam = urlParams.get("state");
        const sessionKey = stateParam
          ?.split("&")
          .find((param) => param.startsWith("sessionKey="))
          ?.split("=")[1];

        if (!idToken) {
          throw new TurnkeyError(
            "oidcToken not found in the response",
            TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
          );
        }

        if (params?.onOauthSuccess) {
          params.onOauthSuccess({
            oidcToken: idToken,
            providerName: "apple",
            publicKey,
            ...(sessionKey && { sessionKey }),
          });
          return;
        }

        if (callbacks?.onOauthRedirect) {
          callbacks.onOauthRedirect({
            idToken,
            publicKey,
            ...(sessionKey && { sessionKey }),
          });
          return;
        }

        await completeOauth({
          oidcToken: idToken,
          publicKey,
          providerName: "apple",
          ...(sessionKey && { sessionKey }),
        });
        return;
      } catch (error) {
        throw error;
      }
    },
    [client, callbacks, masterConfig, session, user],
  );

  const handleFacebookOauth = useCallback(
    async (params?: HandleFacebookOauthParams): Promise<void> => {
      const { additionalState: additionalParameters } = params || {};
      const {
        clientId,
        redirectUri,
        appScheme: scheme,
      } = getOauthProviderSettings("facebook");

      try {
        if (!masterConfig) {
          throw new TurnkeyError(
            "Config is not ready yet!",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        if (!clientId) {
          throw new TurnkeyError(
            "Facebook Client ID is not configured.",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        if (!redirectUri) {
          throw new TurnkeyError(
            "OAuth Redirect URI is not configured.",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        if (!scheme) {
          throw new TurnkeyError(
            "Missing appScheme. Please set auth.oauth.appScheme.",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        const finalRedirectUri = `${redirectUri}?scheme=${encodeURIComponent(scheme)}`;

        // Create key pair and generate nonce
        const publicKey = await createApiKeyPair();
        if (!publicKey) {
          throw new TurnkeyError(
            "Failed to create public key for OAuth.",
            TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
          );
        }
        const nonce = bytesToHex(sha256(publicKey));

        // Generate PKCE challenge pair
        const { verifier, codeChallenge } = await generateChallengePair();
        await AsyncStorage.setItem("facebook_verifier", verifier);

        // Create state parameter
        let state = `provider=facebook&flow=redirect&publicKey=${encodeURIComponent(publicKey)}`;
        if (additionalParameters) {
          const extra = Object.entries(additionalParameters)
            .map(
              ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
            )
            .join("&");
          if (extra) state += `&${extra}`;
        }

        // Construct Facebook Auth URL
        const facebookAuthUrl =
          TURNKEY_OAUTH_ORIGIN_URL +
          `?provider=facebook` +
          `&clientId=${encodeURIComponent(clientId)}` +
          `&redirectUri=${encodeURIComponent(finalRedirectUri)}` +
          `&codeChallenge=${encodeURIComponent(codeChallenge)}` +
          `&nonce=${encodeURIComponent(nonce)}` +
          `&state=${encodeURIComponent(state)}`;

        if (!(await InAppBrowser.isAvailable())) {
          throw new TurnkeyError(
            "InAppBrowser is not available",
            TurnkeyErrorCodes.INVALID_CONFIGURATION,
          );
        }

        const result = await InAppBrowser.openAuth(facebookAuthUrl, scheme, {
          dismissButtonStyle: "cancel",
          animated: true,
          modalPresentationStyle: "fullScreen",
          modalTransitionStyle: "coverVertical",
          modalEnabled: true,
          enableBarCollapsing: false,
          showTitle: true,
          enableUrlBarHiding: true,
          enableDefaultShare: true,
        });

        if (!result || result.type !== "success" || !result.url) {
          throw new TurnkeyError(
            "OAuth flow did not complete successfully",
            TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
          );
        }

        // Extract params from deep link
        const qsIndex = result.url.indexOf("?");
        const queryString =
          qsIndex >= 0 ? result.url.substring(qsIndex + 1) : "";
        const urlParams = new URLSearchParams(queryString);
        const authCode = urlParams.get("code");
        const stateParam = urlParams.get("state");
        const sessionKey = stateParam
          ?.split("&")
          .find((param) => param.startsWith("sessionKey="))
          ?.split("=")[1];

        if (!authCode) {
          throw new TurnkeyError(
            "Missing authorization code from Facebook OAuth",
            TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
          );
        }

        const storedVerifier = await AsyncStorage.getItem("facebook_verifier");
        if (!storedVerifier) {
          throw new TurnkeyError(
            "Missing PKCE verifier",
            TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
          );
        }

        try {
          const tokenData = await exchangeCodeForToken(
            clientId,
            finalRedirectUri,
            authCode,
            storedVerifier,
          );

          await AsyncStorage.removeItem("facebook_verifier");

          const idToken = tokenData?.id_token as string;
          if (!idToken) {
            throw new TurnkeyError(
              "Missing oidcToken from OAuth exchange",
              TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
            );
          }

          if (params?.onOauthSuccess) {
            params.onOauthSuccess({
              oidcToken: idToken,
              providerName: "facebook",
              publicKey,
              ...(sessionKey && { sessionKey }),
            });
            return;
          }

          if (callbacks?.onOauthRedirect) {
            callbacks.onOauthRedirect({
              idToken,
              publicKey,
              ...(sessionKey && { sessionKey }),
            });
            return;
          }

          await completeOauth({
            oidcToken: idToken,
            publicKey,
            providerName: "facebook",
            ...(sessionKey && { sessionKey }),
          });
          return;
        } finally {
          // Ensure cleanup even on error
          await AsyncStorage.removeItem("facebook_verifier");
        }
      } catch (error) {
        throw error;
      }
    },
    [client, callbacks, masterConfig, session, user],
  );

  useEffect(() => {
    if (proxyAuthConfigRef.current) return;

    // Only fetch the proxy auth config once. Use that to build the master config.
    const fetchProxyAuthConfig = async () => {
      try {
        let proxyAuthConfig: ProxyTGetWalletKitConfigResponse | undefined;
        if (config.authProxyConfigId) {
          // Only fetch the proxy auth config if we have an authProxyId. This is a way for devs to explicitly disable the proxy auth.
          const sanitizedAuthProxyUrl =
            config.authProxyUrl && config.authProxyUrl.trim()
              ? config.authProxyUrl
              : undefined;
          proxyAuthConfig = await getAuthProxyConfig(
            config.authProxyConfigId,
            sanitizedAuthProxyUrl,
          );
          proxyAuthConfigRef.current = proxyAuthConfig;
        }

        setMasterConfig(buildConfig(proxyAuthConfig));
      } catch {
        setClientState(ClientState.Error);
      }
    };

    fetchProxyAuthConfig();
  }, []);

  useEffect(() => {
    // Start the client initialization process once we have the master config.
    if (!masterConfig) return;
    initializeClient();
  }, [masterConfig]);

  useEffect(() => {
    // Handle changes to the passed in config prop -- update the master config
    // If the proxyAuthConfigRef is already set, we don't need to fetch it again. Rebuild the master config with the updated config and stored proxyAuthConfig
    if (!proxyAuthConfigRef.current && config.authProxyConfigId) return;

    setMasterConfig(buildConfig(proxyAuthConfigRef.current ?? undefined));
  }, [config, proxyAuthConfigRef.current]);

  useEffect(() => {
    // authState must be consistent with session state. We found during testing that there are cases where the session and authState can be out of sync in very rare edge cases.
    // This will ensure that they are always in sync and remove the need to setAuthState manually in other places.
    if (session && isValidSession(session)) {
      setAuthState(AuthState.Authenticated);
    } else {
      setAuthState(AuthState.Unauthenticated);
    }
  }, [session]);

  useEffect(() => {
    // After client and config are ready, initialize sessions then mark client ready.
    if (!client || !masterConfig) return;

    clearSessionTimeouts();

    initializeSessions().finally(() => {
      setClientState(ClientState.Ready);
    });

    return () => {
      clearSessionTimeouts();
    };
  }, [client]);

  return (
    <ClientContext.Provider
      value={{
        session,
        allSessions,
        clientState,
        authState,
        user,
        wallets,
        config: masterConfig,
        httpClient: client?.httpClient,
        createHttpClient,
        createPasskey,
        logout,
        loginWithPasskey,
        signUpWithPasskey,
        initOtp,
        verifyOtp,
        loginWithOtp,
        signUpWithOtp,
        completeOtp,
        loginWithOauth,
        signUpWithOauth,
        completeOauth,
        fetchWallets,
        fetchWalletAccounts,
        fetchPrivateKeys,
        refreshWallets,
        signMessage,
        signTransaction,
        signAndSendTransaction,
        fetchUser,
        fetchOrCreateP256ApiKeyUser,
        fetchOrCreatePolicies,
        refreshUser,
        updateUserEmail,
        removeUserEmail,
        updateUserPhoneNumber,
        removeUserPhoneNumber,
        updateUserName,
        addOauthProvider,
        removeOauthProviders,
        addPasskey,
        removePasskeys,
        createWallet,
        createWalletAccounts,
        exportWallet,
        exportPrivateKey,
        exportWalletAccount,
        importWallet,
        importPrivateKey,
        deleteSubOrganization,
        storeSession,
        clearSession,
        clearAllSessions,
        refreshSession,
        getSession,
        getAllSessions,
        setActiveSession,
        clearUnusedKeyPairs,
        getActiveSessionKey,
        createApiKeyPair,
        getProxyAuthConfig,
        handleGoogleOauth,
        handleXOauth,
        handleDiscordOauth,
        handleAppleOauth,
        handleFacebookOauth,
        fetchBootProofForAppProof,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
};
