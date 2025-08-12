"use client";

import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import {
  APPLE_AUTH_URL,
  exchangeCodeForToken,
  FACEBOOK_AUTH_URL,
  generateChallengePair,
  GOOGLE_AUTH_URL,
  handleFacebookPKCEFlow,
  isValidSession,
  parseOAuthRedirect,
  popupHeight,
  popupWidth,
  SESSION_WARNING_THRESHOLD_MS,
  useDebouncedCallback,
  withTurnkeyErrorHandling,
} from "../../utils";
import {
  Chain,
  CreateSubOrgParams,
  DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
  ExportBundle,
  OtpType,
  StamperType,
  SwitchableChain,
  TurnkeyClient,
  Wallet,
  WalletAccount,
  WalletProvider,
} from "@turnkey/core";
import { ReactNode, useEffect, useRef, useState } from "react";
import {
  TurnkeyError,
  TurnkeyErrorCodes,
  TurnkeyNetworkError,
  SessionType,
  OAuthProviders,
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
} from "@turnkey/sdk-types";
import { useModal } from "../modal/Hook";
import {
  type TurnkeyCallbacks,
  type TurnkeyProviderConfig,
  AuthState,
  ClientState,
  ExportType,
} from "../../types/base";
import { AuthComponent } from "../../components/auth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faApple,
  faFacebook,
  faGoogle,
} from "@fortawesome/free-brands-svg-icons";
import { ActionPage } from "../../components/auth/Action";
import { SignMessageModal } from "../../components/sign/Message";
import { ExportComponent } from "../../components/export/Export";
import { ImportComponent } from "../../components/import/Import";
import { SuccessPage } from "../../components/design/Success";
import { UpdateEmail } from "../../components/user/UpdateEmail";
import { UpdatePhoneNumber } from "../../components/user/UpdatePhoneNumber";
import { UpdateUserName } from "../../components/user/UpdateUserName";
import { RemoveOAuthProvider } from "../../components/user/RemoveOAuthProvider";
import { RemovePasskey } from "../../components/user/RemovePasskey";
import { LinkWalletModal } from "../../components/user/LinkWallet";
import { ClientContext } from "./Types";
import { OtpVerification } from "../../components/auth/OTP";
import { RemoveEmail } from "../../components/user/RemoveEmail";
import { RemovePhoneNumber } from "../../components/user/RemovePhoneNumber";

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
  const [autoRefreshSession, setAutoRefreshSession] = useState<boolean>(false);
  const [masterConfig, setMasterConfig] = useState<
    TurnkeyProviderConfig | undefined
  >(undefined);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [user, setUser] = useState<v1User | undefined>(undefined);
  const [clientState, setClientState] = useState<ClientState>(
    ClientState.Loading,
  );
  const [authState, setAuthState] = useState<AuthState>(
    AuthState.Unauthenticated,
  );
  const expiryTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const proxyAuthConfigRef = useRef<ProxyTGetWalletKitConfigResponse | null>(
    null,
  );

  const [allSessions, setAllSessions] = useState<
    Record<string, Session> | undefined
  >(undefined);
  const { pushPage, closeModal } = useModal();

  useEffect(() => {
    initializeClient();
  }, []);

  /**
   * @internal
   * we use debouncedFetchWallets() to prevent multiple rapid wallet events
   * like accountsChanged and disconnect from triggering fetchWallets repeatedly
   * it must be defined outside the useEffect so all event listeners share the same
   * debounced function instance - otherwise, a new one would be created on every render
   */
  const debouncedFetchWallets = useDebouncedCallback(fetchWallets, 100);
  useEffect(() => {
    if (!client) return;

    let cleanup = () => {};
    initializeProviders(getWalletProviders, debouncedFetchWallets)
      .then((fn) => {
        cleanup = fn;
      })
      .catch((err) => {
        console.error("Failed to init providers:", err);
      });

    return () => {
      cleanup();
    };
  }, [client, debouncedFetchWallets]);

  // Handle redirect-based auth
  useEffect(() => {
    // Check for either hash or search parameters that could indicate an OAuth redirect
    if (
      (window.location.hash || window.location.search) &&
      client &&
      masterConfig
    ) {
      // Handle Facebook redirect (uses search params with code)
      if (
        window.location.search &&
        window.location.search.includes("code=") &&
        window.location.search.includes("state=")
      ) {
        const searchParams = new URLSearchParams(
          window.location.search.substring(1),
        );
        const code = searchParams.get("code");
        const state = searchParams.get("state");

        // Parse state parameter
        if (state && code) {
          const stateParams = new URLSearchParams(state);
          const provider = stateParams.get("provider");
          const flow = stateParams.get("flow");
          const publicKey = stateParams.get("publicKey");
          const openModal = stateParams.get("openModal");

          if (provider === "facebook" && flow === "redirect" && publicKey) {
            // We have all the required parameters for a Facebook PKCE flow
            const clientId = masterConfig?.auth?.oAuthConfig?.facebookClientId;
            const redirectURI =
              masterConfig?.auth?.oAuthConfig?.oAuthRedirectUri;

            if (clientId && redirectURI) {
              handleFacebookPKCEFlow({
                code,
                publicKey,
                openModal,
                clientId,
                redirectURI,
                callbacks,
                completeOauth,
                onPushPage: (oidcToken) => {
                  pushPage({
                    key: `Facebook OAuth`,
                    content: (
                      <ActionPage
                        title={`Authenticating with Facebook...`}
                        action={async () => {
                          await completeOauth({
                            oidcToken,
                            publicKey,
                            providerName: "facebook",
                          });
                        }}
                        icon={<FontAwesomeIcon size="3x" icon={faFacebook} />}
                      />
                    ),
                    showTitle: false,
                  });
                },
              }).catch((error) => {
                // Handle errors
                if (callbacks?.onError) {
                  callbacks.onError(
                    error instanceof TurnkeyError
                      ? error
                      : new TurnkeyError(
                          "Facebook authentication failed",
                          TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
                          error,
                        ),
                  );
                }
              });
            }
          }
        }
      }
      // Handle Google/Apple redirects (uses hash with id_token)
      else if (window.location.hash) {
        const hash = window.location.hash.substring(1);

        // Parse the hash using our helper functions
        const { idToken, provider, flow, publicKey, openModal } =
          parseOAuthRedirect(hash);

        if (idToken && flow === "redirect" && publicKey) {
          if (openModal === "true") {
            const providerName = provider
              ? provider.charAt(0).toUpperCase() + provider.slice(1)
              : "Provider";

            // Determine which icon to show based on the provider
            let icon;
            if (provider === "apple") {
              icon = <FontAwesomeIcon size="3x" icon={faApple} />;
            } else {
              // Default to Google icon
              icon = <FontAwesomeIcon size="3x" icon={faGoogle} />;
            }

            // This state is set when the OAuth flow comes from the AuthComponent
            pushPage({
              key: `${providerName} OAuth`,
              content: (
                <ActionPage
                  title={`Authenticating with ${providerName}...`}
                  action={async () => {
                    await completeOauth({
                      oidcToken: idToken,
                      publicKey,
                      ...(provider ? { providerName: provider } : {}),
                    });
                  }}
                  icon={icon}
                />
              ),
              showTitle: false,
            });
          } else if (callbacks?.onOauthRedirect) {
            callbacks.onOauthRedirect({ idToken, publicKey });
          } else {
            completeOauth({
              oidcToken: idToken,
              publicKey,
              ...(provider ? { providerName: provider } : {}),
            });
          }

          // Clean up the URL after processing
          window.history.replaceState(
            null,
            document.title,
            window.location.pathname + window.location.search,
          );
        }
      }
    }
  }, [client, masterConfig, callbacks, pushPage]);

  useEffect(() => {
    if (!client || proxyAuthConfigRef.current) return;

    // Only fetch the proxy auth config once. Use that to build the master config.
    const fetchProxyAuthConfig = async () => {
      try {
        let proxyAuthConfig: ProxyTGetWalletKitConfigResponse | undefined;
        if (config.authProxyId) {
          // Only fetch the proxy auth config if we have an authProxyId. This is a way for devs to explicitly disable the proxy auth.
          proxyAuthConfig = await client.getProxyAuthConfig();
          proxyAuthConfigRef.current = proxyAuthConfig;
        }

        setMasterConfig(buildConfig(proxyAuthConfig));
        setClientState(ClientState.Ready); // Set the client state to ready only after we have the master config
      } catch {
        setClientState(ClientState.Error);
      }
    };

    fetchProxyAuthConfig();
  }, [client]);

  useEffect(() => {
    // If the proxyAuthConfigRef is already set, we don't need to fetch it again. Rebuild the master config with the updated config and stored proxyAuthConfig
    if (!proxyAuthConfigRef.current && config.authProxyId) return;
    setMasterConfig(buildConfig(proxyAuthConfigRef.current ?? undefined));
  }, [config]);

  useEffect(() => {
    // authState must be consistent with session state. We found during testing that there are cases where the session and authState can be out of sync in very rare edge cases.
    // This will ensure that they are always in sync and remove the need to setAuthState manually in other places.
    if (session) {
      setAuthState(AuthState.Authenticated);
    } else {
      setAuthState(AuthState.Unauthenticated);
    }
  }, [session]);
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
      googleOAuthEnabled:
        config.auth?.methods?.googleOAuthEnabled ??
        proxyAuthConfig?.enabledProviders.includes("google"),
      appleOAuthEnabled:
        config.auth?.methods?.appleOAuthEnabled ??
        proxyAuthConfig?.enabledProviders.includes("apple"),
      facebookOAuthEnabled:
        config.auth?.methods?.facebookOAuthEnabled ??
        proxyAuthConfig?.enabledProviders.includes("facebook"),
    };

    // Set a default ordering for the oAuth methods
    const oauthOrder =
      config.auth?.oauthOrder ??
      (["google", "apple", "facebook"] as const).filter(
        (provider) => resolvedMethods[`${provider}OAuthEnabled` as const],
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
        oAuthConfig: {
          ...config.auth?.oAuthConfig,
          openOAuthInPage: config.auth?.oAuthConfig?.openOAuthInPage,
        },
        sessionExpirationSeconds: proxyAuthConfig?.sessionExpirationSeconds,
        methodOrder,
        oauthOrder,
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
    try {
      setClientState(ClientState.Loading);
      const turnkeyClient = new TurnkeyClient({
        apiBaseUrl: config.apiBaseUrl,
        authProxyUrl: config.authProxyUrl,
        authProxyId: config.authProxyId,
        organizationId: config.organizationId,

        // Define passkey and wallet config here. If we don't pass it into the client, Mr. Client will assume that we don't want to use passkeys/wallets and not create the stamper!
        passkeyConfig: {
          rpId: config.passkeyConfig?.rpId,
          timeout: config.passkeyConfig?.timeout || 60000, // 60 seconds
          userVerification:
            config.passkeyConfig?.userVerification || "preferred",
          allowCredentials: config.passkeyConfig?.allowCredentials || [],
        },
        walletConfig: {
          features: config.walletConfig?.features ?? {},
          chains: config.walletConfig?.chains ?? {},
          ...(config.walletConfig?.walletConnect && {
            walletConnect: config.walletConfig.walletConnect,
          }),
        },
      });

      setAutoRefreshSession(config?.auth?.autoRefreshSession ?? false);

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
    try {
      const allSessions = await getAllSessions();
      if (!allSessions) {
        return;
      }

      await Promise.all(
        Object.keys(allSessions).map(async (sessionKey) => {
          const session = allSessions?.[sessionKey];
          if (!isValidSession(session)) {
            await clearSession({ sessionKey });
            return;
          }

          scheduleSessionExpiration({
            sessionKey,
            expiry: session!.expiry,
          });
        }),
      );

      setAllSessions(allSessions);
      const activeSessionKey = await client?.getActiveSessionKey();
      if (activeSessionKey) {
        setSession(allSessions?.[activeSessionKey]);
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

  useEffect(() => {
    if (!client) return;
    clearSessionTimeouts();
    initializeSessions();

    return () => {
      clearSessionTimeouts();
    };
  }, [client]);

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
        if (autoRefreshSession) {
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

  async function createPasskey(params?: {
    name?: string;
    displayName?: string;
    stampWith?: StamperType | undefined;
  }): Promise<{ attestation: v1Attestation; encodedChallenge: string }> {
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
  }

  async function logout(params?: { sessionKey?: string }): Promise<void> {
    if (!client) {
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    }

    withTurnkeyErrorHandling(
      () => client.logout(params),
      callbacks,
      "Failed to logout",
    );
    handlePostLogout();

    return;
  }

  async function loginWithPasskey(params?: {
    publicKey?: string;
    sessionKey?: string;
  }): Promise<string> {
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
  }

  async function signUpWithPasskey(params?: {
    createSubOrgParams?: CreateSubOrgParams;
    sessionKey?: string;
    passkeyDisplayName?: string;
  }): Promise<string> {
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
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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
  }

  async function getWalletProviders(chain?: Chain): Promise<WalletProvider[]> {
    if (!client) {
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    }
    return await client.getWalletProviders(chain);
  }

  async function connectWalletAccount(
    walletProvider: WalletProvider,
  ): Promise<void> {
    if (!client) {
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    }
    await client.connectWalletAccount(walletProvider);
    await refreshWallets();
  }

  async function disconnectWalletAccount(
    walletProvider: WalletProvider,
  ): Promise<void> {
    if (!client) {
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    }
    await client.disconnectWalletAccount(walletProvider);

    // we only refresh the wallets if there is an active session
    // this is needed because for WalletConnect you can unlink a wallet before
    // actually being logged in
    if (session) {
      await refreshWallets();
    }
  }

  async function switchWalletProviderChain(
    walletProvider: WalletProvider,
    chainOrId: string | SwitchableChain,
  ): Promise<void> {
    if (!client) {
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    }
    await client.switchWalletProviderChain(walletProvider, chainOrId);
  }

  // TODO: MOE PLEASE COMMENT THESE
  async function initializeProviders(
    getWalletProviders: (chain: Chain) => Promise<WalletProvider[]>,
    onWalletsChanged: () => void,
  ): Promise<() => void> {
    const cleanups: Array<() => void> = [];

    const [ethProviders, solProviders] = await Promise.all([
      getWalletProviders(Chain.Ethereum),
      getWalletProviders(Chain.Solana),
    ]);

    function attachEthereumListeners(
      provider: any,
      onWalletsChanged: () => void,
    ) {
      if (typeof provider.on !== "function") return;

      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) onWalletsChanged();
      };
      const handleDisconnect = () => onWalletsChanged();

      provider.on("accountsChanged", handleAccountsChanged);
      provider.on("disconnect", handleDisconnect);

      return () => {
        provider.removeListener("accountsChanged", handleAccountsChanged);
        provider.removeListener("disconnect", handleDisconnect);
      };
    }

    function attachSolanaListeners(
      provider: any,
      onWalletsChanged: () => void,
    ) {
      const cleanups: Array<() => void> = [];

      const walletEvents = provider.features?.["standard:events"];
      if (walletEvents?.on) {
        const handleChange = (event: { type: string }) => {
          if (event.type === "change" || event.type === "accountsChanged") {
            onWalletsChanged();
          }
        };

        walletEvents.on("change", handleChange);
        walletEvents.on("accountsChanged", handleChange);

        cleanups.push(() => {
          walletEvents.off?.("change", handleChange);
          walletEvents.off?.("accountsChanged", handleChange);
        });
      }

      return cleanups.length > 0
        ? () => {
            cleanups.forEach((fn) => fn());
          }
        : () => {};
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

    return () => {
      cleanups.forEach((remove) => remove());
    };
  }

  async function loginWithWallet(params: {
    walletProvider: WalletProvider;
    sessionType?: SessionType;
    publicKey?: string;
    sessionKey?: string;
  }): Promise<string> {
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
  }

  async function signUpWithWallet(params: {
    walletProvider: WalletProvider;
    createSubOrgParams?: CreateSubOrgParams;
    sessionType?: SessionType;
    sessionKey?: string;
  }): Promise<string> {
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
  }

  async function loginOrSignupWithWallet(params: {
    walletProvider: WalletProvider;
    createSubOrgParams?: CreateSubOrgParams;
    sessionKey?: string;
    expirationSeconds?: string;
  }): Promise<string> {
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
  }

  async function initOtp(params: {
    otpType: OtpType;
    contact: string;
  }): Promise<string> {
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
  }

  async function verifyOtp(params: {
    otpId: string;
    otpCode: string;
    contact: string;
    otpType: OtpType;
  }): Promise<{ subOrganizationId: string; verificationToken: string }> {
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
  }

  async function loginWithOtp(params: {
    verificationToken: string;
    publicKey?: string;
    invalidateExisting?: boolean;
    sessionKey?: string;
  }): Promise<string> {
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
  }

  async function signUpWithOtp(params: {
    verificationToken: string;
    contact: string;
    otpType: OtpType;
    createSubOrgParams?: CreateSubOrgParams;
    sessionKey?: string;
  }): Promise<string> {
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
        createSubOrgParams = masterConfig.auth.createSuborgParams.emailOtpAuth;
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
  }

  async function completeOtp(params: {
    otpId: string;
    otpCode: string;
    contact: string;
    otpType: OtpType;
    publicKey?: string;
    invalidateExisting?: boolean;
    sessionKey?: string;
    createSubOrgParams?: CreateSubOrgParams;
  }): Promise<string> {
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
        createSubOrgParams = masterConfig.auth.createSuborgParams.emailOtpAuth;
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
  }

  async function completeOauth(params: {
    oidcToken: string;
    publicKey: string;
    providerName?: string;
    sessionKey?: string;
    invalidateExisting?: boolean;
    createSubOrgParams?: CreateSubOrgParams;
  }): Promise<string> {
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
      params.createSubOrgParams ?? masterConfig.auth?.createSuborgParams?.oAuth;

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
  }

  async function loginWithOauth(params: {
    oidcToken: string;
    publicKey: string;
    invalidateExisting?: boolean;
    sessionKey?: string;
  }): Promise<string> {
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
  }

  async function signUpWithOauth(params: {
    oidcToken: string;
    publicKey: string;
    providerName: string;
    createSubOrgParams?: CreateSubOrgParams;
    sessionKey?: string;
  }): Promise<string> {
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
      params.createSubOrgParams ?? masterConfig.auth?.createSuborgParams?.oAuth;
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
  }

  async function fetchWallets(params?: {
    stampWith?: StamperType | undefined;
  }): Promise<Wallet[]> {
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
  }

  async function fetchWalletAccounts(params: {
    wallet: Wallet;
    walletProviders?: WalletProvider[];
    paginationOptions?: v1Pagination;
    stampWith?: StamperType | undefined;
  }): Promise<WalletAccount[]> {
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
  }

  async function signMessage(params: {
    message: string;
    walletAccount: WalletAccount;
    encoding?: v1PayloadEncoding;
    hashFunction?: v1HashFunction;
    stampWith?: StamperType | undefined;
    addEthereumPrefix?: boolean;
  }): Promise<v1SignRawPayloadResult> {
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
  }

  async function handleSignMessage(params: {
    message: string;
    walletAccount: WalletAccount;
    encoding?: v1PayloadEncoding;
    hashFunction?: v1HashFunction;
    addEthereumPrefix?: boolean;
    subText?: string;
    successPageDuration?: number | undefined;
    stampWith?: StamperType | undefined;
  }): Promise<v1SignRawPayloadResult> {
    const { successPageDuration = 2000 } = params;
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    return new Promise((resolve, reject) => {
      pushPage({
        key: "Sign Message",
        content: (
          <SignMessageModal
            message={params.message}
            subText={params?.subText}
            walletAccount={params.walletAccount}
            stampWith={params.stampWith}
            successPageDuration={successPageDuration}
            onSuccess={(result) => {
              resolve(result);
            }}
            onError={(error) => {
              reject(error);
            }}
            {...(params?.encoding && { encoding: params.encoding })}
            {...(params?.hashFunction && {
              hashFunction: params.hashFunction,
            })}
            {...(params?.addEthereumPrefix && {
              addEthereumPrefix: params.addEthereumPrefix,
            })}
          />
        ),
      });
    });
  }

  async function signTransaction(params: {
    unsignedTransaction: string;
    transactionType: v1TransactionType;
    walletAccount: WalletAccount;
    stampWith?: StamperType | undefined;
  }): Promise<string> {
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
  }

  async function signAndSendTransaction(params: {
    unsignedTransaction: string;
    transactionType: v1TransactionType;
    walletAccount: WalletAccount;
    rpcUrl?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string> {
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
  }

  async function fetchUser(params?: {
    organizationId?: string;
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<v1User> {
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
  }

  async function updateUserEmail(params: {
    email: string;
    verificationToken?: string;
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string> {
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
  }

  async function removeUserEmail(params?: {
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string> {
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
  }

  async function updateUserPhoneNumber(params: {
    phoneNumber: string;
    verificationToken?: string;
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string> {
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
  }

  async function removeUserPhoneNumber(params?: {
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string> {
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
  }

  async function updateUserName(params: {
    userName: string;
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string> {
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
  }

  async function addOAuthProvider(params: {
    providerName: string;
    oidcToken: string;
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string[]> {
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    const res = await withTurnkeyErrorHandling(
      () => client.addOAuthProvider(params),
      callbacks,
      "Failed to add OAuth provider",
    );
    if (res) await refreshUser({ stampWith: params?.stampWith });
    return res;
  }

  async function removeOAuthProviders(params: {
    providerIds: string[];
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string[]> {
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    const res = await withTurnkeyErrorHandling(
      () => client.removeOAuthProviders(params),
      callbacks,
      "Failed to remove OAuth providers",
    );
    if (res) await refreshUser({ stampWith: params?.stampWith });
    return res;
  }

  async function addPasskey(params?: {
    name?: string;
    displayName?: string;
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string[]> {
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
  }

  async function removePasskeys(params: {
    authenticatorIds: string[];
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string[]> {
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
  }

  async function createWallet(params: {
    walletName: string;
    accounts?: v1WalletAccountParams[] | v1AddressFormat[];
    organizationId?: string;
    mnemonicLength?: number;
    stampWith?: StamperType | undefined;
  }): Promise<string> {
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
  }

  async function createWalletAccounts(params: {
    accounts: v1WalletAccountParams[] | v1AddressFormat[];
    walletId: string;
    organizationId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string[]> {
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
  }

  async function exportWallet(params: {
    walletId: string;
    targetPublicKey: string;
    organizationId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<ExportBundle> {
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
  }

  async function importWallet(params: {
    encryptedBundle: string;
    walletName: string;
    accounts?: v1WalletAccountParams[];
    userId?: string;
    stampWith?: StamperType | undefined;
  }): Promise<string> {
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
  }

  async function deleteSubOrganization(params?: {
    deleteWithoutExport?: boolean;
    stampWith?: StamperType | undefined;
  }): Promise<TDeleteSubOrganizationResponse> {
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
  }

  async function storeSession(params: {
    sessionToken: string;
    sessionKey?: string;
  }): Promise<void> {
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
  }

  async function clearSession(params?: { sessionKey?: string }): Promise<void> {
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
  }

  async function clearAllSessions(): Promise<void> {
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
  }

  async function refreshSession(params?: {
    expirationSeconds?: string;
    publicKey?: string;
    sessionKey?: string;
    invalidateExisitng?: boolean;
    stampWith?: StamperType | undefined;
  }): Promise<TStampLoginResponse | undefined> {
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
  }

  async function getSession(params?: {
    sessionKey?: string;
  }): Promise<Session | undefined> {
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
  }

  async function getAllSessions(): Promise<
    Record<string, Session> | undefined
  > {
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
  }

  async function setActiveSession(params: {
    sessionKey: string;
  }): Promise<void> {
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
      throw new TurnkeyError("Session not found.", TurnkeyErrorCodes.NOT_FOUND);
    }
    await withTurnkeyErrorHandling(
      () => client.setActiveSession(params),
      callbacks,
      "Failed to set active session",
    );
    setSession(session);
    return;
  }

  async function getActiveSessionKey(): Promise<string | undefined> {
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
  }

  async function clearUnusedKeyPairs(): Promise<void> {
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
  }

  async function createApiKeyPair(params?: {
    externalKeyPair?: CryptoKeyPair | { publicKey: string; privateKey: string };
    storeOverride?: boolean;
  }): Promise<string> {
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
  }

  async function getProxyAuthConfig(): Promise<ProxyTGetWalletKitConfigResponse> {
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
  }

  async function refreshUser(params?: {
    stampWith?: StamperType | undefined;
  }): Promise<void> {
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
  }

  async function refreshWallets(params?: {
    stampWith?: StamperType | undefined;
  }): Promise<void> {
    const { stampWith } = params || {};
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    const wallets = await withTurnkeyErrorHandling(
      () => fetchWallets({ stampWith }),
      callbacks,
      "Failed to refresh wallets",
    );
    if (wallets) {
      setWallets(wallets);
    }
  }

  async function handleGoogleOauth(params?: {
    clientId?: string;
    openInPage?: boolean;
    additionalState?: Record<string, string>;
    onOAuthSuccess?: (params: {
      oidcToken: string;
      providerName: string;
    }) => any;
  }): Promise<void> {
    const {
      clientId = masterConfig?.auth?.oAuthConfig?.googleClientId,
      openInPage = masterConfig?.auth?.oAuthConfig?.openOAuthInPage ?? false,
      additionalState: additionalParameters,
    } = params || {};
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
      if (!masterConfig.auth?.oAuthConfig?.oAuthRedirectUri) {
        throw new TurnkeyError(
          "OAuth Redirect URI is not configured.",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }

      const flow = openInPage ? "redirect" : "popup";
      const redirectURI =
        masterConfig.auth?.oAuthConfig.oAuthRedirectUri.replace(/\/$/, "");

      // Create key pair and generate nonce
      const publicKey = await createApiKeyPair();
      if (!publicKey) {
        throw new Error("Failed to create public key for OAuth.");
      }
      const nonce = bytesToHex(sha256(publicKey));

      // Construct Google Auth URL
      const googleAuthUrl = new URL(GOOGLE_AUTH_URL);
      googleAuthUrl.searchParams.set("client_id", clientId);
      googleAuthUrl.searchParams.set("redirect_uri", redirectURI);
      googleAuthUrl.searchParams.set("response_type", "id_token");
      googleAuthUrl.searchParams.set("scope", "openid email profile");
      googleAuthUrl.searchParams.set("nonce", nonce);
      googleAuthUrl.searchParams.set("prompt", "select_account");

      // Create state parameter
      let state = `provider=google&flow=${flow}&publicKey=${encodeURIComponent(publicKey)}`;
      if (additionalParameters) {
        const additionalState = Object.entries(additionalParameters)
          .map(
            ([key, value]) =>
              `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
          )
          .join("&");
        if (additionalState) {
          state += `&${additionalState}`;
        }
      }
      googleAuthUrl.searchParams.set("state", state);
      if (openInPage) {
        // Redirect current page to Google Auth
        window.location.href = googleAuthUrl.toString();
        return new Promise((_, reject) => {
          // By here, the page should have already redirected. We wait here since the function is async.
          // We want any function that runs this to simply wait until the page redirects.
          // A 5 min timeout is set just in case, idk
          const timeout = setTimeout(() => {
            reject(new Error("Authentication timed out."));
          }, 300000); // 5 minutes

          // If the page is unloaded (user navigates away), clear the timeout
          window.addEventListener("beforeunload", () => clearTimeout(timeout));
        });
      } else {
        // Open popup window
        const width = popupWidth;
        const height = popupHeight;
        const left = window.screenX + (window.innerWidth - width) / 2;
        const top = window.screenY + (window.innerHeight - height) / 2;

        const authWindow = window.open(
          "about:blank",
          "_blank",
          `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`,
        );

        if (!authWindow) {
          throw new Error("Failed to open Google login window.");
        }

        authWindow.location.href = googleAuthUrl.toString();

        // Return a promise that resolves when the OAuth flow completes
        // This following code will only run for the popup flow
        return new Promise<void>((resolve, reject) => {
          const interval = setInterval(() => {
            try {
              // Check if window was closed without completing auth
              if (authWindow.closed) {
                clearInterval(interval);
                reject(new Error("Authentication window was closed."));
                return;
              }

              const url = authWindow.location.href || "";
              if (url.startsWith(window.location.origin)) {
                const hashParams = new URLSearchParams(url.split("#")[1]);
                const idToken = hashParams.get("id_token");
                if (idToken) {
                  authWindow.close();
                  clearInterval(interval);

                  if (params?.onOAuthSuccess) {
                    params.onOAuthSuccess({
                      oidcToken: idToken,
                      providerName: "google",
                    });
                  } else if (callbacks?.onOauthRedirect) {
                    callbacks.onOauthRedirect({ idToken, publicKey });
                  } else {
                    completeOauth({
                      oidcToken: idToken,
                      publicKey,
                      providerName: "google",
                    })
                      .then(() => resolve())
                      .catch(reject);
                    return;
                  }
                  resolve();
                }
              }
            } catch (error) {
              // Ignore cross-origin errors
            }
          }, 500);

          if (authWindow.closed) {
            clearInterval(interval);
          }
        });
      }
    } catch (error) {
      throw error;
    }
  }

  async function handleAppleOauth(params?: {
    clientId?: string;
    openInPage?: boolean;
    additionalState?: Record<string, string>;
    onOAuthSuccess?: (params: {
      oidcToken: string;
      providerName: string;
    }) => any;
  }): Promise<void> {
    const {
      clientId = masterConfig?.auth?.oAuthConfig?.appleClientId,
      openInPage = masterConfig?.auth?.oAuthConfig?.openOAuthInPage ?? false,
      additionalState: additionalParameters,
    } = params || {};
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
      if (!masterConfig.auth?.oAuthConfig?.oAuthRedirectUri) {
        throw new TurnkeyError(
          "OAuth Redirect URI is not configured.",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }

      const flow = openInPage ? "redirect" : "popup";
      const redirectURI = masterConfig.auth?.oAuthConfig.oAuthRedirectUri; // TODO (Amir): Apple needs the '/' at the end. Maybe we should add it if not there?

      // Create key pair and generate nonce
      const publicKey = await createApiKeyPair();
      if (!publicKey) {
        throw new Error("Failed to create public key for OAuth.");
      }
      const nonce = bytesToHex(sha256(publicKey));

      // Construct Apple Auth URL
      const appleAuthUrl = new URL(APPLE_AUTH_URL);
      appleAuthUrl.searchParams.set("client_id", clientId);
      appleAuthUrl.searchParams.set("redirect_uri", redirectURI);
      appleAuthUrl.searchParams.set("response_type", "code id_token");
      appleAuthUrl.searchParams.set("response_mode", "fragment");
      appleAuthUrl.searchParams.set("nonce", nonce);

      // Create state parameter
      let state = `provider=apple&flow=${flow}&publicKey=${encodeURIComponent(publicKey)}`;
      if (additionalParameters) {
        const additionalState = Object.entries(additionalParameters)
          .map(
            ([key, value]) =>
              `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
          )
          .join("&");
        if (additionalState) {
          state += `&${additionalState}`;
        }
      }
      appleAuthUrl.searchParams.set("state", state);

      if (openInPage) {
        // Redirect current page to Apple Auth
        window.location.href = appleAuthUrl.toString();
        return new Promise((_, reject) => {
          // Set a timeout just in case the redirect doesn't happen
          const timeout = setTimeout(() => {
            reject(new Error("Authentication timed out."));
          }, 300000); // 5 minutes

          // If the page is unloaded (user navigates away), clear the timeout
          window.addEventListener("beforeunload", () => clearTimeout(timeout));
        });
      } else {
        // Open popup window
        const width = popupWidth;
        const height = popupHeight;
        const left = window.screenX + (window.innerWidth - width) / 2;
        const top = window.screenY + (window.innerHeight - height) / 2;

        const authWindow = window.open(
          "about:blank",
          "_blank",
          `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`,
        );

        if (!authWindow) {
          throw new Error("Failed to open Apple login window.");
        }

        authWindow.location.href = appleAuthUrl.toString();

        // Return a promise that resolves when the OAuth flow completes
        return new Promise<void>((resolve, reject) => {
          const interval = setInterval(() => {
            try {
              // Check if window was closed without completing auth
              if (authWindow.closed) {
                clearInterval(interval);
                reject(new Error("Authentication window was closed."));
                return;
              }

              const url = authWindow.location.href || "";
              if (url.startsWith(window.location.origin)) {
                const hashParams = new URLSearchParams(url.split("#")[1]);
                const idToken = hashParams.get("id_token");
                if (idToken) {
                  authWindow.close();
                  clearInterval(interval);

                  if (params?.onOAuthSuccess) {
                    params.onOAuthSuccess({
                      oidcToken: idToken,
                      providerName: "apple",
                    });
                  } else if (callbacks?.onOauthRedirect) {
                    callbacks.onOauthRedirect({ idToken, publicKey });
                  } else {
                    completeOauth({
                      oidcToken: idToken,
                      publicKey,
                      providerName: "apple",
                    })
                      .then(() => resolve())
                      .catch(reject);
                    return;
                  }
                  resolve();
                }
              }
            } catch (error) {
              // Ignore cross-origin errors
            }
          }, 500);

          if (authWindow.closed) {
            clearInterval(interval);
          }
        });
      }
    } catch (error) {
      throw error;
    }
  }

  async function handleFacebookOauth(params?: {
    clientId?: string;
    openInPage?: boolean;
    additionalState?: Record<string, string>;
    onOAuthSuccess?: (params: {
      oidcToken: string;
      providerName: string;
    }) => any;
  }): Promise<void> {
    const {
      clientId = masterConfig?.auth?.oAuthConfig?.facebookClientId,
      openInPage = masterConfig?.auth?.oAuthConfig?.openOAuthInPage ?? false,
      additionalState: additionalParameters,
    } = params || {};
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
      if (!masterConfig.auth?.oAuthConfig?.oAuthRedirectUri) {
        throw new TurnkeyError(
          "OAuth Redirect URI is not configured.",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }

      const flow = openInPage ? "redirect" : "popup";
      const redirectURI = masterConfig.auth?.oAuthConfig.oAuthRedirectUri;

      // Create key pair and generate nonce
      const publicKey = await createApiKeyPair();
      if (!publicKey) {
        throw new Error("Failed to create public key for OAuth.");
      }
      const nonce = bytesToHex(sha256(publicKey));

      // Generate PKCE challenge pair
      const { verifier, codeChallenge } = await generateChallengePair();
      // Store verifier for later token exchange
      sessionStorage.setItem("facebook_verifier", verifier);

      // Construct Facebook Auth URL
      const facebookAuthUrl = new URL(FACEBOOK_AUTH_URL);
      facebookAuthUrl.searchParams.set("client_id", clientId);
      facebookAuthUrl.searchParams.set("redirect_uri", redirectURI);
      facebookAuthUrl.searchParams.set("response_type", "code");
      facebookAuthUrl.searchParams.set("code_challenge", codeChallenge);
      facebookAuthUrl.searchParams.set("code_challenge_method", "S256");
      facebookAuthUrl.searchParams.set("nonce", nonce);
      facebookAuthUrl.searchParams.set("scope", "openid");

      // Create state parameter
      let state = `provider=facebook&flow=${flow}&publicKey=${encodeURIComponent(publicKey)}`;
      if (additionalParameters) {
        const additionalState = Object.entries(additionalParameters)
          .map(
            ([key, value]) =>
              `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
          )
          .join("&");
        if (additionalState) {
          state += `&${additionalState}`;
        }
      }
      facebookAuthUrl.searchParams.set("state", state);

      if (openInPage) {
        // Redirect current page to Facebook Auth
        window.location.href = facebookAuthUrl.toString();
        return new Promise((_, reject) => {
          // Set a timeout just in case the redirect doesn't happen
          const timeout = setTimeout(() => {
            reject(new Error("Authentication timed out."));
          }, 300000); // 5 minutes

          // If the page is unloaded (user navigates away), clear the timeout
          window.addEventListener("beforeunload", () => clearTimeout(timeout));
        });
      } else {
        // Open popup window
        const width = popupWidth;
        const height = popupHeight;
        const left = window.screenX + (window.innerWidth - width) / 2;
        const top = window.screenY + (window.innerHeight - height) / 2;

        const authWindow = window.open(
          "about:blank",
          "_blank",
          `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`,
        );

        if (!authWindow) {
          throw new Error("Failed to open Facebook login window.");
        }

        authWindow.location.href = facebookAuthUrl.toString();

        // Return a promise that resolves when the OAuth flow completes
        return new Promise<void>((resolve, reject) => {
          const interval = setInterval(() => {
            try {
              // Check if window was closed without completing auth
              if (authWindow.closed) {
                clearInterval(interval);
                reject(new Error("Authentication window was closed."));
                return;
              }

              const url = authWindow.location.href || "";
              if (url.startsWith(window.location.origin)) {
                const urlParams = new URLSearchParams(new URL(url).search);
                const authCode = urlParams.get("code");
                const stateParam = urlParams.get("state");

                if (
                  authCode &&
                  stateParam &&
                  stateParam.includes("provider=facebook")
                ) {
                  authWindow.close();
                  clearInterval(interval);

                  // Exchange code for token
                  const verifier = sessionStorage.getItem("facebook_verifier");
                  if (!verifier) {
                    reject(new Error("Missing PKCE verifier"));
                    return;
                  }

                  exchangeCodeForToken(
                    clientId,
                    redirectURI,
                    authCode,
                    verifier,
                  )
                    .then((tokenData) => {
                      sessionStorage.removeItem("facebook_verifier");

                      if (params?.onOAuthSuccess) {
                        params.onOAuthSuccess({
                          oidcToken: tokenData.id_token,
                          providerName: "apple",
                        });
                      } else if (callbacks?.onOauthRedirect) {
                        callbacks.onOauthRedirect({
                          idToken: tokenData.id_token,
                          publicKey,
                        });
                      } else {
                        completeOauth({
                          oidcToken: tokenData.id_token,
                          publicKey,
                          providerName: "facebook",
                        })
                          .then(() => resolve())
                          .catch(reject);
                        return;
                      }
                      resolve();
                    })
                    .catch(reject);
                }
              }
            } catch (error) {
              // Ignore cross-origin errors
            }
          }, 500);

          if (authWindow.closed) {
            clearInterval(interval);
          }
        });
      }
    } catch (error) {
      throw error;
    }
  }

  const handleLogin = async () => {
    pushPage({
      key: "Log in or sign up",
      content: <AuthComponent />,
    });
  };

  const handleExport = async (params: {
    walletId: string;
    exportType: ExportType;
    targetPublicKey?: string;
    stampWith?: StamperType | undefined;
  }) => {
    const { walletId, exportType, targetPublicKey, stampWith } = params;
    pushPage({
      key: "Export Wallet",
      content: (
        <ExportComponent
          walletId={walletId ?? wallets[0]?.walletId!}
          exportType={exportType ?? ExportType.Wallet}
          {...(targetPublicKey !== undefined ? { targetPublicKey } : {})}
          {...(stampWith !== undefined ? { stampWith } : {})}
        />
      ),
    });
  };

  const handleImport = async (params?: {
    defaultWalletAccounts?: v1AddressFormat[] | v1WalletAccountParams[];
    successPageDuration?: number | undefined;
    stampWith?: StamperType | undefined;
  }): Promise<string> => {
    const {
      defaultWalletAccounts,
      successPageDuration = 2000,
      stampWith,
    } = params || {};
    try {
      return withTurnkeyErrorHandling(
        () =>
          new Promise<string>((resolve, reject) =>
            pushPage({
              key: "Import Wallet",
              content: (
                <ImportComponent
                  onError={(error: unknown) => {
                    reject(error);
                  }}
                  onSuccess={(walletId: string) => resolve(walletId)}
                  {...(defaultWalletAccounts !== undefined && {
                    defaultWalletAccounts,
                  })}
                  {...(successPageDuration !== undefined && {
                    successPageDuration,
                  })}
                  {...(stampWith !== undefined && { stampWith })}
                />
              ),
            }),
          ),
      );
    } catch (error) {
      if (error instanceof TurnkeyError) {
        throw error;
      }
      throw new TurnkeyError(
        "Failed to import wallet.",
        TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
        error,
      );
    }
  };

  const handleUpdateUserName = async (params?: {
    userName?: string;
    title?: string;
    subTitle?: string;
    successPageDuration?: number | undefined;
    stampWith?: StamperType | undefined;
  }): Promise<string> => {
    const {
      successPageDuration = 2000,
      subTitle,
      title,
      stampWith,
    } = params || {};

    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );

    if (!session) {
      throw new TurnkeyError(
        "No active session found.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }

    const onSuccess = () => {
      if (!successPageDuration) return;
      pushPage({
        key: "success",
        content: (
          <SuccessPage
            text="User name changed successfully!"
            duration={successPageDuration}
            onComplete={() => {
              closeModal();
            }}
          />
        ),
        preventBack: true,
        showTitle: false,
      });
    };

    try {
      if (!params?.userName && params?.userName !== "") {
        return withTurnkeyErrorHandling(
          () =>
            new Promise((resolve, reject) => {
              pushPage({
                key: "Update User Name",
                content: (
                  <UpdateUserName
                    onSuccess={(userId: string) => {
                      resolve(userId);
                    }}
                    onError={(error: unknown) => {
                      reject(error);
                    }}
                    successPageDuration={successPageDuration}
                    stampWith={stampWith}
                    {...(title !== undefined ? { title } : {})}
                    {...(subTitle !== undefined ? { subTitle } : {})}
                  />
                ),
                showTitle: false,
              });
            }),
        );
      } else {
        const res = await updateUserName({
          userName: params.userName!,
          userId: user!.userId,
          stampWith,
        });
        onSuccess();
        return res;
      }
    } catch (error) {
      if (error instanceof TurnkeyError) {
        throw error;
      }
      throw new TurnkeyError(
        "Failed to update user name.",
        TurnkeyErrorCodes.UPDATE_USER_NAME_ERROR,
        error,
      );
    }
  };

  const handleUpdateUserPhoneNumber = async (params?: {
    phoneNumber?: string;
    formattedPhone?: string;
    title?: string;
    subTitle?: string;
    successPageDuration?: number | undefined;
  }): Promise<string> => {
    const { successPageDuration = 2000, subTitle, title } = params || {};

    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );

    if (!session) {
      throw new TurnkeyError(
        "No active session found.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }

    if (!masterConfig) {
      throw new TurnkeyError(
        "Config is not ready yet!",
        TurnkeyErrorCodes.CONFIG_NOT_INITIALIZED,
      );
    }

    if (!masterConfig.auth?.methods?.smsOtpAuthEnabled) {
      throw new TurnkeyError(
        "SMS OTP authentication is not enabled in the configuration.",
        TurnkeyErrorCodes.AUTH_METHOD_NOT_ENABLED,
      );
    }

    const onSuccess = () => {
      if (!successPageDuration) return;
      pushPage({
        key: "success",
        content: (
          <SuccessPage
            text="Phone number changed successfully!"
            duration={successPageDuration}
            onComplete={() => {
              closeModal();
            }}
          />
        ),
        preventBack: true,
        showTitle: false,
      });
    };

    try {
      if (!params?.phoneNumber && params?.phoneNumber !== "") {
        return withTurnkeyErrorHandling(
          () =>
            new Promise((resolve, reject) => {
              pushPage({
                key: "Update Phone Number",
                content: (
                  <UpdatePhoneNumber
                    successPageDuration={successPageDuration}
                    onSuccess={(userId: string) => resolve(userId)}
                    onError={(error) => reject(error)}
                    {...(title !== undefined ? { title } : {})}
                    {...(subTitle !== undefined ? { subTitle } : {})}
                  />
                ),
                showTitle: false,
              });
            }),
        );
      } else {
        const otpId = await initOtp({
          otpType: OtpType.Sms,
          contact: params.phoneNumber,
        });
        return withTurnkeyErrorHandling(
          () =>
            new Promise((resolve, reject) => {
              pushPage({
                key: "Update Phone Number",
                content: (
                  <OtpVerification
                    otpType={OtpType.Sms}
                    contact={params.phoneNumber!}
                    otpId={otpId}
                    onContinue={async (otpCode: string) => {
                      try {
                        const { verificationToken } = await verifyOtp({
                          otpId,
                          otpCode,
                          contact: params.phoneNumber!,
                          otpType: OtpType.Sms,
                        });
                        const res = await updateUserPhoneNumber({
                          phoneNumber: params.phoneNumber!,
                          verificationToken,
                          userId: user!.userId,
                        });
                        onSuccess();
                        resolve(res);
                      } catch (error) {
                        reject(error);
                      }
                    }}
                    {...(!user?.userPhoneNumber && {
                      title: title ?? "Connect a phone number",
                    })}
                    {...(subTitle !== undefined && { subTitle })}
                    {...(params!.formattedPhone && {
                      formattedPhone: params.formattedPhone,
                    })}
                  />
                ),
                showTitle: false,
              });
            }),
          callbacks,
          "Failed to update phone number",
        );
      }
    } catch (error) {
      if (error instanceof TurnkeyError) {
        throw error;
      }
      throw new TurnkeyError(
        "Failed to initialize OTP for sms verification.",
        TurnkeyErrorCodes.INIT_OTP_ERROR,
        error,
      );
    }
  };

  const handleUpdateUserEmail = async (params?: {
    email?: string;
    title?: string;
    subTitle?: string;
    successPageDuration?: number | undefined;
  }): Promise<string> => {
    const { successPageDuration = 2000, subTitle, title } = params || {};

    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );

    if (!session) {
      throw new TurnkeyError(
        "No active session found.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }

    const onSuccess = () => {
      if (!successPageDuration) return;
      pushPage({
        key: "success",
        content: (
          <SuccessPage
            text="Email changed successfully!"
            duration={successPageDuration}
            onComplete={() => {
              closeModal();
            }}
          />
        ),
        preventBack: true,
        showTitle: false,
      });
    };

    try {
      if (!params?.email && params?.email !== "") {
        return withTurnkeyErrorHandling(
          () =>
            new Promise((resolve, reject) => {
              pushPage({
                key: "Update Email",
                content: (
                  <UpdateEmail
                    successPageDuration={successPageDuration}
                    onSuccess={(userId: string) => {
                      resolve(userId);
                    }}
                    onError={(error) => reject(error)}
                    {...(title !== undefined ? { title } : {})}
                    {...(subTitle !== undefined ? { subTitle } : {})}
                  />
                ),
                showTitle: false,
              });
            }),
        );
      } else {
        const otpId = await initOtp({
          otpType: OtpType.Email,
          contact: params.email,
        });
        return withTurnkeyErrorHandling(
          () =>
            new Promise((resolve, reject) => {
              pushPage({
                key: "Update Email",
                content: (
                  <OtpVerification
                    otpType={OtpType.Email}
                    contact={params.email!}
                    otpId={otpId}
                    onContinue={async (otpCode: string) => {
                      try {
                        const { verificationToken } = await verifyOtp({
                          otpId,
                          otpCode,
                          contact: params.email!,
                          otpType: OtpType.Email,
                        });
                        const res = await updateUserEmail({
                          email: params.email!,
                          verificationToken,
                          userId: user!.userId,
                        });
                        onSuccess();
                        resolve(res);
                      } catch (error) {
                        reject(error);
                      }
                    }}
                    {...(!user?.userEmail && {
                      title: title ?? "Connect an email",
                    })}
                    {...(subTitle !== undefined && { subTitle })}
                  />
                ),
                showTitle: false,
              });
            }),
          callbacks,
          "Failed to update email",
        );
      }
    } catch (error) {
      if (error instanceof TurnkeyError) {
        throw error;
      }
      throw new TurnkeyError(
        "Failed to initialize OTP for email verification.",
        TurnkeyErrorCodes.INIT_OTP_ERROR,
        error,
      );
    }
  };

  const handleAddEmail = async (params?: {
    email?: string;
    title?: string;
    subTitle?: string;
    successPageDuration?: number | undefined;
  }): Promise<string> => {
    const { successPageDuration = 2000, subTitle, title } = params || {};

    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );

    if (!session) {
      throw new TurnkeyError(
        "No active session found.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }

    const onSuccess = () => {
      if (!successPageDuration) return;
      pushPage({
        key: "success",
        content: (
          <SuccessPage
            text="Email added successfully!"
            duration={successPageDuration}
            onComplete={() => {
              closeModal();
            }}
          />
        ),
        preventBack: true,
        showTitle: false,
      });
    };

    try {
      if (!params?.email && params?.email !== "") {
        return withTurnkeyErrorHandling(
          () =>
            new Promise((resolve, reject) => {
              pushPage({
                key: "Add Email",
                content: (
                  <UpdateEmail
                    successPageDuration={successPageDuration}
                    onSuccess={(userId: string) => {
                      resolve(userId);
                    }}
                    onError={(error) => reject(error)}
                    {...(!user?.userEmail
                      ? { title: title ?? "Connect an email" }
                      : {})}
                    {...(subTitle !== undefined ? { subTitle } : {})}
                  />
                ),
                showTitle: false,
              });
            }),
        );
      } else {
        const otpId = await initOtp({
          otpType: OtpType.Email,
          contact: params.email,
        });
        return withTurnkeyErrorHandling(
          () =>
            new Promise((resolve, reject) => {
              pushPage({
                key: "Add Email",
                content: (
                  <OtpVerification
                    otpType={OtpType.Email}
                    contact={params.email!}
                    otpId={otpId}
                    onContinue={async (otpCode: string) => {
                      try {
                        const { verificationToken } = await verifyOtp({
                          otpId,
                          otpCode,
                          contact: params.email!,
                          otpType: OtpType.Email,
                        });
                        const res = await updateUserEmail({
                          email: params.email!,
                          verificationToken,
                          userId: user!.userId,
                        });
                        onSuccess();
                        resolve(res);
                      } catch (error) {
                        reject(error);
                      }
                    }}
                    {...(!user?.userEmail && {
                      title: title ?? "Connect an email",
                    })}
                    {...(subTitle !== undefined && { subTitle })}
                  />
                ),
                showTitle: false,
              });
            }),
          callbacks,
          "Failed to add email",
        );
      }
    } catch (error) {
      if (error instanceof TurnkeyError) {
        throw error;
      }
      throw new TurnkeyError(
        "Failed to initialize OTP for email verification.",
        TurnkeyErrorCodes.INIT_OTP_ERROR,
        error,
      );
    }
  };

  const handleAddPhoneNumber = async (params?: {
    phoneNumber?: string;
    formattedPhone?: string;
    title?: string;
    subTitle?: string;
    successPageDuration?: number | undefined;
  }): Promise<string> => {
    const { successPageDuration = 2000, subTitle, title } = params || {};

    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );

    if (!session) {
      throw new TurnkeyError(
        "No active session found.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }
    if (!masterConfig) {
      throw new TurnkeyError(
        "Config is not ready yet!",
        TurnkeyErrorCodes.CONFIG_NOT_INITIALIZED,
      );
    }

    if (!masterConfig.auth?.methods?.smsOtpAuthEnabled) {
      throw new TurnkeyError(
        "SMS OTP authentication is not enabled in the configuration.",
        TurnkeyErrorCodes.AUTH_METHOD_NOT_ENABLED,
      );
    }

    const onSuccess = () => {
      if (!successPageDuration) return;
      pushPage({
        key: "success",
        content: (
          <SuccessPage
            text="Phone number updated successfully!"
            duration={successPageDuration}
            onComplete={() => {
              closeModal();
            }}
          />
        ),
        preventBack: true,
        showTitle: false,
      });
    };

    try {
      if (!params?.phoneNumber && params?.phoneNumber !== "") {
        return withTurnkeyErrorHandling(
          () =>
            new Promise((resolve, reject) => {
              pushPage({
                key: "Add Phone Number",
                content: (
                  <UpdatePhoneNumber
                    successPageDuration={successPageDuration}
                    onSuccess={(userId: string) => {
                      resolve(userId);
                    }}
                    onError={(error) => {
                      reject(error);
                    }}
                    {...(!user?.userPhoneNumber && {
                      title: title ?? "Connect a phone number",
                    })}
                    {...(subTitle !== undefined && { subTitle })}
                  />
                ),
                showTitle: false,
              });
            }),
          callbacks,
          "Failed to add phone number",
        );
      } else {
        const otpId = await initOtp({
          otpType: OtpType.Sms,
          contact: params.phoneNumber,
        });
        return withTurnkeyErrorHandling(
          () =>
            new Promise((resolve, reject) => {
              pushPage({
                key: "Add Phone Number",
                content: (
                  <OtpVerification
                    otpType={OtpType.Sms}
                    contact={params.phoneNumber!}
                    otpId={otpId}
                    onContinue={async (otpCode: string) => {
                      try {
                        const { verificationToken } = await verifyOtp({
                          otpId,
                          otpCode,
                          contact: params.phoneNumber!,
                          otpType: OtpType.Sms,
                        });
                        const res = await updateUserPhoneNumber({
                          phoneNumber: params.phoneNumber!,
                          verificationToken,
                          userId: user!.userId,
                        });
                        onSuccess();
                        resolve(res);
                      } catch (error) {
                        reject(error);
                      }
                    }}
                    {...(!user?.userPhoneNumber && {
                      title: title ?? "Connect a phone number",
                    })}
                    {...(subTitle !== undefined && { subTitle })}
                    {...(params!.formattedPhone && {
                      formattedPhone: params.formattedPhone,
                    })}
                  />
                ),
                showTitle: false,
              });
            }),
          callbacks,
          "Failed to add phone number",
        );
      }
    } catch (error) {
      if (error instanceof TurnkeyError) {
        throw error;
      }
      throw new TurnkeyError(
        "Failed to initialize OTP for sms verification.",
        TurnkeyErrorCodes.INIT_OTP_ERROR,
        error,
      );
    }
  };

  const handleRemovePasskey = async (params: {
    authenticatorId: string;
    userId?: string;
    title?: string;
    subTitle?: string;
    successPageDuration?: number | undefined;
    stampWith?: StamperType | undefined;
  }): Promise<string[]> => {
    const {
      authenticatorId,
      successPageDuration = 2000,
      subTitle,
      title,
      stampWith,
      userId,
    } = params;

    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    if (!session) {
      throw new TurnkeyError(
        "No active session found.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }
    return withTurnkeyErrorHandling(
      () =>
        new Promise((resolve, reject) => {
          pushPage({
            key: "Remove Passkey",
            content: (
              <RemovePasskey
                authenticatorId={authenticatorId}
                successPageDuration={successPageDuration}
                onSuccess={(authenticatorIds: string[]) => {
                  resolve(authenticatorIds);
                }}
                onError={(error) => {
                  reject(error);
                }}
                stampWith={stampWith}
                {...(userId && { userId })}
                {...(title !== undefined && { title })}
                {...(subTitle !== undefined && { subTitle })}
              />
            ),
            showTitle: false,
            preventBack: true,
          });
        }),
      callbacks,
      "Failed to remove passkey",
    );
  };

  const handleAddPasskey = async (params?: {
    name?: string;
    displayName?: string;
    userId?: string;
    successPageDuration?: number | undefined;
    stampWith?: StamperType | undefined;
  }): Promise<string[]> => {
    const {
      name,
      displayName,
      successPageDuration = 2000,
      stampWith,
    } = params || {};

    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    if (!session) {
      throw new TurnkeyError(
        "No active session found.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }
    const userId = params?.userId || session.userId;
    try {
      const resPromise = addPasskey({
        ...(name && { name }),
        ...(displayName && { displayName }),
        userId,
        stampWith,
      });
      resPromise.then(() => {
        pushPage({
          key: "Passkey Added",
          content: (
            <SuccessPage
              text="Successfully added passkey!"
              duration={successPageDuration}
              onComplete={() => {
                closeModal();
              }}
            />
          ),
          preventBack: true,
          showTitle: false,
        });
      });
      return await resPromise;
    } catch (error) {
      if (error instanceof TurnkeyError) {
        throw error;
      }
      throw new TurnkeyError(
        "Failed to add passkey in handler.",
        TurnkeyErrorCodes.ADD_PASSKEY_ERROR,
        error,
      );
    }
  };

  const handleRemoveOAuthProvider = async (params: {
    providerId: string;
    title?: string;
    subTitle?: string;
    successPageDuration?: number | undefined;
    stampWith?: StamperType | undefined;
  }): Promise<string[]> => {
    const {
      providerId,
      successPageDuration = 2000,
      subTitle,
      title,
      stampWith,
    } = params;

    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    if (!session) {
      throw new TurnkeyError(
        "No active session found.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }
    try {
      return new Promise((resolve, reject) => {
        pushPage({
          key: "Remove OAuth Provider",
          content: (
            <RemoveOAuthProvider
              providerId={providerId}
              stampWith={stampWith}
              successPageDuration={successPageDuration}
              onSuccess={(providerIds: string[]) => {
                resolve(providerIds);
              }}
              onError={(error: unknown) => {
                reject(error);
              }}
              {...(title !== undefined && { title })}
              {...(subTitle !== undefined && { subTitle })}
            />
          ),
          showTitle: false,
          preventBack: true,
        });
      });
    } catch (error) {
      if (error instanceof TurnkeyError) {
        throw error;
      }
      throw new TurnkeyError(
        "Failed to remove OAuth provider in handler.",
        TurnkeyErrorCodes.REMOVE_OAUTH_PROVIDER_ERROR,
        error,
      );
    }
  };

  const handleAddOAuthProvider = async (params: {
    providerName: OAuthProviders;
    stampWith?: StamperType | undefined;
  }): Promise<void> => {
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    if (!session) {
      throw new TurnkeyError(
        "No active session found.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }

    const { providerName, stampWith } = params;

    const onOAuthSuccess = async (params: {
      providerName: string;
      oidcToken: string;
    }) => {
      await withTurnkeyErrorHandling(
        () =>
          addOAuthProvider({
            providerName: params.providerName,
            oidcToken: params.oidcToken,
            stampWith,
          }),
        callbacks,
        "Failed to add OAuth provider",
      );
      pushPage({
        key: "OAuth Provider Added",
        content: (
          <SuccessPage
            text={`Successfully added ${params.providerName} OAuth provider!`}
            duration={3000}
            onComplete={() => {
              closeModal();
            }}
          />
        ),
        preventBack: true,
        showTitle: false,
      });
    };

    switch (providerName) {
      case OAuthProviders.GOOGLE: {
        await handleGoogleOauth({
          openInPage: false,
          onOAuthSuccess,
        });
        break;
      }
      case OAuthProviders.APPLE: {
        await handleAppleOauth({
          openInPage: false,
          onOAuthSuccess,
        });
        break;
      }
      case OAuthProviders.FACEBOOK: {
        await handleFacebookOauth({
          openInPage: false,
          onOAuthSuccess,
        });
        break;
      }
      default: {
        throw new TurnkeyError(
          `Unsupported OAuth provider: ${providerName}`,
          TurnkeyErrorCodes.NOT_FOUND,
        );
      }
    }
  };

  const handleLinkExternalWallet = async (params?: {
    successPageDuration?: number | undefined;
  }): Promise<void> => {
    const { successPageDuration = 2000 } = params || {};
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    if (!session) {
      throw new TurnkeyError(
        "No active session found.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }
    if (config.walletConfig?.features?.connecting) {
      throw new TurnkeyError(
        "Wallet connecting is not enabled.",
        TurnkeyErrorCodes.FEATURE_NOT_ENABLED,
      );
    }

    const providers = await getWalletProviders();

    pushPage({
      key: "Link Wallet",
      content: (
        <LinkWalletModal
          providers={providers}
          successPageDuration={successPageDuration}
        />
      ),
    });
  };

  const handleRemoveUserEmail = async (params?: {
    userId?: string;
    successPageDuration?: number | undefined;
    stampWith?: StamperType | undefined;
  }): Promise<string> => {
    const { successPageDuration = 2000, stampWith, userId } = params || {};
    if (!session) {
      throw new TurnkeyError(
        "No active session found.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }

    try {
      return new Promise((resolve, reject) => {
        pushPage({
          key: "Remove Email",
          content: (
            <RemoveEmail
              successPageDuration={successPageDuration}
              {...(userId && { userId })}
              {...(stampWith && { stampWith })}
              onSuccess={(userId: string) => {
                resolve(userId);
              }}
              onError={(error: unknown) => {
                reject(error);
              }}
            />
          ),
          showTitle: false,
          preventBack: true,
        });
      });
    } catch (error) {
      if (error instanceof TurnkeyError) {
        throw error;
      }
      throw new TurnkeyError(
        "Failed to remove user email.",
        TurnkeyErrorCodes.UPDATE_USER_EMAIL_ERROR,
        error,
      );
    }
  };

  const handleRemoveUserPhoneNumber = async (params?: {
    userId?: string;
    successPageDuration?: number | undefined;
    stampWith?: StamperType | undefined;
  }): Promise<string> => {
    const { successPageDuration = 2000, stampWith, userId } = params || {};
    if (!session) {
      throw new TurnkeyError(
        "No active session found.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }

    try {
      return new Promise((resolve, reject) => {
        pushPage({
          key: "Remove Phone Number",
          content: (
            <RemovePhoneNumber
              successPageDuration={successPageDuration}
              {...(userId && { userId })}
              {...(stampWith && { stampWith })}
              onSuccess={(userId: string) => {
                resolve(userId);
              }}
              onError={(error: unknown) => {
                reject(error);
              }}
            />
          ),
          showTitle: false,
          preventBack: true,
        });
      });
    } catch (error) {
      if (error instanceof TurnkeyError) {
        throw error;
      }
      throw new TurnkeyError(
        "Failed to remove user phone number.",
        TurnkeyErrorCodes.UPDATE_USER_PHONE_NUMBER_ERROR,
        error,
      );
    }
  };

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
        switchWalletProviderChain,
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
        addOAuthProvider,
        removeOAuthProviders,
        addPasskey,
        removePasskeys,
        createWallet,
        createWalletAccounts,
        exportWallet,
        importWallet,
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
        handleLogin,
        handleGoogleOauth,
        handleAppleOauth,
        handleFacebookOauth,
        handleExport,
        handleImport,
        handleUpdateUserEmail,
        handleUpdateUserPhoneNumber,
        handleUpdateUserName,
        handleAddOAuthProvider,
        handleRemoveOAuthProvider,
        handleAddPasskey,
        handleRemovePasskey,
        handleAddEmail,
        handleAddPhoneNumber,
        handleSignMessage,
        handleLinkExternalWallet,
        handleRemoveUserEmail,
        handleRemoveUserPhoneNumber,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
};
