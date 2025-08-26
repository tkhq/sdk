"use client";

import {
  isValidSession,
  SESSION_WARNING_THRESHOLD_MS,
  useDebouncedCallback,
  useWalletProviderState,
  withTurnkeyErrorHandling,
} from "../../utils";
import {
  Chain,
  CreateSubOrgParams,
  DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
  ExportBundle,
  getAuthProxyConfig,
  OtpType,
  StamperType,
  SwitchableChain,
  TurnkeyClient,
  Wallet,
  WalletAccount,
  WalletInterfaceType,
  WalletProvider,
} from "@turnkey/core";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  TurnkeyError,
  TurnkeyErrorCodes,
  TurnkeyNetworkError,
  SessionType,
  type Session,
  type TDeleteSubOrganizationResponse,
  type TStampLoginResponse,
  type v1AddressFormat,
  type v1Attestation,
  type ProxyTGetWalletKitConfigResponse,
  type v1Pagination,
  type v1SignRawPayloadResult,
  type v1TransactionType,
  type v1User,
  type v1WalletAccountParams,
  type v1PayloadEncoding,
  type v1HashFunction,
  type v1Curve,
} from "@turnkey/sdk-types";
import {
  type TurnkeyCallbacks,
  type TurnkeyProviderConfig,
  AuthState,
  ClientState,
} from "../../types/base";
import { ClientContext } from "./Types";

/**
 * @inline
 */
interface ClientProviderProps {
  children: ReactNode;
  config: TurnkeyProviderConfig;
  callbacks?: TurnkeyCallbacks | undefined;
}

/**
 * Provides Turnkey client authentication, session management, wallet operations, and user profile management
 * for the React Wallet Kit SDK. This context provider encapsulates all core authentication flows (Passkey, Wallet, OTP, OAuth),
 * session lifecycle (creation, expiration, refresh), wallet linking/import/export, and user profile updates (email, phone, name).
 *
 * The provider automatically initializes the Turnkey client, fetches configuration (including proxy auth config if needed),
 * and synchronizes session and authentication state. It exposes a comprehensive set of methods for authentication flows,
 * wallet management, and user profile operations, as well as UI handlers for modal-driven flows.
 *
 * Features:
 * - Passkey, Wallet, OTP (Email/SMS), and OAuth (Google, Apple, Facebook) authentication and sign-up flows.
 * - Session management: creation, expiration scheduling, refresh, and clearing.
 * - Wallet management: fetch, link, import, export, account management.
 * - User profile management: email, phone, name, OAuth provider, and passkey linking/removal.
 * - Modal-driven UI flows for authentication, wallet linking, and profile updates.
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
export const ClientProvider: React.FC<ClientProviderProps> = ({
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

  // we use this custom hook to only update the state if the value is different
  // this is so our useEffect that calls `initializeWalletProviderListeners()` only runs when it needs to
  const [walletProviders, setWalletProviders] = useWalletProviderState();

  const expiryTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
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
    const resolvedMethods = {
      emailOtpAuthEnabled:
        config.auth?.methods?.emailOtpAuthEnabled ??
        proxyAuthConfig?.enabledProviders.includes("email"),
      smsOtpAuthEnabled:
        config.auth?.methods?.smsOtpAuthEnabled ??
        proxyAuthConfig?.enabledProviders.includes("sms"),
      passkeyAuthEnabled:
        config.auth?.methods?.passkeyAuthEnabled ??
        proxyAuthConfig?.enabledProviders.includes("passkey"),
      walletAuthEnabled:
        config.auth?.methods?.walletAuthEnabled ??
        proxyAuthConfig?.enabledProviders.includes("wallet"),
      googleOauthEnabled:
        config.auth?.methods?.googleOauthEnabled ??
        proxyAuthConfig?.enabledProviders.includes("google"),
      appleOauthEnabled:
        config.auth?.methods?.appleOauthEnabled ??
        proxyAuthConfig?.enabledProviders.includes("apple"),
      facebookOauthEnabled:
        config.auth?.methods?.facebookOauthEnabled ??
        proxyAuthConfig?.enabledProviders.includes("facebook"),
    };

    // Set a default ordering for the oAuth methods
    const oauthOrder =
      config.auth?.oauthOrder ??
      (["google", "apple", "facebook"] as const).filter(
        (provider) => resolvedMethods[`${provider}OauthEnabled` as const],
      );

    // Set a default ordering for the overall auth methods
    const methodOrder =
      config.auth?.methodOrder ??
      ([
        oauthOrder.length > 0 ? "socials" : null,
        resolvedMethods.emailOtpAuthEnabled ? "email" : null,
        resolvedMethods.smsOtpAuthEnabled ? "sms" : null,
        resolvedMethods.passkeyAuthEnabled ? "passkey" : null,
        resolvedMethods.walletAuthEnabled ? "wallet" : null,
      ].filter(Boolean) as Array<
        "socials" | "email" | "sms" | "passkey" | "wallet"
      >);

    return {
      ...config,

      // Overrides:
      auth: {
        ...config.auth,
        methods: resolvedMethods,
        oauthConfig: {
          ...config.auth?.oauthConfig,
          openOauthInPage: config.auth?.oauthConfig?.openOauthInPage,
        },
        sessionExpirationSeconds: proxyAuthConfig?.sessionExpirationSeconds,
        methodOrder,
        oauthOrder,
        autoRefreshSession: config.auth?.autoRefreshSession ?? true,
      },
      walletConfig: {
        ...config.walletConfig,
        features: {
          ...config.walletConfig?.features,
          auth:
            // If walletAuthEnabled is not set, default to true. Wallet auth can be enabled/disabled in the dashboard or by explicitly changing the walletAuthEnabled / walletConfig auth feature.
            resolvedMethods.walletAuthEnabled ??
            config.walletConfig?.features?.auth ??
            true,
          connecting: config.walletConfig?.features?.connecting ?? true, // Default connecting to true if not set. We don't care about auth settings here.
        },
        chains: {
          ...config.walletConfig?.chains,
          ethereum: {
            ...config.walletConfig?.chains?.ethereum,
            // keep user's value if provided; default only when undefined
            native: config.walletConfig?.chains?.ethereum?.native ?? true,
          },
          solana: {
            ...config.walletConfig?.chains?.solana,
            // keep user's value if provided; default only when undefined
            native: config.walletConfig?.chains?.solana?.native ?? true,
          },
        },
      },
      importIframeUrl: config.importIframeUrl ?? "https://import.turnkey.com",
      exportIframeUrl: config.exportIframeUrl ?? "https://export.turnkey.com",
    } as TurnkeyProviderConfig;
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

        // Define passkey and wallet config here. If we don't pass it into the client, Mr. Client will assume that we don't want to use passkeys/wallets and not create the stamper!
        passkeyConfig: {
          rpId: masterConfig.passkeyConfig?.rpId,
          timeout: masterConfig.passkeyConfig?.timeout || 60000, // 60 seconds
          userVerification:
            masterConfig.passkeyConfig?.userVerification || "preferred",
          allowCredentials: masterConfig.passkeyConfig?.allowCredentials || [],
        },
        walletConfig: {
          features: {
            ...masterConfig.walletConfig?.features,
          },
          chains: { ...masterConfig.walletConfig?.chains },
          ...(masterConfig.walletConfig?.walletConnect && {
            walletConnect: masterConfig.walletConfig.walletConnect,
          }),
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
          const session = allLocalStorageSessions?.[sessionKey];
          if (!isValidSession(session)) {
            await clearSession({ sessionKey });
            if (sessionKey === (await getActiveSessionKey())) {
              setSession(undefined);
            }
            delete allLocalStorageSessions[sessionKey];
            return;
          }

          scheduleSessionExpiration({
            sessionKey,
            expiry: session!.expiry,
          });
        }),
      );

      setAllSessions(allLocalStorageSessions || undefined);
      const activeSessionKey = await client?.getActiveSessionKey();
      if (activeSessionKey) {
        // If we have an active session key, set
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
   * Attach listeners for connected wallet providers so we can refresh state on changes.
   *
   * - Ethereum: listens for disconnect and chain switches to trigger a refresh.
   * - Solana: listens for disconnect via Wallet Standard `change` events to trigger a refresh.
   * - WalletConnect: listens for disconnect via our custom wrapper’s `change` event to trigger a refresh.
   *
   * Notes:
   * - Only providers that are connected are bound.
   * - WalletConnect is excluded from the “native” paths and handled via its unified `change` event.
   *
   * @param walletProviders - Discovered providers; only connected ones are bound.
   * @param onWalletsChanged - Invoked when a relevant provider event occurs.
   * @returns Cleanup function that removes all listeners registered by this call.
   */
  async function initializeWalletProviderListeners(
    walletProviders: WalletProvider[],
    onWalletsChanged: () => void,
  ): Promise<() => void> {
    if (walletProviders.length === 0) return () => {};

    const cleanups: Array<() => void> = [];

    // we only want to initialize these listeners for connected walletProviders
    const nativeOnly = (provider: WalletProvider) =>
      provider.interfaceType !== WalletInterfaceType.WalletConnect;

    const ethProviders = masterConfig?.walletConfig?.chains.ethereum?.native
      ? walletProviders.filter(
          (provider) =>
            provider.chainInfo.namespace === Chain.Ethereum &&
            nativeOnly(provider) &&
            provider.connectedAddresses.length > 0,
        )
      : [];

    const solProviders = masterConfig?.walletConfig?.chains.solana?.native
      ? walletProviders.filter(
          (provider) =>
            provider.chainInfo.namespace === Chain.Solana &&
            nativeOnly(provider) &&
            provider.connectedAddresses.length > 0,
        )
      : [];

    // we exclude WalletConnect from the native event wiring
    // this is because WC is handled separately with a custom wrapper’s
    //  `change` event
    const wcProviders = walletProviders.filter(
      (p) =>
        p.interfaceType === WalletInterfaceType.WalletConnect &&
        p.connectedAddresses.length > 0,
    );

    function attachEthereumListeners(
      provider: any,
      onWalletsChanged: () => void,
    ) {
      if (typeof provider.on !== "function") return;

      const handleChainChanged = (_chainId: string) => onWalletsChanged();
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) onWalletsChanged();
      };
      const handleDisconnect = () => onWalletsChanged();

      provider.on("chainChanged", handleChainChanged);
      provider.on("accountsChanged", handleAccountsChanged);
      provider.on("disconnect", handleDisconnect);

      return () => {
        provider.removeListener("chainChanged", handleChainChanged);
        provider.removeListener("accountsChanged", handleAccountsChanged);
        provider.removeListener("disconnect", handleDisconnect);
      };
    }

    function attachSolanaListeners(
      provider: any,
      onWalletsChanged: () => void,
    ) {
      const cleanups: Array<() => void> = [];

      const walletEvents = provider?.features?.["standard:events"];
      if (walletEvents?.on) {
        const offChange = walletEvents.on("change", (_evt: any) => {
          onWalletsChanged();
        });
        cleanups.push(offChange);
      }

      return () => cleanups.forEach((fn) => fn());
    }

    ethProviders.forEach((p) => {
      const cleanup = attachEthereumListeners(
        (p as any).provider,
        onWalletsChanged,
      );
      if (cleanup) cleanups.push(cleanup);
    });

    solProviders.forEach((p) => {
      const cleanup = attachSolanaListeners(
        (p as any).provider,
        onWalletsChanged,
      );
      if (cleanup) cleanups.push(cleanup);
    });

    wcProviders.forEach((p) => {
      const standardEvents = (p as any).provider?.features?.["standard:events"];
      if (standardEvents?.on) {
        const unsubscribe = standardEvents.on("change", onWalletsChanged);
        cleanups.push(unsubscribe);
      }
    });

    return () => {
      cleanups.forEach((remove) => remove());
    };
  }

  /**
   * @internal
   * Schedules a session expiration and warning timeout for the given session key.
   *
   * - This function sets up two timeouts: one for warning before the session expires and another to expire the session.
   * - The warning timeout is set to trigger before the session expires, allowing for actions like refreshing the session.
   * - The expiration timeout clears the session and triggers any necessary callbacks.
   *
   * @param params.sessionKey - The key of the session to schedule expiration for.
   * @param params.expiry - The expiration time in seconds for the session.
   * @throws {TurnkeyError} If an error occurs while scheduling the session expiration.
   */
  async function scheduleSessionExpiration(params: {
    sessionKey: string;
    expiry: number;
  }) {
    const { sessionKey, expiry } = params;

    try {
      // Clear any existing timeout for this session key
      if (expiryTimeoutsRef.current[sessionKey]) {
        clearTimeout(expiryTimeoutsRef.current[sessionKey]);
        delete expiryTimeoutsRef.current[sessionKey];
      }

      if (expiryTimeoutsRef.current[`${sessionKey}-warning`]) {
        clearTimeout(expiryTimeoutsRef.current[`${sessionKey}-warning`]);
        delete expiryTimeoutsRef.current[`${sessionKey}-warning`];
      }

      const timeUntilExpiry = expiry * 1000 - Date.now();

      const beforeExpiry = async () => {
        const activeSession = await getSession();
        if (!activeSession && expiryTimeoutsRef.current[sessionKey]) {
          clearTimeout(expiryTimeoutsRef.current[`${sessionKey}-warning`]);
          expiryTimeoutsRef.current[`${sessionKey}-warning`] = setTimeout(
            beforeExpiry,
            10000,
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
        setAllSessions((prevSessions) => {
          if (!prevSessions) return prevSessions;
          const newSessions = { ...prevSessions };
          delete newSessions[sessionKey];
          return newSessions;
        });

        await clearSession({ sessionKey });

        delete expiryTimeoutsRef.current[sessionKey];
        delete expiryTimeoutsRef.current[`${sessionKey}-warning`];

        await logout();
      };

      if (timeUntilExpiry <= SESSION_WARNING_THRESHOLD_MS) {
        beforeExpiry();
      } else {
        expiryTimeoutsRef.current[`${sessionKey}-warning`] = setTimeout(
          beforeExpiry,
          timeUntilExpiry - SESSION_WARNING_THRESHOLD_MS,
        );
      }

      expiryTimeoutsRef.current[sessionKey] = setTimeout(
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
   * Clears all scheduled session expiration and warning timeouts for the client.
   *
   * - This function removes all active session expiration and warning timeouts managed by the provider.
   * - It is called automatically when sessions are re-initialized or on logout to prevent memory leaks and ensure no stale timeouts remain.
   * - All timeouts stored in `expiryTimeoutsRef` are cleared and the reference is reset.
   *
   * @throws {TurnkeyError} If an error occurs while clearing the timeouts.
   */
  function clearSessionTimeouts() {
    try {
      Object.values(expiryTimeoutsRef.current).forEach((timeout) => {
        clearTimeout(timeout);
      });
      expiryTimeoutsRef.current = {};
    } catch (error) {
      if (
        error instanceof TurnkeyError ||
        error instanceof TurnkeyNetworkError
      ) {
        callbacks?.onError?.(error);
      } else {
        callbacks?.onError?.(
          new TurnkeyError(
            `Failed to clear session timeouts`,
            TurnkeyErrorCodes.CLEAR_SESSION_TIMEOUTS_ERROR,
            error,
          ),
        );
      }
    }
  }

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
  const handlePostAuth = async () => {
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
   * - It clears all scheduled session expiration and warning timeouts to prevent memory leaks.
   * - It resets the session state, removes all session and user data from memory, and clears the wallets list.
   * - This ensures that all sensitive information is removed from the provider state after logout.
   * - Called internally after logout or when all sessions are cleared.
   *
   * @returns void
   * @throws {TurnkeyError} If there is an error during the post-logout process.
   */
  const handlePostLogout = () => {
    try {
      clearSessionTimeouts();
      setSession(undefined);
      setAllSessions(undefined);
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
    async (params?: {
      name?: string;
      displayName?: string;
      stampWith?: StamperType | undefined;
    }): Promise<{ attestation: v1Attestation; encodedChallenge: string }> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      return withTurnkeyErrorHandling(
        () => client.createPasskey({ ...params }),
        callbacks,
        "Failed to create passkey",
      );
    },
    [client, callbacks],
  );

  const logout: (params?: { sessionKey?: string }) => Promise<void> =
    useCallback(
      async (params?: { sessionKey?: string }): Promise<void> => {
        if (!client) {
          throw new TurnkeyError(
            "Client is not initialized.",
            TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
          );
        }

        await withTurnkeyErrorHandling(
          () => client.logout(params),
          callbacks,
          "Failed to logout",
        );
        handlePostLogout();

        return;
      },
      [client, callbacks],
    );

  const loginWithPasskey = useCallback(
    async (params?: {
      publicKey?: string;
      sessionKey?: string;
    }): Promise<string> => {
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
        callbacks,
        "Failed to login with passkey",
      );
      if (res) {
        await handlePostAuth();
      }
      return res;
    },
    [client, callbacks],
  );

  const signUpWithPasskey = useCallback(
    async (params?: {
      createSubOrgParams?: CreateSubOrgParams;
      sessionKey?: string;
      passkeyDisplayName?: string;
    }): Promise<string> => {
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

      const websiteName = window.location.hostname;
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
        callbacks,
        "Failed to sign up with passkey",
      );
      if (res) {
        await handlePostAuth();
      }
      return res;
    },
    [client, callbacks],
  );

  const getWalletProviders = useCallback(
    async (chain?: Chain): Promise<WalletProvider[]> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      const newProviders = await client.getWalletProviders(chain);

      // we update state with the latest providers
      // we keep this state so that initializeWalletProviderListeners() re-runs
      // whenever the list of connected providers changes
      // this ensures we attach disconnect listeners for each connected provider
      setWalletProviders(newProviders);

      return newProviders;
    },
    [client, callbacks],
  );

  const connectWalletAccount = useCallback(
    async (walletProvider: WalletProvider): Promise<void> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      await client.connectWalletAccount(walletProvider);

      // this will update our walletProvider state
      await refreshWallets();
    },
    [client, callbacks],
  );

  const disconnectWalletAccount = useCallback(
    async (walletProvider: WalletProvider): Promise<void> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      await client.disconnectWalletAccount(walletProvider);

      // we only refresh the wallets if:
      // 1. there is an active session. This is needed because for WalletConnect
      //    you can unlink a wallet before actually being logged in
      //
      // 2. it was a WalletConnect provider that we just disconnected. Since
      //    native providers emit a disconnect event which will already refresh
      //    the wallets. This event is triggered in `initializeWalletProviderListeners()`
      if (
        session &&
        walletProvider.interfaceType === WalletInterfaceType.WalletConnect
      ) {
        // this will update our walletProvider state
        await refreshWallets();
      }
    },
    [client, callbacks],
  );

  const switchWalletAccountChain = useCallback(
    async (params: {
      walletAccount: WalletAccount;
      chainOrId: string | SwitchableChain;
    }): Promise<void> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      await client.switchWalletAccountChain({ ...params, walletProviders });
    },
    [client, callbacks],
  );

  const loginWithWallet = useCallback(
    async (params: {
      walletProvider: WalletProvider;
      sessionType?: SessionType;
      publicKey?: string;
      sessionKey?: string;
    }): Promise<string> => {
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
        () => client.loginWithWallet({ ...params, expirationSeconds }),
        callbacks,
        "Failed to login with wallet",
      );
      if (res) {
        await handlePostAuth();
      }
      return res;
    },
    [client, callbacks],
  );

  const signUpWithWallet = useCallback(
    async (params: {
      walletProvider: WalletProvider;
      createSubOrgParams?: CreateSubOrgParams;
      sessionType?: SessionType;
      sessionKey?: string;
    }): Promise<string> => {
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
        masterConfig.auth?.createSuborgParams?.walletAuth;
      params =
        createSubOrgParams !== undefined
          ? { ...params, createSubOrgParams }
          : { ...params };

      const expirationSeconds =
        masterConfig?.auth?.sessionExpirationSeconds ??
        DEFAULT_SESSION_EXPIRATION_IN_SECONDS;
      const res = await withTurnkeyErrorHandling(
        () => client.signUpWithWallet({ ...params, expirationSeconds }),
        callbacks,
        "Failed to sign up with wallet",
      );
      if (res) {
        await handlePostAuth();
      } else {
      }
      return res;
    },
    [client, callbacks, masterConfig],
  );

  const loginOrSignupWithWallet = useCallback(
    async (params: {
      walletProvider: WalletProvider;
      createSubOrgParams?: CreateSubOrgParams;
      sessionKey?: string;
      expirationSeconds?: string;
    }): Promise<string> => {
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
        masterConfig.auth?.createSuborgParams?.walletAuth;
      params =
        createSubOrgParams !== undefined
          ? { ...params, createSubOrgParams }
          : { ...params };

      const expirationSeconds =
        masterConfig?.auth?.sessionExpirationSeconds ??
        DEFAULT_SESSION_EXPIRATION_IN_SECONDS;
      const res = await withTurnkeyErrorHandling(
        () => client.loginOrSignupWithWallet({ ...params, expirationSeconds }),
        callbacks,
        "Failed to login or sign up with wallet",
      );
      if (res) {
        await handlePostAuth();
      } else {
      }
      return res;
    },
    [client, callbacks, masterConfig],
  );

  const initOtp = useCallback(
    async (params: { otpType: OtpType; contact: string }): Promise<string> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      return withTurnkeyErrorHandling(
        () => client.initOtp(params),
        callbacks,
        "Failed to initialize OTP",
      );
    },
    [client, callbacks],
  );

  const verifyOtp = useCallback(
    async (params: {
      otpId: string;
      otpCode: string;
      contact: string;
      otpType: OtpType;
    }): Promise<{ subOrganizationId: string; verificationToken: string }> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      return withTurnkeyErrorHandling(
        () => client.verifyOtp(params),
        callbacks,
        "Failed to verify OTP",
      );
    },
    [client, callbacks],
  );

  const loginWithOtp = useCallback(
    async (params: {
      verificationToken: string;
      publicKey?: string;
      invalidateExisting?: boolean;
      sessionKey?: string;
    }): Promise<string> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }

      const res = await withTurnkeyErrorHandling(
        () => client.loginWithOtp(params),
        callbacks,
        "Failed to login with OTP",
      );
      if (res) {
        await handlePostAuth();
      } else {
      }
      return res;
    },
    [client, callbacks],
  );

  const signUpWithOtp = useCallback(
    async (params: {
      verificationToken: string;
      contact: string;
      otpType: OtpType;
      createSubOrgParams?: CreateSubOrgParams;
      sessionKey?: string;
    }): Promise<string> => {
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
        callbacks,
        "Failed to sign up with OTP",
      );
      if (res) {
        await handlePostAuth();
      } else {
      }
      return res;
    },
    [client, callbacks, masterConfig],
  );

  const completeOtp = useCallback(
    async (params: {
      otpId: string;
      otpCode: string;
      contact: string;
      otpType: OtpType;
      publicKey?: string;
      invalidateExisting?: boolean;
      sessionKey?: string;
      createSubOrgParams?: CreateSubOrgParams;
    }): Promise<string> => {
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
        callbacks,
        "Failed to complete OTP",
      );
      if (res) {
        await handlePostAuth();
      } else {
      }
      return res;
    },
    [client, callbacks, masterConfig],
  );

  const completeOauth = useCallback(
    async (params: {
      oidcToken: string;
      publicKey: string;
      providerName?: string;
      sessionKey?: string;
      invalidateExisting?: boolean;
      createSubOrgParams?: CreateSubOrgParams;
    }): Promise<string> => {
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
        callbacks,
        "Failed to complete OAuth",
      );
      if (res) {
        await handlePostAuth();
      } else {
      }
      return res;
    },
    [client, callbacks, masterConfig],
  );

  const loginWithOauth = useCallback(
    async (params: {
      oidcToken: string;
      publicKey: string;
      invalidateExisting?: boolean;
      sessionKey?: string;
    }): Promise<string> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }

      const res = await withTurnkeyErrorHandling(
        () => client.loginWithOauth(params),
        callbacks,
        "Failed to login with OAuth",
      );
      if (res) {
        await handlePostAuth();
      } else {
      }
      return res;
    },
    [client, callbacks],
  );

  const signUpWithOauth = useCallback(
    async (params: {
      oidcToken: string;
      publicKey: string;
      providerName: string;
      createSubOrgParams?: CreateSubOrgParams;
      sessionKey?: string;
    }): Promise<string> => {
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
        callbacks,
        "Failed to sign up with OAuth",
      );
      if (res) {
        await handlePostAuth();
      }
      return res;
    },
    [client, callbacks, masterConfig],
  );

  const fetchWallets = useCallback(
    async (params?: {
      walletProviders?: WalletProvider[] | undefined;
      stampWith?: StamperType | undefined;
    }): Promise<Wallet[]> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      return withTurnkeyErrorHandling(
        () => client.fetchWallets(params),
        callbacks,
        "Failed to fetch wallets",
      );
    },
    [client, callbacks],
  );

  const fetchWalletAccounts = useCallback(
    async (params: {
      wallet: Wallet;
      walletProviders?: WalletProvider[];
      paginationOptions?: v1Pagination;
      stampWith?: StamperType | undefined;
    }): Promise<WalletAccount[]> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      return withTurnkeyErrorHandling(
        () => client.fetchWalletAccounts(params),
        callbacks,
        "Failed to fetch wallet accounts",
      );
    },
    [client, callbacks],
  );

  const signMessage = useCallback(
    async (params: {
      message: string;
      walletAccount: WalletAccount;
      encoding?: v1PayloadEncoding;
      hashFunction?: v1HashFunction;
      stampWith?: StamperType | undefined;
      addEthereumPrefix?: boolean;
    }): Promise<v1SignRawPayloadResult> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.signMessage(params),
        callbacks,
        "Failed to sign message",
      );
    },
    [client, callbacks],
  );

  const signTransaction = useCallback(
    async (params: {
      unsignedTransaction: string;
      transactionType: v1TransactionType;
      walletAccount: WalletAccount;
      stampWith?: StamperType | undefined;
    }): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.signTransaction(params),
        callbacks,
        "Failed to sign transaction",
      );
    },
    [client, callbacks],
  );

  const signAndSendTransaction = useCallback(
    async (params: {
      unsignedTransaction: string;
      transactionType: v1TransactionType;
      walletAccount: WalletAccount;
      rpcUrl?: string;
      stampWith?: StamperType | undefined;
    }): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.signAndSendTransaction(params),
        callbacks,
        "Failed to sign transaction",
      );
    },
    [client, callbacks],
  );

  const fetchUser = useCallback(
    async (params?: {
      organizationId?: string;
      userId?: string;
      stampWith?: StamperType | undefined;
    }): Promise<v1User> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.fetchUser(params),
        callbacks,
        "Failed to fetch user",
      );
    },
    [client, callbacks],
  );

  const updateUserEmail = useCallback(
    async (params: {
      email: string;
      verificationToken?: string;
      userId?: string;
      stampWith?: StamperType | undefined;
    }): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.updateUserEmail(params),
        callbacks,
        "Failed to update user email",
      );
      if (res) await refreshUser({ stampWith: params?.stampWith });
      return res;
    },
    [client, callbacks],
  );

  const removeUserEmail = useCallback(
    async (params?: {
      userId?: string;
      stampWith?: StamperType | undefined;
    }): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.removeUserEmail(params),
        callbacks,
        "Failed to remove user email",
      );
      if (res) await refreshUser({ stampWith: params?.stampWith });
      return res;
    },
    [client, callbacks],
  );

  const updateUserPhoneNumber = useCallback(
    async (params: {
      phoneNumber: string;
      verificationToken?: string;
      userId?: string;
      stampWith?: StamperType | undefined;
    }): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.updateUserPhoneNumber(params),
        callbacks,
        "Failed to update user phone number",
      );
      if (res) await refreshUser({ stampWith: params?.stampWith });
      return res;
    },
    [client, callbacks],
  );

  const removeUserPhoneNumber = useCallback(
    async (params?: {
      userId?: string;
      stampWith?: StamperType | undefined;
    }): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.removeUserPhoneNumber(params),
        callbacks,
        "Failed to remove user phone number",
      );
      if (res) await refreshUser({ stampWith: params?.stampWith });
      return res;
    },
    [client, callbacks],
  );

  const updateUserName = useCallback(
    async (params: {
      userName: string;
      userId?: string;
      stampWith?: StamperType | undefined;
    }): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.updateUserName(params),
        callbacks,
        "Failed to update user name",
      );
      if (res) await refreshUser({ stampWith: params?.stampWith });
      return res;
    },
    [client, callbacks],
  );

  const addOauthProvider = useCallback(
    async (params: {
      providerName: string;
      oidcToken: string;
      userId?: string;
      stampWith?: StamperType | undefined;
    }): Promise<string[]> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.addOauthProvider(params),
        callbacks,
        "Failed to add OAuth provider",
      );
      if (res) await refreshUser({ stampWith: params?.stampWith });
      return res;
    },
    [client, callbacks],
  );

  const removeOauthProviders = useCallback(
    async (params: {
      providerIds: string[];
      userId?: string;
      stampWith?: StamperType | undefined;
    }): Promise<string[]> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.removeOauthProviders(params),
        callbacks,
        "Failed to remove OAuth providers",
      );
      if (res) await refreshUser({ stampWith: params?.stampWith });
      return res;
    },
    [client, callbacks],
  );

  const addPasskey = useCallback(
    async (params?: {
      name?: string;
      displayName?: string;
      userId?: string;
      stampWith?: StamperType | undefined;
    }): Promise<string[]> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.addPasskey(params),
        callbacks,
        "Failed to add passkey",
      );
      if (res) await refreshUser({ stampWith: params?.stampWith });
      return res;
    },
    [client, callbacks],
  );

  const removePasskeys = useCallback(
    async (params: {
      authenticatorIds: string[];
      userId?: string;
      stampWith?: StamperType | undefined;
    }): Promise<string[]> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.removePasskeys(params),
        callbacks,
        "Failed to remove passkeys",
      );
      if (res) await refreshUser({ stampWith: params?.stampWith });
      return res;
    },
    [client, callbacks],
  );

  const createWallet = useCallback(
    async (params: {
      walletName: string;
      accounts?: v1WalletAccountParams[] | v1AddressFormat[];
      organizationId?: string;
      mnemonicLength?: number;
      stampWith?: StamperType | undefined;
    }): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.createWallet(params),
        callbacks,
        "Failed to create wallet",
      );
      if (res) await refreshWallets({ stampWith: params?.stampWith });
      return res;
    },
    [client, callbacks],
  );

  const createWalletAccounts = useCallback(
    async (params: {
      accounts: v1WalletAccountParams[] | v1AddressFormat[];
      walletId: string;
      organizationId?: string;
      stampWith?: StamperType | undefined;
    }): Promise<string[]> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.createWalletAccounts(params),
        callbacks,
        "Failed to create wallet accounts",
      );
      if (res) await refreshWallets({ stampWith: params?.stampWith });
      return res;
    },
    [client, callbacks],
  );

  const exportWallet = useCallback(
    async (params: {
      walletId: string;
      targetPublicKey: string;
      organizationId?: string;
      stampWith?: StamperType | undefined;
    }): Promise<ExportBundle> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.exportWallet(params),
        callbacks,
        "Failed to export wallet",
      );
      if (res) await refreshWallets({ stampWith: params?.stampWith });
      return res;
    },
    [client, callbacks],
  );

  const exportPrivateKey = useCallback(
    async (params: {
      privateKeyId: string;
      targetPublicKey: string;
      organizationId?: string;
      stampWith?: StamperType | undefined;
    }): Promise<ExportBundle> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.exportPrivateKey(params),
        callbacks,
        "Failed to export private key",
      );
      return res;
    },
    [client, callbacks],
  );

  const exportWalletAccount = useCallback(
    async (params: {
      address: string;
      targetPublicKey: string;
      organizationId?: string;
      stampWith?: StamperType | undefined;
    }): Promise<ExportBundle> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.exportWalletAccount(params),
        callbacks,
        "Failed to export wallet accounts",
      );
      if (res) await refreshWallets({ stampWith: params?.stampWith });
      return res;
    },
    [client, callbacks],
  );

  const importWallet = useCallback(
    async (params: {
      encryptedBundle: string;
      walletName: string;
      accounts?: v1WalletAccountParams[];
      userId?: string;
      stampWith?: StamperType | undefined;
    }): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.importWallet(params),
        callbacks,
        "Failed to import wallet",
      );
      if (res) await refreshWallets({ stampWith: params?.stampWith });
      return res;
    },
    [client, callbacks],
  );

  const importPrivateKey = useCallback(
    async (params: {
      encryptedBundle: string;
      privateKeyName: string;
      curve: v1Curve;
      addressFormats: v1AddressFormat[];
      userId?: string;
      stampWith?: StamperType | undefined;
    }): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.importPrivateKey(params),
        callbacks,
        "Failed to import private key",
      );
      return res;
    },
    [client, callbacks],
  );

  const deleteSubOrganization = useCallback(
    async (params?: {
      deleteWithoutExport?: boolean;
      stampWith?: StamperType | undefined;
    }): Promise<TDeleteSubOrganizationResponse> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.deleteSubOrganization(params),
        callbacks,
        "Failed to delete sub-organization",
      );
    },
    [client, callbacks],
  );

  const storeSession = useCallback(
    async (params: {
      sessionToken: string;
      sessionKey?: string;
    }): Promise<void> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      await withTurnkeyErrorHandling(
        () => client.storeSession(params),
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
    [client, callbacks],
  );

  const clearSession = useCallback(
    async (params?: { sessionKey?: string }): Promise<void> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      await withTurnkeyErrorHandling(
        () => client.clearSession(params),
        callbacks,
        "Failed to clear session",
      );
      const session = await getSession();
      const allSessions = await getAllSessions();
      setSession(session);
      setAllSessions(allSessions);
      return;
    },
    [client, callbacks],
  );

  const clearAllSessions = useCallback(async (): Promise<void> => {
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    setSession(undefined);
    setAllSessions(undefined);
    return await withTurnkeyErrorHandling(
      () => client.clearAllSessions(),
      callbacks,
      "Failed to clear all sessions",
    );
  }, [client, callbacks]);

  const refreshSession = useCallback(
    async (params?: {
      expirationSeconds?: string;
      publicKey?: string;
      sessionKey?: string;
      invalidateExisitng?: boolean;
      stampWith?: StamperType | undefined;
    }): Promise<TStampLoginResponse | undefined> => {
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
    [client, callbacks],
  );

  const getSession = useCallback(
    async (params?: { sessionKey?: string }): Promise<Session | undefined> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.getSession(params),
        callbacks,
        "Failed to get session",
      );
    },
    [client, callbacks],
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
      callbacks,
      "Failed to get all sessions",
    );
  }, [client, callbacks]);

  const setActiveSession = useCallback(
    async (params: { sessionKey: string }): Promise<void> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const session = await withTurnkeyErrorHandling(
        () => client.getSession({ sessionKey: params.sessionKey }),
        callbacks,
        "Failed to get session",
      );
      if (!session) {
        throw new TurnkeyError(
          "Session not found.",
          TurnkeyErrorCodes.NOT_FOUND,
        );
      }
      await withTurnkeyErrorHandling(
        () => client.setActiveSession(params),
        callbacks,
        "Failed to set active session",
      );
      setSession(session);
      return;
    },
    [client, callbacks],
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
      callbacks,
      "Failed to get active session key",
    );
  }, [client, callbacks]);

  const clearUnusedKeyPairs = useCallback(async (): Promise<void> => {
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    return withTurnkeyErrorHandling(
      () => client.clearUnusedKeyPairs(),
      callbacks,
      "Failed to clear unused key pairs",
    );
  }, [client, callbacks]);

  const createApiKeyPair = useCallback(
    async (params?: {
      externalKeyPair?:
        | CryptoKeyPair
        | { publicKey: string; privateKey: string };
      storeOverride?: boolean;
    }): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.createApiKeyPair(params),
        callbacks,
        "Failed to create API key pair",
      );
    },
    [client, callbacks],
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
        callbacks,
        "Failed to get proxy auth config",
      );
    }, [client, callbacks]);

  const refreshUser = useCallback(
    async (params?: { stampWith?: StamperType | undefined }): Promise<void> => {
      const { stampWith } = params || {};
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const user = await withTurnkeyErrorHandling(
        () => fetchUser({ stampWith }),
        callbacks,
        "Failed to refresh user",
      );
      if (user) {
        setUser(user);
      }
    },
    [client, callbacks],
  );

  const refreshWallets = useCallback(
    async (params?: { stampWith?: StamperType | undefined }): Promise<void> => {
      const { stampWith } = params || {};
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );

      const walletProviders = await withTurnkeyErrorHandling(
        () => getWalletProviders(),
        callbacks,
        "Failed to refresh wallets",
      );

      const wallets = await withTurnkeyErrorHandling(
        () => fetchWallets({ stampWith, walletProviders }),
        callbacks,
        "Failed to refresh wallets",
      );
      if (wallets) {
        setWallets(wallets);
      }
    },
    [client, callbacks, getWalletProviders, fetchWallets],
  );

  useEffect(() => {
    if (proxyAuthConfigRef.current) return;

    // Only fetch the proxy auth config once. Use that to build the master config.
    const fetchProxyAuthConfig = async () => {
      try {
        let proxyAuthConfig: ProxyTGetWalletKitConfigResponse | undefined;
        if (config.authProxyConfigId) {
          // Only fetch the proxy auth config if we have an authProxyId. This is a way for devs to explicitly disable the proxy auth.
          proxyAuthConfig = await getAuthProxyConfig(
            config.authProxyConfigId,
            config.authProxyUrl,
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
    // This will initialize the sessions. This is the last step before client is considered "ready"
    if (!client || !masterConfig) return;
    clearSessionTimeouts();
    initializeSessions().finally(() => {
      // Set the client state to ready only after all initializations are done.
      setClientState(ClientState.Ready);
    });

    return () => {
      clearSessionTimeouts();
    };
  }, [client]);

  /**
   * @internal
   * We create `debouncedRefreshWallets()` so that multiple rapid wallet events
   * (for example, on Solana a single disconnect can emit several events we listen for)
   * only trigger `refreshWallets()` once.
   *
   * Defining the debounced function outside of the `useEffect` ensures all event
   * listeners in `initializeProviders` share the same instance, instead of creating
   * a new one on every render.
   */
  const debouncedRefreshWallets = useDebouncedCallback(refreshWallets, 100);
  useEffect(() => {
    if (!client) return;

    const handleRefreshWallets = async () => {
      // we only refresh the wallets if there is an active session
      // this is needed because a disconnect event can occur
      // while the user is unauthenticated
      if (session) {
        // this will update our walletProvider state
        await debouncedRefreshWallets();
      }
    };

    let cleanup = () => {};
    initializeWalletProviderListeners(walletProviders, handleRefreshWallets)
      .then((fn) => {
        cleanup = fn;
      })
      .catch((err) => {
        console.error("Failed to init providers:", err);
      });

    return () => {
      cleanup();
    };
  }, [client, walletProviders]);

  useEffect(() => {
    // authState must be consistent with session state. We found during testing that there are cases where the session and authState can be out of sync in very rare edge cases.
    // This will ensure that they are always in sync and remove the need to setAuthState manually in other places.
    if (session && isValidSession(session)) {
      setAuthState(AuthState.Authenticated);
    } else {
      setAuthState(AuthState.Unauthenticated);
    }
  }, [session]);

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
        createPasskey,
        logout,
        loginWithPasskey,
        signUpWithPasskey,
        getWalletProviders,
        connectWalletAccount,
        disconnectWalletAccount,
        switchWalletAccountChain,
        loginWithWallet,
        signUpWithWallet,
        loginOrSignupWithWallet,
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
        refreshWallets,
        signMessage,
        signTransaction,
        signAndSendTransaction,
        fetchUser,
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
      }}
    >
      {children}
    </ClientContext.Provider>
  );
};
