import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import {
  APPLE_AUTH_URL,
  AuthState,
  ClientState,
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
  TurnkeyClient,
  Wallet,
  type DefaultParams,
  WalletAccount,
  WalletProvider,
  WalletType,
} from "@turnkey/sdk-js";
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
  type v1WalletAccount,
  type v1WalletAccountParams,
  type v1PayloadEncoding,
  type v1HashFunction,
} from "@turnkey/sdk-types";
import { useModal } from "../modal/Hook";
import {
  type TurnkeyCallbacks,
  type TurnkeyProviderConfig,
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

  // we use debouncedFetchWallets() to prevent multiple rapid wallet events
  // like accountsChanged and disconnect from triggering fetchWallets repeatedly
  // it must be defined outside the useEffect so all event listeners share the same
  // debounced function instance - otherwise, a new one would be created on every render
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
    if (!client) return;
    initializeSessions();

    return () => {
      clearSessionTimeouts();
    };
  }, [client]);

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
        proxyAuthConfig?.emailEnabled,
      smsOtpAuthEnabled:
        config.auth?.methods?.smsOtpAuthEnabled ?? proxyAuthConfig?.smsEnabled,
      passkeyAuthEnabled:
        config.auth?.methods?.passkeyAuthEnabled ??
        proxyAuthConfig?.passkeyEnabled,
      walletAuthEnabled:
        config.auth?.methods?.walletAuthEnabled ??
        proxyAuthConfig?.walletEnabled,
      googleOAuthEnabled:
        config.auth?.methods?.googleOAuthEnabled ??
        proxyAuthConfig?.googleEnabled,
      appleOAuthEnabled:
        config.auth?.methods?.appleOAuthEnabled ??
        proxyAuthConfig?.appleEnabled,
      facebookOAuthEnabled:
        config.auth?.methods?.facebookOAuthEnabled ??
        proxyAuthConfig?.facebookEnabled,
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
          openOAuthInPage:
            config.auth?.oAuthConfig?.openOAuthInPage ??
            proxyAuthConfig?.openOAuthInPage,
        },
        sessionExpirationSeconds: proxyAuthConfig?.sessionExpirationSeconds,
        methodOrder,
        oauthOrder,
      },
      importIframeUrl: config.importIframeUrl ?? "https://import.turnkey.com",
      exportIframeUrl: config.exportIframeUrl ?? "https://export.turnkey.com",
    } as TurnkeyProviderConfig;
  };

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
          ethereum: config.walletConfig?.ethereum ?? true,
          solana: config.walletConfig?.solana ?? true,
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

  async function scheduleSessionExpiration(params: {
    sessionKey: string;
    expiry: number;
  }) {
    const { sessionKey, expiry } = params;

    try {
      // Clear any existing timeout for this session key
      if (expiryTimeoutsRef.current[sessionKey]) {
        clearTimeout(expiryTimeoutsRef.current[sessionKey]);
      }

      if (expiryTimeoutsRef.current[`${sessionKey}-warning`]) {
        clearTimeout(expiryTimeoutsRef.current[`${sessionKey}-warning`]);
      }

      const timeUntilExpiry = expiry * 1000 - Date.now();

      const beforeExpiry = async () => {
        const activeSession = await getSession();
        if (!activeSession && expiryTimeoutsRef.current[sessionKey]) {
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
            expirationSeconds: session.expirationSeconds,
            sessionKey,
          });
        }
        delete expiryTimeoutsRef.current[`${sessionKey}-warning`];
      };

      const expireSession = async () => {
        const expiredSession = await getSession({ sessionKey });
        if (!expiredSession) return;

        callbacks?.onSessionExpired?.({ sessionKey });

        await clearSession({ sessionKey });

        delete expiryTimeoutsRef.current[sessionKey];
        delete expiryTimeoutsRef.current[`${sessionKey}-warning`];
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

  /**
   * Creates a new passkey authenticator for the current user.
   *
   * - This function generates a new passkey attestation and challenge, which can be used to register a passkey authenticator with the user's device.
   * - The passkey can be used for passwordless authentication and is stored securely in the user's browser/device.
   * - If a name or displayName is not provided, a default will be generated based on the website and current timestamp.
   * - This does not automatically link the passkey to the user; use `addPasskey` to associate the created passkey with the user's account.
   *
   * @param name - Optional. The internal name for the passkey. If not provided, a default name will be generated.
   * @param displayName - Optional. The display name for the passkey, shown to the user. If not provided, a default display name will be generated based on the website and timestamp.
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to an object containing:
   *   - attestation: The attestation object returned from the passkey creation process, suitable for registration with the backend.
   *   - encodedChallenge: The encoded challenge string used for passkey registration, which should be sent to the backend for verification.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error during passkey creation.
   */
  async function createPasskey(
    params?: {
      name?: string;
      displayName?: string;
    } & DefaultParams,
  ): Promise<{ attestation: v1Attestation; encodedChallenge: string }> {
    if (!client) {
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    }
    return withTurnkeyErrorHandling(
      () => client.createPasskey(params),
      callbacks,
      "Failed to create passkey",
    );
  }

  /**
   * Logs out the current client session.
   *
   * - This function logs out the user from the specified session or the active session if no sessionKey is provided.
   * - It clears the session from storage, removes all associated session and warning timeouts, and resets all session/user/wallet state in the provider.
   * - After logout, all sensitive information is removed from memory and the provider returns to an unauthenticated state.
   * - This function should be used for both single-session and multi-session logout flows.
   *
   * @param sessionKey - Optional session key to specify which session to log out from (defaults to the active session).
   * @returns A promise that resolves when the logout process is complete.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error during the logout process.
   */
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

  /**
   * Logs in a user using a passkey, optionally specifying a public key and session key.
   *
   * - This function initiates the login process using a passkey authenticator, which can be either a platform passkey or a custom key-pair.
   * - It creates a new session for the user and stores the session token upon successful authentication.
   * - If a publicKey is provided, it will use that key for authentication; otherwise, a key pair will be generated.
   * - If a sessionKey is provided, the session will be stored under that key; otherwise, the default active session key is used.
   * - Automatically refreshes user and wallet state after successful login.
   *
   * @param publicKey - Optional. The public key of a custom key-pair to use for authentication stamping.
   * @param sessionKey - Optional. The session key to use for session creation and storage.
   * @returns A promise that resolves to a signed JWT session token.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error during the login process.
   */
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

  /**
   * Signs up a user using a passkey, creating a sub-organization and initializing a session.
   *
   * - This function creates a new passkey authenticator and uses it to register a new user.
   * - It creates a sub-organization using the provided parameters, or falls back to the configuration defaults if not specified.
   * - The passkey display name can be customized, or will default to a generated name based on the website and timestamp.
   * - The session expiration time is determined by the configuration or a default value.
   * - After successful sign-up, the session and user state are refreshed and session expiration is scheduled.
   *
   * @param createSubOrgParams - Optional parameters for creating a sub-organization. If not provided, uses configuration defaults.
   * @param sessionKey - Optional session key to use for session creation and storage.
   * @param passkeyDisplayName - Optional display name for the passkey. If not provided, a default is generated.
   * @returns A promise that resolves to a signed JWT session token.
   * @throws {TurnkeyError} If the client is not initialized, configuration is not ready, or if there is an error during sign-up.
   */
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

  // TODO: MOE PLEASE COMMENT THESE
  async function getWalletProviders(chain?: Chain): Promise<WalletProvider[]> {
    if (!client) {
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    }
    return await client.getWalletProviders(chain);
  }

  // TODO: MOE PLEASE COMMENT THESE
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

  // TODO: MOE PLEASE COMMENT THESE
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
    await refreshWallets();
  }

  // TODO: MOE PLEASE COMMENT THESE
  async function initializeProviders(
    getWalletProviders: (chain: Chain) => Promise<WalletProvider[]>,
    onWalletsChanged: () => void,
  ): Promise<() => void> {
    const cleanups: Array<() => void> = [];

    const [ethProviders, solProviders] = await Promise.all([
      getWalletProviders(WalletType.Ethereum),
      getWalletProviders(WalletType.Solana),
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

  // TODO: MOE PLEASE COMMENT THESE
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

  // TODO: MOE PLEASE COMMENT THESE
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

  // TODO: MOE PLEASE COMMENT THESE
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

  /**
   * Initializes the OTP (One-Time Password) process by sending an OTP code to the specified contact.
   *
   * - This function triggers the sending of an OTP code to the user's contact information (email address or phone number) via the configured authentication proxy.
   * - Supports both email and SMS OTP flows, as determined by the `otpType` parameter.
   * - The OTP code is used for subsequent verification as part of login, sign-up, or sensitive user actions (such as updating email or phone).
   * - Returns an OTP identifier (otpId) that must be used in the verification step.
   *
   * @param otpType - The type of OTP to initialize (OtpType.Email or OtpType.Sms).
   * @param contact - The contact information for the user (e.g., email address or phone number) to which the OTP will be sent.
   * @returns A promise that resolves to an OTP identifier (otpId) as a string, which is required for OTP verification.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error during the OTP initialization process.
   */
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

  /**
   * Verifies the OTP (One-Time Password) code sent to the user.
   *
   * - This function verifies the OTP code entered by the user against the OTP sent to their contact information (email or phone) via the configured authentication proxy.
   * - Supports both email and SMS OTP flows, as determined by the `otpType` parameter.
   * - Returns the sub-organization ID if the contact is already associated with an existing sub-organization, and a verification token to be used for login or sign-up.
   * - The verification token can be used in subsequent authentication steps (loginWithOtp, signUpWithOtp, or completeOtp).
   * - This function is typically called after `initOtp` to complete the OTP verification process.
   *
   * @param otpId - The ID of the OTP to verify (returned from `initOtp`).
   * @param otpCode - The OTP code entered by the user.
   * @param contact - The contact information for the user (e.g., email address or phone number) to which the OTP was sent.
   * @param otpType - The type of OTP being verified (OtpType.Email or OtpType.Sms).
   * @returns A promise that resolves to an object containing:
   *   - subOrganizationId: The sub-organization ID if the contact is already associated with a suborg, or an empty string if not.
   *   - verificationToken: The verification token to be used for login or sign-up.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error during OTP verification.
   */
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

  /**
   * Logs in a user using an OTP (One-Time Password) verification token.
   *
   * - This function logs in a user using the verification token received after successful OTP verification (via email or SMS).
   * - Supports optional authentication with a custom key-pair by providing a publicKey.
   * - Can optionally invalidate any existing sessions for the user if invalidateExisting is set to true.
   * - Allows specifying a custom sessionKey for storing the session, otherwise uses the default active session key.
   * - After successful login, updates the session state and refreshes user and wallet information.
   *
   * @param verificationToken - The verification token received after OTP verification (from verifyOtp).
   * @param publicKey - Optional public key of a custom key-pair to use for authentication stamping.
   * @param invalidateExisting - Optional flag to invalidate existing sessions for the user.
   * @param sessionKey - Optional session key to use for session creation and storage.
   * @returns A promise that resolves to a signed JWT session token.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error during login with OTP.
   */
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

  /**
   * Signs up a user using an OTP (One-Time Password) verification token.
   *
   * - This function registers a new user (sub-organization) using the verification token received after successful OTP verification (via email or SMS).
   * - It creates a sub-organization with the provided parameters, or falls back to the configuration defaults if not specified.
   * - The OTP type (OtpType.Email or OtpType.Sms) determines which default sub-organization parameters are used if not explicitly provided.
   * - Optionally, a custom session key can be specified for session creation and storage.
   * - After successful sign-up, the session and user state are refreshed and session expiration is scheduled.
   *
   * @param verificationToken - The verification token received after OTP verification (from verifyOtp).
   * @param contact - The contact information for the user (e.g., email address or phone number) to associate with the new sub-organization.
   * @param otpType - The type of OTP being used (OtpType.Email or OtpType.Sms).
   * @param createSubOrgParams - Optional parameters for creating a sub-organization (overrides configuration defaults).
   * @param sessionKey - Optional session key to use for session creation and storage.
   * @returns A promise that resolves to a signed JWT session token.
   * @throws {TurnkeyError} If the client is not initialized, configuration is not ready, or if there is an error during sign-up with OTP.
   */
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

  /**
   * Completes the OTP (One-Time Password) authentication flow by verifying the OTP code and either logging in or signing up the user.
   *
   * - This function verifies the OTP code for the provided contact (email or phone) and determines if the contact is already associated with an existing sub-organization.
   * - If the contact is associated with an existing sub-organization, it logs in the user and creates a session.
   * - If the contact is not associated with any sub-organization, it creates a new sub-organization using the provided parameters and then logs in the user.
   * - Supports both email and SMS OTP flows, as determined by the `otpType` parameter.
   * - Allows for optional authentication with a custom key-pair by providing a `publicKey`.
   * - Can optionally invalidate any existing sessions for the user if `invalidateExisting` is set to true.
   * - Allows specifying a custom `sessionKey` for storing the session, otherwise uses the default active session key.
   * - Optionally accepts `createSubOrgParams` to customize sub-organization creation.
   * - After successful completion, updates the session and user state, and schedules session expiration.
   *
   * @param otpId - The ID of the OTP to complete (returned from `initOtp`).
   * @param otpCode - The OTP code entered by the user.
   * @param contact - The contact information for the user (e.g., email address or phone number) to which the OTP was sent.
   * @param otpType - The type of OTP being completed (OtpType.Email or OtpType.Sms).
   * @param publicKey - Optional public key of a custom key-pair to use for authentication stamping.
   * @param invalidateExisting - Optional flag to invalidate existing sessions for the user.
   * @param sessionKey - Optional session key to use for session creation and storage.
   * @param createSubOrgParams - Optional parameters for creating a sub-organization (overrides configuration defaults).
   * @returns A promise that resolves to a signed JWT session token.
   * @throws {TurnkeyError} If the client is not initialized, configuration is not ready, or if there is an error during OTP completion.
   */
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

  /**
   * Completes the OAuth authentication flow by either signing up or logging in the user,
   * depending on whether a sub-organization already exists for the provided OIDC token.
   *
   * - Handles both new user registration (sign-up) and returning user authentication (login) seamlessly.
   * - If the user does not have an existing sub-organization, a new one is created using the provided or default parameters.
   * - Supports passing a custom session key, provider name, and sub-organization creation parameters.
   * - Automatically updates session and user state, and schedules session expiration after successful authentication.
   * - Triggers any configured callbacks for error handling or session events.
   *
   * @param oidcToken - The OIDC token received after successful OAuth authentication.
   * @param publicKey - The public key used for authentication and nonce generation.
   * @param providerName - Optional. The name of the OAuth provider (e.g., "google", "apple", "facebook").
   * @param sessionKey - Optional. The session key to use for session creation and storage.
   * @param invalidateExisting - Optional. Whether to invalidate any existing sessions for the user.
   * @param createSubOrgParams - Optional. Parameters for sub-organization creation (overrides config defaults).
   * @returns A promise that resolves to a signed JWT session token.
   * @throws {TurnkeyError} If the client or configuration is not initialized, or if there is an error during OAuth completion.
   */
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

  /**
   * Logs in a user using OAuth authentication.
   *
   * - This function logs in a user using the provided OIDC token and public key, typically after a successful OAuth flow (Google, Apple, Facebook, etc).
   * - Optionally, it can invalidate any existing sessions for the user if `invalidateExisting` is set to true.
   * - Allows specifying a custom `sessionKey` for storing the session; otherwise, the default active session key is used.
   * - After successful login, updates the session state and refreshes user and wallet information to ensure the provider state is up to date.
   * - Triggers any configured callbacks for error handling or session events.
   *
   * @param oidcToken - The OIDC token received after successful OAuth authentication.
   * @param publicKey - The public key used for authentication and nonce generation.
   * @param invalidateExisting - Optional flag to invalidate existing sessions for the user.
   * @param sessionKey - Optional session key to use for session creation and storage.
   * @returns A promise that resolves to a signed JWT session token.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error during login with OAuth.
   */
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

  /**
   * Signs up a user using OAuth authentication.
   *
   * - This function registers a new user (sub-organization) using the provided OIDC token, public key, and provider name.
   * - If `createSubOrgParams` is not provided, it uses the default parameters from the configuration for OAuth sign-up.
   * - Optionally, a custom `sessionKey` can be specified for session creation and storage.
   * - After successful sign-up, the session and user state are refreshed and session expiration is scheduled.
   * - Triggers any configured callbacks for error handling or session events.
   *
   * @param oidcToken - The OIDC token received after successful OAuth authentication.
   * @param publicKey - The public key used for authentication and nonce generation.
   * @param providerName - The name of the OAuth provider (e.g., "google", "apple", "facebook").
   * @param createSubOrgParams - Optional parameters for creating a sub-organization (overrides configuration defaults).
   * @param sessionKey - Optional session key to use for session creation and storage.
   * @returns A promise that resolves to a signed JWT session token.
   * @throws {TurnkeyError} If the client or configuration is not initialized, or if there is an error during sign-up with OAuth.
   */
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

  /**
   * Fetches a list of wallets for the current user session.
   *
   * - Retrieves all wallets associated with the userId of the current session or the specified user.
   * - Automatically includes all wallet accounts for each wallet.
   * - Supports optional stamping with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for request authentication.
   * - Can be used to refresh the wallet state after wallet creation, import, or account changes.
   *
   * @param stampWith - Optional. Specifies the stamper to use for the request (Passkey, ApiKey, or Wallet).
   * @returns A promise that resolves to an array of `Wallet` objects, each containing wallet metadata and associated accounts.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error fetching wallets.
   */
  async function fetchWallets(params?: DefaultParams): Promise<Wallet[]> {
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

  /**
   * Fetches a list of wallet accounts for a specific wallet.
   *
   * - Retrieves all accounts associated with the provided wallet, including metadata and account details.
   * - Supports optional pagination to control the number of accounts returned per request (defaults to the first page with a limit of 100 accounts if not specified).
   * - Can be stamped with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for request authentication.
   * - Useful for refreshing wallet account state after account creation, import, or external wallet linking.
   *
   * @param wallet - The wallet object for which to fetch accounts.
   * @param paginationOptions - Optional pagination options (before, after, and limit).
   * @param walletProviders - Optional list of wallet providers to filter or enrich the results.
   * @param stampWith - Optional parameter to stamp the request with a specific stamper.
   * @returns A promise that resolves to an array of `v1WalletAccount` objects containing account details.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error fetching wallet accounts.
   */
  async function fetchWalletAccounts(
    params: {
      wallet: Wallet;
      paginationOptions?: v1Pagination;
      walletProviders?: WalletProvider[];
    } & DefaultParams,
  ): Promise<v1WalletAccount[]> {
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

  /**
   * Signs a message using the specified wallet account.
   *
   * - This function automatically determines the appropriate encoding and hash function for the message based on the wallet account's address type (e.g., Ethereum, Solana, Tron), unless explicitly overridden by the caller.
   * - Supports signing with any wallet account managed by Turnkey, including externally linked wallets.
   * - Handles all necessary message preparation steps, such as encoding (e.g., UTF-8, hex) and hashing (e.g., SHA256, Keccak256), to ensure compatibility with the target blockchain.
   * - Optionally allows the caller to override the encoding and hash function for advanced use cases.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular control over authentication.
   * - Returns a result object containing the signed payload.
   *
   * @param message - The message to sign.
   * @param walletAccount - The wallet account to use for signing.
   * @param encoding - Optional override for the encoding used for the payload (defaults to the proper encoding for the address type).
   * @param hashFunction - Optional hash function to use (defaults to the proper hash function for the address type).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to a `v1SignRawPayloadResult` object containing the signed message, signature, and metadata.
   * @throws {TurnkeyError} If the client is not initialized, the wallet account is invalid, or if there is an error signing the message.
   */
  async function signMessage(
    params: {
      message: string;
      walletAccount: v1WalletAccount;
      encoding?: v1PayloadEncoding;
      hashFunction?: v1HashFunction;
    } & DefaultParams,
  ): Promise<v1SignRawPayloadResult> {
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

  /**
   * Handles the signing of a message by displaying a modal for user interaction.
   *
   * - This function opens a modal with the SignMessageModal component, prompting the user to review and approve the message signing request.
   * - Supports signing with any wallet account managed by Turnkey, including externally linked wallets.
   * - Allows for optional overrides of the encoding and hash function used for the payload, enabling advanced use cases or compatibility with specific blockchains.
   * - Optionally displays a subtext in the modal for additional context or instructions to the user.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Returns a promise that resolves to a `v1SignRawPayloadResult` object containing the signed message, signature, and metadata.
   *
   * @param message - The message to sign.
   * @param walletAccount - The wallet account to use for signing.
   * @param encoding - Optional encoding for the payload (defaults to the proper encoding for the account type).
   * @param hashFunction - Optional hash function to use (defaults to the appropriate function for the account type).
   * @param subText - Optional subtext to display in the modal.
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @param successPageDuration - Optional duration in seconds to display the success page after signing.
   * @returns A promise that resolves to a `v1SignRawPayloadResult` object containing the signed message.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error during the signing process.
   */
  async function handleSignMessage(
    params: {
      message: string;
      walletAccount: v1WalletAccount;
      encoding?: v1PayloadEncoding;
      hashFunction?: v1HashFunction;
      subText?: string;
      successPageDuration?: number | undefined;
    } & DefaultParams,
  ): Promise<v1SignRawPayloadResult> {
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    return withTurnkeyErrorHandling(
      () =>
        new Promise((resolve, reject) => {
          pushPage({
            key: "Sign Message",
            content: (
              <SignMessageModal
                message={params.message}
                subText={params?.subText}
                walletAccount={params.walletAccount}
                stampWith={params.stampWith}
                successPageDuration={params.successPageDuration}
                onSuccess={(result) => {
                  resolve(result);
                }}
                onError={(error) => {
                  reject(error);
                }}
                {...(params?.encoding ? { encoding: params.encoding } : {})}
                {...(params?.hashFunction
                  ? { hashFunction: params.hashFunction }
                  : {})}
              />
            ),
          });
        }),
      callbacks,
      "Failed to sign message",
    );
  }

  /**
   * Signs a transaction using the specified wallet account.
   *
   * - This function signs transactions for all supported blockchain networks (e.g., Ethereum, Solana, Tron).
   * - It automatically determines the correct signing method and handles any required encoding or hashing for the target blockchain.
   * - Supports signing with any wallet account managed by Turnkey, including externally linked wallets.
   * - Optionally allows the caller to specify a stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Returns a result object containing the signed transaction and any relevant metadata.
   *
   * @param signWith - The wallet address or account ID to use for signing the transaction.
   * @param unsignedTransaction - The unsigned transaction data to sign (as a serialized string).
   * @param type - The type of transaction (e.g., "TRANSACTION_TYPE_ETHEREUM", "TRANSACTION_TYPE_SOLANA", or "TRANSACTION_TYPE_TRON").
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to a `TSignTransactionResponse` object containing the signed transaction and metadata.
   * @throws {TurnkeyError} If the client is not initialized, the wallet account is invalid, or if there is an error signing the transaction.
   */
  async function signTransaction(
    params: {
      unsignedTransaction: string;
      transactionType: v1TransactionType;
      walletAccount: WalletAccount;
    } & DefaultParams,
  ): Promise<string> {
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

  /**
   * Fetches the user details for the current session or a specified user.
   *
   * - Retrieves user details based on the provided userId and/or organizationId, or defaults to the userId and organizationId from the current session if not specified.
   * - Supports optional stamping with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for request authentication.
   * - Useful for refreshing user profile information after authentication, updates, or linking/unlinking authenticators.
   * - Automatically handles error reporting via the configured callbacks.
   *
   * @param organizationId - Optional. The organization ID (sub-organization) to fetch the user from. Defaults to the current session's organization if not provided.
   * @param userId - Optional. The user ID to fetch. Defaults to the current session's userId if not provided.
   * @param stampWith - Optional. Specifies the stamper to use for the request (Passkey, ApiKey, or Wallet).
   * @returns A promise that resolves to a `v1User` object containing the user details.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error fetching user details.
   */
  async function fetchUser(
    params?: {
      organizationId?: string;
      userId?: string;
    } & DefaultParams,
  ): Promise<v1User> {
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

  /**
   * Updates the user's email address.
   *
   * - This function updates the user's email address and, if provided, verifies it using a verification token (typically from an OTP flow).
   * - If a userId is provided, it updates the email for that specific user; otherwise, it uses the current session's userId.
   * - If a verificationToken is not provided, the email will be updated but may not be marked as verified until verification is completed.
   * - Automatically refreshes the user details state variable after the update to ensure the latest user information is available in the provider.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Can be used as part of both add and update email flows, including modal-driven UI flows.
   *
   * @param email - The new email address to set for the user.
   * @param verificationToken - Optional verification token from OTP email verification (required for verified status).
   * @param userId - Optional user ID to update a specific user's email (defaults to the current session's userId).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (Passkey, ApiKey, or Wallet).
   * @returns A promise that resolves to the userId of the updated user.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error updating the user email.
   */
  async function updateUserEmail(
    params: {
      email: string;
      verificationToken?: string;
      userId?: string;
    } & DefaultParams,
  ): Promise<string> {
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

  /**
   * Removes the user's email address.
   *
   * - This function removes the user's email address from their profile and automatically refreshes the user details state variable to reflect the change.
   * - If a userId is provided, it removes the email for that specific user; otherwise, it defaults to the current session's userId.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - After removal, the user details are refreshed to ensure the latest state is available in the provider.
   *
   * @param userId - Optional user ID to remove a specific user's email (defaults to the current session's userId).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to the userId of the user whose email was removed.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error removing the user email.
   */
  async function removeUserEmail(
    params?: { userId?: string } & DefaultParams,
  ): Promise<string> {
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

  /**
   * Updates the user's phone number.
   *
   * - This function updates the user's phone number and, if provided, verifies it using a verification token (typically from an OTP flow).
   * - If a userId is provided, it updates the phone number for that specific user; otherwise, it uses the current session's userId.
   * - If a verificationToken is not provided, the phone number will be updated but may not be marked as verified until verification is completed.
   * - Automatically refreshes the user details state variable after the update to ensure the latest user information is available in the provider.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Can be used as part of both add and update phone number flows, including modal-driven UI flows.
   *
   * @param phoneNumber - The new phone number to set for the user.
   * @param verificationToken - Optional verification token from OTP phone verification (required for verified status).
   * @param userId - Optional user ID to update a specific user's phone number (defaults to the current session's userId).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (Passkey, ApiKey, or Wallet).
   * @returns A promise that resolves to the userId of the updated user.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error updating the user phone number.
   */
  async function updateUserPhoneNumber(
    params: {
      phoneNumber: string;
      verificationToken?: string;
      userId?: string;
    } & DefaultParams,
  ): Promise<string> {
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

  /**
   * Removes the user's phone number.
   *
   * - This function removes the user's phone number from their user data and automatically refreshes the user details state variable to reflect the change.
   * - If a userId is provided, it removes the phone number for that specific user; otherwise, it defaults to the current session's userId.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - After removal, the user details are refreshed to ensure the latest state is available in the provider.
   *
   * @param userId - Optional user ID to remove a specific user's phone number (defaults to the current session's userId).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to the userId of the user whose phone number was removed.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error removing the user phone number.
   */
  async function removeUserPhoneNumber(
    params?: {
      userId?: string;
    } & DefaultParams,
  ): Promise<string> {
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

  /**
   * Updates the user's name.
   *
   * - This function updates the user's name and automatically refreshes the user details state variable to reflect the change.
   * - If a userId is provided, it updates the name for that specific user; otherwise, it uses the current session's userId.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - After the update, the latest user information is fetched to ensure the provider state is up to date.
   *
   * @param userName - The new name to set for the user.
   * @param userId - Optional user ID to update a specific user's name (defaults to the current session's userId).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (Passkey, ApiKey, or Wallet).
   * @returns A promise that resolves to the userId of the updated user.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error updating the user name.
   */
  async function updateUserName(
    params: {
      userName: string;
      userId?: string;
    } & DefaultParams,
  ): Promise<string> {
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

  /**
   * Adds an OAuth provider to the user.
   *
   * - This function links an OAuth provider (Google, Apple, Facebook, etc.) to the user's data and automatically refreshes the user details state variable.
   * - If a userId is provided, it adds the provider for that specific user; otherwise, it uses the current session's userId.
   * - The function requires a valid OIDC token from the OAuth provider, which is typically obtained after a successful OAuth authentication flow.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - After successful addition, the user details are refreshed to ensure the latest state is available in the provider.
   * - Can be used as part of modal-driven UI flows or directly in code.
   *
   * @param providerName - The name of the OAuth provider to add (e.g., "google", "apple", "facebook").
   * @param oidcToken - The OIDC token for the OAuth provider, obtained from the OAuth flow.
   * @param userId - Optional user ID to add the provider for a specific user (defaults to current session's userId).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to an array of provider IDs linked to the user after the addition.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error adding the OAuth provider.
   */
  async function addOAuthProvider(
    params: {
      providerName: string;
      oidcToken: string;
      userId?: string;
    } & DefaultParams,
  ): Promise<string[]> {
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

  /**
   * Removes OAuth providers from the user.
   *
   * - This function removes OAuth providers (such as Google, Apple, or Facebook) from the user's linked authentication methods.
   * - Automatically refreshes the user details state variable after removal to ensure the latest provider list is available in the provider.
   * - If a userId is provided, it removes the providers for that specific user; otherwise, it defaults to the current session's userId.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Can be used as part of modal-driven UI flows or directly in code.
   *
   * @param providerIds - The IDs of the OAuth providers to remove (as found in the user's provider list).
   * @param userId - Optional user ID to remove the providers for a specific user (defaults to the current session's userId).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to an array of provider IDs that were removed.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error removing the OAuth provider.
   */
  async function removeOAuthProviders(
    params: {
      providerIds: string[];
      userId?: string;
    } & DefaultParams,
  ): Promise<string[]> {
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

  /**
   * Adds a passkey for the user.
   *
   * - This function prompts the user to create a new passkey authenticator (using WebAuthn/FIDO2) and adds it to the user's authenticators.
   * - If a userId is provided, the passkey is added for that specific user; otherwise, it defaults to the current session's userId.
   * - The passkey can be given a custom name and displayName, which are stored as metadata and shown in the UI.
   * - After successful addition, the user details state is automatically refreshed to reflect the new authenticator.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Can be used as part of modal-driven UI flows or directly in code.
   *
   * - Note: A passkey authenticator must be present in the user's authenticators list to use Passkey stamper to add a new one.
   *
   * @param name - Optional internal name for the passkey (for backend or developer reference).
   * @param displayName - Optional display name for the passkey (shown to the user in the UI).
   * @param userId - Optional user ID to add the passkey for a specific user (defaults to current session's userId).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to an array of authenticator IDs (passkey IDs) after the addition.
   * @throws {TurnkeyError} If the client is not initialized, no session is found, or if there is an error adding the passkey.
   */
  async function addPasskey(
    params?: {
      name?: string;
      displayName?: string;
      userId?: string;
    } & DefaultParams,
  ): Promise<string[]> {
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

  /**
   * Removes passkeys (authenticators) for the user.
   *
   * - This function removes passkey authenticators from the user's data and automatically refreshes the user details state variable to reflect the change.
   * - If a userId is provided, it removes the passkeys for that specific user; otherwise, it defaults to the current session's userId.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - After removal, the user details are refreshed to ensure the latest authenticators list is available in the provider.
   * - Can be used as part of modal-driven UI flows or directly in code.
   *
   * @param authenticatorId - The ID of the authenticator (passkey) to remove.
   * @param userId - Optional user ID to remove the passkey for a specific user (defaults to the current session's userId).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to an array of authenticator IDs that were removed.
   * @throws {TurnkeyError} If the client is not initialized, no session is found, or if there is an error removing the passkey.
   */
  async function removePasskeys(
    params: {
      authenticatorIds: string[];
      userId?: string;
    } & DefaultParams,
  ): Promise<string[]> {
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

  /**
   * Creates a new wallet for the user.
   *
   * - This function creates a new wallet for the user and automatically refreshes the wallets state variable after creation.
   * - If an organizationId is provided, the wallet will be created under that specific sub-organization; otherwise, it uses the current session's organization.
   * - If a list of account parameters or address formats is provided, those accounts will be created in the wallet (starting from path index 0 for address formats).
   * - Optionally, you can specify the mnemonic length for the wallet seed phrase.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - After creation, the wallets state is refreshed to reflect the new wallet.
   *
   * @param walletName - The name of the wallet to create.
   * @param accounts - Optional array of account parameters or address formats to create in the wallet.
   * @param organizationId - Optional organization ID to create the wallet under a specific sub-organization (defaults to current session's organization).
   * @param mnemonicLength - Optional mnemonic length for the wallet seed phrase.
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to the ID of the newly created wallet.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error creating the wallet.
   */
  async function createWallet(
    params: {
      walletName: string;
      accounts?: v1WalletAccountParams[] | v1AddressFormat[];
      organizationId?: string;
      mnemonicLength?: number;
    } & DefaultParams,
  ): Promise<string> {
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

  /**
   * Creates new accounts in the specified wallet.
   *
   * - This function creates new wallet accounts in an existing wallet, using either explicit account parameters or address formats.
   * - If `accounts` is an array of account parameters, each account will be created with the specified settings.
   * - If `accounts` is an array of address formats, the function will determine the next available path index for each format and create new accounts accordingly.
   * - Automatically refreshes the wallets state variable after the accounts are created to ensure the latest state is available in the provider.
   * - If an `organizationId` is provided, the accounts will be created under that sub-organization (the walletId must belong to the sub-org).
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Can be used to add additional accounts to a wallet after initial creation, or to support new chains/address types.
   *
   * @param accounts - An array of account parameters (`v1WalletAccountParams[]`) or address formats (`v1AddressFormat[]`) to create in the wallet.
   * @param walletId - The ID of the wallet to create accounts in.
   * @param organizationId - Optional organization ID to create the accounts under a specific sub-organization (walletId must be associated with the sub-org).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to an array of account IDs for the newly created accounts.
   * @throws {TurnkeyError} If the client is not initialized, the wallet is invalid, or if there is an error creating the wallet accounts.
   */
  async function createWalletAccounts(
    params: {
      accounts: v1WalletAccountParams[] | v1AddressFormat[];
      walletId: string;
      organizationId?: string;
    } & DefaultParams,
  ): Promise<string[]> {
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

  /**
   * Exports a wallet as an encrypted bundle.
   *
   * - This function exports the specified wallet and all of its accounts as an encrypted bundle, suitable for secure backup or transfer.
   * - The exported bundle contains the wallet's seed phrase, encrypted to the provided target public key, ensuring only the holder of the corresponding private key can decrypt it.
   * - If a `targetPublicKey` is provided, the bundle will be encrypted to that public key.
   * - If an `organizationId` is provided, the wallet will be exported under that sub-organization (the walletId must belong to the sub-org).
   * - Supports stamping the request with a specific stamper (`StamperType.Passkey`, `StamperType.ApiKey`, or `StamperType.Wallet`) for granular authentication control.
   * - After export, the wallets state is refreshed to ensure the latest state is available in the provider.
   *
   * @param walletId - The ID of the wallet to export.
   * @param targetPublicKey - The public key to encrypt the bundle to (required for secure export).
   * @param organizationId - Optional organization ID to export the wallet under a specific sub-organization (walletId must be associated with the sub-org).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (`StamperType.Passkey`, `StamperType.ApiKey`, or `StamperType.Wallet`).
   * @returns A promise that resolves to an `ExportBundle` object containing the encrypted wallet seed phrase and associated metadata.
   * @throws {TurnkeyError} If the client is not initialized, the wallet is invalid, or if there is an error exporting the wallet.
   */
  async function exportWallet(
    params: {
      walletId: string;
      targetPublicKey: string;
      organizationId?: string;
    } & DefaultParams,
  ): Promise<ExportBundle> {
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

  /**
   * Imports a wallet from an encrypted bundle.
   *
   * - This function imports a wallet using the provided encrypted bundle, which contains the wallet's seed phrase and metadata, encrypted to a target public key.
   * - The imported wallet will be created with the specified name and, optionally, with a set of accounts as defined by the provided parameters.
   * - If a userId is provided, the wallet will be imported for that specific user; otherwise, it defaults to the current session's userId.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - After a successful import, the wallets state is automatically refreshed to reflect the new wallet.
   * - Can be used to restore wallets from backup, migrate wallets between users, or import externally generated wallets.
   *
   * @param encryptedBundle - The encrypted bundle containing the wallet seed phrase and metadata.
   * @param walletName - The name to assign to the imported wallet.
   * @param accounts - Optional array of account parameters to create in the imported wallet (e.g., v1WalletAccountParams[]).
   * @param userId - Optional user ID to import the wallet for a specific user (defaults to the current session's userId).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to the ID of the newly imported wallet.
   * @throws {TurnkeyError} If the client is not initialized, no session is found, or if there is an error importing the wallet.
   */
  async function importWallet(
    params: {
      encryptedBundle: string;
      walletName: string;
      accounts?: v1WalletAccountParams[];
      userId?: string;
    } & DefaultParams,
  ): Promise<string> {
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

  /**
   * Deletes a sub-organization (sub-org) for the current user.
   *
   * - This function deletes the specified sub-organization and, by default, will fail if any wallets associated with the sub-org have not been exported.
   * - If `deleteWithoutExport` is set to true, the sub-organization will be deleted even if its wallets have not been exported (use with caution, as this is irreversible).
   * - The deletion process will remove all user data, wallets, and accounts associated with the sub-organization.
   * - This action is permanent and cannot be undone. All private keys and wallet data will be lost if not exported prior to deletion.
   * - Typically used for account closure, user-initiated deletion, or compliance-driven data removal.
   *
   * @param deleteWithoutExport - Optional boolean flag. If true, deletes the sub-org without requiring wallet export. Defaults to false for safety.
   * @returns A promise that resolves to a `TDeleteSubOrganizationResponse` object containing the result of the deletion operation.
   * @throws {TurnkeyError} If the client is not initialized, if there is an error deleting the sub-organization, or if deletion is blocked due to unexported wallets (unless overridden).
   */
  async function deleteSubOrganization(
    params?: {
      deleteWithoutExport?: boolean;
    } & DefaultParams,
  ): Promise<TDeleteSubOrganizationResponse> {
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

  /**
   * Stores a session token and updates the session associated with the specified session key, or by default the active session.
   *
   * - This function stores the session token in persistent storage and updates the active session state in the provider.
   * - If a sessionKey is provided, the session will be stored under that key; otherwise, the default active session key is used.
   * - After storing, it fetches the updated session and all sessions, and updates the provider state accordingly.
   * - Automatically schedules session expiration and warning timeouts based on the session's expiry time to ensure proper session lifecycle management.
   * - Ensures that the session and allSessions state variables are always in sync with the underlying client/session storage.
   * - Useful for restoring sessions after authentication flows, handling session tokens from external sources, or programmatically managing sessions.
   *
   * @param sessionToken - The session token (JWT) to store.
   * @param sessionKey - Optional session key to store the session under (defaults to the active session key).
   * @returns A promise that resolves when the session is successfully stored and state is updated.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error storing or updating the session.
   */
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

  /**
   * Clears the session associated with the specified session key, or by default the active session.
   *
   * - This function removes the session from persistent storage and updates the active session and all sessions state in the provider.
   * - If a sessionKey is provided, it will clear the session under that key; otherwise, it will use the active session key.
   * - After clearing, the session and allSessions state variables are updated to reflect the current state.
   * - Automatically handles error reporting via the configured callbacks.
   * - This does not clear all sessions; use `clearAllSessions` to remove all sessions and reset state.
   *
   * @param sessionKey - Optional session key to clear the session under (defaults to active session key).
   * @returns A promise that resolves when the session is successfully cleared and state is updated.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error clearing the session.
   */
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

  /**
   * Clears all sessions and resets all session-related state in the provider.
   *
   * - This function removes all sessions from persistent storage and clears all session expiration and warning timeouts.
   * - It resets the active session and allSessions state variables to undefined, ensuring that no session data remains in memory.
   * - After calling this function, the provider will be in an unauthenticated state and all sensitive session/user/wallet information will be removed.
   * - Typically used for global logout, account deletion, or when a user wishes to remove all device sessions.
   * - Automatically handles error reporting via the configured callbacks.
   *
   * @returns A promise that resolves when all sessions are successfully cleared and state is reset.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error clearing all sessions.
   */
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

  /**
   * Refreshes the session associated with the specified session key, or by default the active session.
   *
   * - This function refreshes the session and updates the active session state in the provider.
   * - If a sessionKey is provided, it will refresh the session under that key; otherwise, it will use the current active session key.
   * - Makes a request to the Turnkey API to stamp a new login and obtain a refreshed session token.
   * - Optionally allows specifying a new expiration time (expirationSeconds), a publicKey for stamping, or to invalidate the existing session before refreshing.
   * - After refreshing, automatically schedules session expiration and warning timeouts based on the new session's expiry.
   * - Updates both the session and allSessions state variables to ensure provider state is in sync with storage.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Useful for extending session lifetimes, rotating session tokens, or proactively refreshing sessions before expiry.
   *
   * @param expirationSeconds - Optional expiration time in seconds for the refreshed session.
   * @param publicKey - Optional public key to use for the session refresh (for custom key-pair flows).
   * @param sessionKey - Optional session key to refresh the session under (defaults to the active session key).
   * @param invalidateExisitng - Optional flag to invalidate the existing session before refreshing.
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (Passkey, ApiKey, or Wallet).
   * @returns A promise that resolves to a `TStampLoginResponse` object containing the refreshed session details.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error refreshing the session.
   */
  async function refreshSession(
    params?: {
      expirationSeconds?: string;
      publicKey?: string;
      sessionKey?: string;
      invalidateExisitng?: boolean;
    } & DefaultParams,
  ): Promise<TStampLoginResponse | undefined> {
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );

    const activeSessionKey = await client.getActiveSessionKey();
    if (!activeSessionKey) {
      throw new TurnkeyError(
        "No active session found.",
        TurnkeyErrorCodes.NO_SESSION_FOUND,
      );
    }

    let sessionKey = params?.sessionKey ?? activeSessionKey;

    const res = await withTurnkeyErrorHandling(
      () => client.refreshSession({ ...params, sessionKey }),
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

  /**
   * Retrieves the session associated with the specified session key, or the active session by default.
   *
   * - This function fetches a session from storage, either by the provided sessionKey or, if not specified, the current active session key.
   * - It returns the session details or undefined if no session is found.
   * - Useful for checking the current authentication state, restoring sessions, or accessing session metadata for advanced flows.
   * - Automatically handles error reporting via the configured callbacks.
   *
   * @param sessionKey - Optional session key to retrieve a specific session (defaults to the active session key if not provided).
   * @returns A promise that resolves to a `Session` object containing the session details, or undefined if not found.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error retrieving the session.
   */
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

  /**
   * Retrieves all sessions stored in persistent storage for the current client.
   *
   * - This function fetches all sessions managed by the Turnkey client.
   * - Returns a record mapping session keys to their corresponding `Session` objects, including metadata such as expiry, userId, and organizationId.
   * - Useful for multi-session management, restoring sessions after reload, or displaying a list of active device/browser sessions.
   * - Automatically handles error reporting via the configured callbacks.
   *
   * @returns A promise that resolves to a record of session keys and their corresponding `Session` objects, or `undefined` if no sessions are found.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error retrieving all sessions.
   */
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

  /**
   * Sets the active session to the specified session key.
   *
   * - This function updates the active session state in the client and in the provider.
   * - It sets the specified session as the active session, both in the underlying client and in local storage.
   * - After setting, it updates the session state in the provider to reflect the new active session.
   * - Ensures that all session-dependent state and UI are synchronized with the new active session.
   * - Useful for multi-session management, allowing users to switch between sessions/devices.
   *
   * @param sessionKey - The session key to set as the active session.
   * @returns A promise that resolves when the active session is successfully set and state is updated.
   * @throws {TurnkeyError} If the client is not initialized, the session is not found, or if there is an error setting the active session.
   */
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

  /**
   * Retrieves the active session key for the current client instance.
   *
   * - This function fetches the session key that is currently set as active in the Turnkey client.
   * - The active session key is used to identify which session is currently in use for authentication and API requests.
   * - Returns the session key as a string if an active session exists, or `undefined` if no session is currently active.
   * - Useful for multi-session management, restoring sessions after reload, or switching between user/device sessions.
   * - Automatically handles error reporting via the configured callbacks.
   *
   * @returns A promise that resolves to the active session key as a string, or `undefined` if no active session is found.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error retrieving the active session key.
   */
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

  /**
   * Clears unused API key pairs from IndexedDB storage.
   *
   * - This function scans all API key pairs stored in IndexedDB and removes any that are not currently associated with an active session or in use by the client.
   * - It is useful for cleaning up orphaned or stale key pairs that may accumulate after session removal, logout, or failed authentication attempts.
   * - This helps reduce storage usage and improves security by ensuring only necessary key pairs remain.
   * - Typically called after session cleanup, logout, or as part of periodic maintenance.
   *
   * @returns A promise that resolves when all unused key pairs are successfully removed.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error clearing unused key pairs.
   */
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

  /**
   * Creates a new API key pair for the client.
   *
   * - This function generates a new API key pair and stores it in IndexedDB for secure local use.
   * - If an `externalKeyPair` is provided, it will use that key pair (either a CryptoKeyPair or an object with public/private key strings) instead of generating a new one.
   * - If `storeOverride` is set to true, the generated or provided key pair will be set as the active key pair for the API key stamper, overriding any existing key pair.
   * - The public key is returned as a string, suitable for use in authentication flows (such as OAuth, passkey, or wallet flows).
   * - This function is used internally for flows that require a unique public key for nonce generation or cryptographic operations, and can also be called directly for advanced use cases.
   *
   * @param externalKeyPair - Optional. An externally generated key pair to use for API key creation (CryptoKeyPair or { publicKey, privateKey }).
   * @param storeOverride - Optional. If true, sets the generated or provided key pair as the active API key pair (default: false).
   * @returns A promise that resolves to the public key of the created or provided API key pair as a string.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error creating or storing the API key pair.
   */
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

  /**
   * Retrieves the proxy authentication configuration from the Turnkey Auth Proxy.
   *
   * - This function makes a request to the configured Turnkey Auth Proxy to fetch the current authentication configuration,
   *   including enabled authentication methods (email, SMS, passkey, wallet, OAuth providers), session expiration settings,
   *   and any proxy-specific overrides or feature flags.
   * - The returned configuration is used to dynamically build the provider's master configuration and determine which
   *   authentication flows and UI options should be available to the user.
   * - Typically called automatically during provider initialization if an `authProxyId` is present in the config,
   *   but can also be called directly to refresh or inspect the proxy's settings.
   *
   * @returns A promise that resolves to a `ProxyTGetWalletKitConfigResponse` object containing the proxy auth config and feature flags.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error retrieving the proxy auth config.
   */
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

  /**
   * Refreshes the user details.
   *
   * - This function fetches the latest user details for the current session (or optionally for a specific user/organization if provided)
   *   and updates the `user` state variable in the provider.
   * - If a `stampWith` parameter is provided, it will use that stamper to fetch the user details (supports Passkey, ApiKey, or Wallet stampers).
   * - Automatically handles error reporting via the configured callbacks.
   * - Typically used after authentication, user profile updates, or linking/unlinking authenticators to ensure the provider state is up to date.
   * - If no user is found, the state will not be updated.
   *
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves when the user details are successfully refreshed and state is updated.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error refreshing the user details.
   */
  async function refreshUser(params?: DefaultParams): Promise<void> {
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

  /**
   * Refreshes the wallets state for the current user session.
   *
   * - This function fetches the latest list of wallets associated with the current session or user,
   *   and updates the `wallets` state variable in the provider.
   * - If a `stampWith` parameter is provided, it will use that stamper to fetch the wallets
   *   (supports Passkey, ApiKey, or Wallet stampers for granular authentication control).
   * - Automatically handles error reporting via the configured callbacks.
   * - Typically used after wallet creation, import, export, account changes, or authentication
   *   to ensure the provider state is up to date.
   * - If no wallets are found, the state will be set to an empty array.
   *
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves when the wallets are successfully refreshed and state is updated.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error refreshing the wallets.
   */
  async function refreshWallets(params?: DefaultParams): Promise<void> {
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

  /**
   * Handles the Google OAuth flow.
   *
   * - This function initiates the Google OAuth flow by redirecting the user to the Google authorization page or opening it in a popup window.
   * - It supports both "popup" and "redirect" flows, determined by the `openInPage` parameter.
   * - Generates a new ephemeral API key pair and uses its public key as the nonce for the OAuth request, ensuring cryptographic binding of the session.
   * - Constructs the Google OAuth URL with all required parameters, including client ID, redirect URI, response type, scope, nonce, and state.
   * - The `state` parameter includes the provider, flow type, public key, and any additional state parameters for tracking or custom logic.
   * - If `openInPage` is true, the current page is redirected to the Google OAuth URL and the function returns a promise that resolves on redirect or times out after 5 minutes.
   * - If `openInPage` is false, a popup window is opened for the OAuth flow, and the function returns a promise that resolves when the flow completes or rejects if the window is closed or times out.
   * - On successful authentication, the function either calls the provided `onOAuthSuccess` callback, triggers the `onOauthRedirect` callback from provider callbacks, or completes the OAuth flow internally by calling `completeOauth`.
   * - Handles all error cases, including missing configuration, popup failures, and timeouts, and throws a `TurnkeyError` with appropriate error codes.
   *
   * @param clientId - Optional. The Google Client ID to use (defaults to the client ID from configuration).
   * @param openInPage - Optional. Whether to open the OAuth flow in the current page (redirect) or a popup window (default: false).
   * @param additionalState - Optional. Additional key-value pairs to include in the OAuth state parameter for custom tracking or logic.
   * @param onOAuthSuccess - Optional. Callback function to handle the successful OAuth response (receives `{ oidcToken, providerName }`).
   *
   * onOAuthSuccess params:
   * - oidcToken: The OIDC token received from the OAuth flow.
   * - providerName: The name of the OAuth provider ("google").
   *
   * @returns A promise that resolves when the OAuth flow is successfully initiated and completed, or rejects on error or timeout.
   * @throws {TurnkeyError} If the configuration is not ready, required parameters are missing, or if there is an error initiating or completing the OAuth flow.
   */
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

  /**
   * Handles the Apple OAuth flow.
   *
   * - This function initiates the Apple OAuth flow by either redirecting the user to the Apple authorization page or opening it in a popup window.
   * - The flow type is determined by the `openInPage` parameter: if true, the current page is redirected; if false (default), a popup window is used.
   * - Generates a new ephemeral API key pair and uses its public key as the nonce for the OAuth request, ensuring cryptographic binding of the session.
   * - Constructs the Apple OAuth URL with all required parameters, including client ID, redirect URI, response type, response mode, nonce, and state.
   * - The `state` parameter includes the provider, flow type, public key, and any additional state parameters for tracking or custom logic.
   * - If `openInPage` is true, the function redirects and returns a promise that resolves on redirect or times out after 5 minutes.
   * - If `openInPage` is false, a popup window is opened and the function returns a promise that resolves when the flow completes, or rejects if the window is closed or times out.
   * - On successful authentication, the function either calls the provided `onOAuthSuccess` callback, triggers the `onOauthRedirect` callback from provider callbacks, or completes the OAuth flow internally by calling `completeOauth`.
   * - Handles all error cases, including missing configuration, popup failures, and timeouts, and throws a `TurnkeyError` with appropriate error codes.
   *
   * @param clientId - Optional. The Apple Client ID to use (defaults to the client ID from configuration).
   * @param openInPage - Optional. Whether to open the OAuth flow in the current page (redirect) or a popup window (default: false).
   * @param additionalState - Optional. Additional key-value pairs to include in the OAuth state parameter for custom tracking or logic.
   * @param onOAuthSuccess - Optional. Callback function to handle the successful OAuth response (receives `{ oidcToken, providerName }`).
   *
   * onOAuthSuccess params:
   * - oidcToken: The OIDC token received from the OAuth flow.
   * - providerName: The name of the OAuth provider ("apple").
   *
   * @returns A promise that resolves when the OAuth flow is successfully initiated and completed, or rejects on error or timeout.
   * @throws {TurnkeyError} If the configuration is not ready, required parameters are missing, or if there is an error initiating or completing the OAuth flow.
   */
  async function handleAppleOauth(params: {
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
    } = params;
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

                  if (params.onOAuthSuccess) {
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

  /**
   * Handles the Facebook OAuth flow.
   *
   * - This function initiates the Facebook OAuth flow by either redirecting the user to the Facebook authorization page or opening it in a popup window.
   * - The flow type is determined by the `openInPage` parameter: if true, the current page is redirected; if false (default), a popup window is used.
   * - Generates a new ephemeral API key pair and uses its public key as the nonce for the OAuth request, ensuring cryptographic binding of the session.
   * - Uses PKCE (Proof Key for Code Exchange) for enhanced security, generating a code verifier and challenge for the Facebook OAuth flow.
   * - Constructs the Facebook OAuth URL with all required parameters, including client ID, redirect URI, response type, code challenge, nonce, and state.
   * - The `state` parameter includes the provider, flow type, public key, and any additional state parameters for tracking or custom logic.
   * - If `openInPage` is true, the function redirects and returns a promise that resolves on redirect or times out after 5 minutes.
   * - If `openInPage` is false, a popup window is opened and the function returns a promise that resolves when the flow completes, or rejects if the window is closed or times out.
   * - On successful authentication, the function either calls the provided `onOAuthSuccess` callback, triggers the `onOauthRedirect` callback from provider callbacks, or completes the OAuth flow internally by calling `completeOauth`.
   * - Handles all error cases, including missing configuration, popup failures, and timeouts, and throws a `TurnkeyError` with appropriate error codes.
   *
   * @param clientId - Optional. The Facebook Client ID to use (defaults to the client ID from configuration).
   * @param openInPage - Optional. Whether to open the OAuth flow in the current page (redirect) or a popup window (default: false).
   * @param additionalState - Optional. Additional key-value pairs to include in the OAuth state parameter for custom tracking or logic.
   * @param onOAuthSuccess - Optional. Callback function to handle the successful OAuth response (receives `{ oidcToken, providerName }`).
   *
   * onOAuthSuccess params:
   * - oidcToken: The OIDC token received from the OAuth flow.
   * - providerName: The name of the OAuth provider ("facebook").
   *
   * @returns A promise that resolves when the OAuth flow is successfully initiated and completed, or rejects on error or timeout.
   * @throws {TurnkeyError} If the configuration is not ready, required parameters are missing, or if there is an error initiating or completing the OAuth flow.
   */
  async function handleFacebookOauth(params: {
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
    } = params;
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

                      if (params.onOAuthSuccess) {
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

  /**
   * Handles the login or sign-up flow.
   *
   * - This function opens a modal with the AuthComponent, allowing the user to log in or sign up using any enabled authentication method (Passkey, Wallet, OTP, or OAuth).
   * - It automatically determines available authentication methods based on the current provider configuration and proxy settings.
   * - The modal-driven flow guides the user through the appropriate authentication steps, including social login if enabled.
   * - After successful authentication, the provider state is updated and all relevant session, user, and wallet data are refreshed.
   * - This function is typically used to trigger authentication from a UI button or navigation event.
   *
   * @returns A void promise.
   */
  const handleLogin = async () => {
    pushPage({
      key: "Log in or sign up",
      content: <AuthComponent />,
    });
  };

  /**
   * Handles the export flow.
   *
   * - This function opens a modal with the ExportComponent for exporting a wallet or private key.
   * - Uses Turnkey's export iframe flow to securely export wallet or private key material.
   * - The export process encrypts the exported bundle to a target public key, which is generated and managed inside the iframe for maximum security.
   * - A request is made to the Turnkey API to export the wallet or private key, encrypted to the target public key.
   * - The resulting export bundle is injected into the iframe, where it is decrypted and displayed to the user.
   * - Supports both full wallet exports (ExportType.Wallet) and single private key exports (ExportType.PrivateKey).
   * - If a custom iframe URL is used, a target public key can be provided explicitly.
   * - Optionally allows specifying the stamper to use for the export (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - The modal-driven UI ensures the user is guided through the export process and can securely retrieve their exported material.
   *
   * @param walletId - The ID of the wallet to export.
   * @param exportType - The type of export to perform (ExportType.Wallet or ExportType.PrivateKey).
   * @param targetPublicKey - Optional. The target public key to encrypt the export bundle to (required for custom iframe flows).
   * @param stampWith - Optional. The stamper to use for the export (Passkey, ApiKey, or Wallet).
   *
   * @returns A void promise.
   */
  const handleExport = async (
    params: {
      walletId: string;
      exportType: ExportType;
      targetPublicKey?: string;
    } & DefaultParams,
  ) => {
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

  /**
   * Handles the import flow.
   *
   * - This function opens a modal with the ImportComponent for importing a wallet or private key.
   * - Supports importing wallets using an encrypted bundle, with optional default accounts or custom account parameters.
   * - Allows users to specify default wallet accounts (address formats or account params) to pre-fill the import form.
   * - Optionally accepts a callback to handle successful import, which receives the imported wallet's ID.
   * - Supports customizing the duration of the success page shown after a successful import.
   * - Allows specifying the stamper to use for the import (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Ensures the imported wallet is added to the user's wallet list and the provider state is refreshed.
   *
   * @param defaultWalletAccounts - Optional array of default wallet accounts (v1AddressFormat[] or v1WalletAccountParams[]) to pre-fill the import form.
   * @param successPageDuration - Optional duration (in ms) for the success page after import (default: 0, no success page).
   * @param stampWith - Optional parameter to specify the stamper to use for the import (Passkey, ApiKey, or Wallet).
   *
   * @returns A promise that resolves to the new wallet's ID.
   */
  const handleImport = async (
    params: {
      defaultWalletAccounts?: v1AddressFormat[] | v1WalletAccountParams[];
      successPageDuration?: number | undefined;
    } & DefaultParams,
  ): Promise<string> => {
    const { defaultWalletAccounts, successPageDuration, stampWith } = params;
    try {
      return withTurnkeyErrorHandling(
        () =>
          new Promise<string>((resolve, reject) =>
            pushPage({
              key: "Import Wallet",
              content: (
                <ImportComponent
                  onError={(error) => {
                    reject(error);
                  }}
                  onSuccess={(walletId) => resolve(walletId)}
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

  /**
   * Handles the update user name flow.
   *
   * - This function opens a modal with the UpdateUserName component for updating and verifying the user's name.
   * - If a userName is provided, it will directly update the user name without showing the modal.
   * - Uses updateUserName under the hood to perform the update and automatically refreshes the user details state after a successful update.
   * - Optionally displays a success page after the update, with customizable duration.
   * - Supports passing a custom title and subtitle for the modal UI.
   * - Supports stamping the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Handles all error cases and throws a TurnkeyError with appropriate error codes.
   *
   * @param userName - Optional parameter to specify the new user name.
   * @param title - Optional title for the modal.
   * @param subTitle - Optional subtitle for the modal.
   * @param successPageDuration - Optional duration (in ms) for the success page after update (default: 0, no success page).
   * @param stampWith - Optional parameter to specify the stamper to use for the update (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @returns A promise that resolves to the userId of the user that was changed.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error updating the user name.
   */
  const handleUpdateUserName = async (
    params?: {
      userName?: string;
      title?: string;
      subTitle?: string;
      successPageDuration?: number | undefined;
    } & DefaultParams,
  ): Promise<string> => {
    const { successPageDuration, subTitle, title, stampWith } = params || {};

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
                    onSuccess={(userId) => {
                      resolve(userId);
                    }}
                    onError={(error) => {
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

  /**
   * Handles the update user phone number flow.
   *
   * - This function opens a modal with the UpdatePhoneNumber component for updating and verifying the user's phone number.
   * - If a phoneNumber is provided, it will directly send an OTP request to the user and display the OTP verification modal.
   * - Supports both manual entry and pre-filled phone numbers, as well as custom modal titles and subtitles.
   * - Uses the updatePhoneNumberContinue helper to manage the OTP flow, verification, and update logic.
   * - After successful verification and update, the user details state is refreshed and an optional success page can be shown.
   * - Supports customizing the duration of the success page after update.
   * - Throws a TurnkeyError if the client is not initialized, no active session is found, SMS OTP is not enabled, or if there is an error updating the phone number.
   *
   * @param phoneNumber - Optional parameter to specify the new phone number.
   * @param formattedPhone - Optional parameter to specify the formatted phone number.
   * @param title - Optional title for the modal.
   * @param subTitle - Optional subtitle for the modal.
   * @param successPageDuration - Optional duration for the success page (default: 0, no success page).
   *
   * @returns A promise that resolves to the userId of the user that was changed.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, SMS OTP is not enabled, or if there is an error updating the phone number.
   */
  const handleUpdateUserPhoneNumber = async (params?: {
    phoneNumber?: string;
    formattedPhone?: string;
    title?: string;
    subTitle?: string;
    successPageDuration?: number | undefined;
  }): Promise<string> => {
    const { successPageDuration, subTitle, title } = params || {};

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

  /**
   * Handles the update user email flow.
   *
   * - This function opens a modal with the UpdateEmail component for updating and verifying the user's email address.
   * - If an email is provided, it will immediately send an OTP request to the user and display the OTP verification modal.
   * - Supports both manual entry and pre-filled email addresses, as well as custom modal titles and subtitles.
   * - Uses the updateEmailContinue helper to manage the OTP flow, verification, and update logic.
   * - After successful verification and update, the user details state is refreshed and an optional success page can be shown.
   * - Supports customizing the duration of the success page after update.
   * - Handles all error cases and throws a TurnkeyError with appropriate error codes.
   *
   * @param email - Optional parameter to specify the new email address.
   * @param title - Optional title for the modal.
   * @param subTitle - Optional subtitle for the modal.
   * @param successPageDuration - Optional duration (in ms) for the success page after update (default: 0, no success page).
   *
   * @returns A promise that resolves to the userId of the user that was changed.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error updating the email.
   */
  const handleUpdateUserEmail = async (params?: {
    email?: string;
    title?: string;
    subTitle?: string;
    successPageDuration?: number | undefined;
  }): Promise<string> => {
    const { successPageDuration, subTitle, title } = params || {};

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

  /**
   * Handles the add user email flow.
   *
   * - This function opens a modal with the UpdateEmail component, using a modified title and flow for adding and verifying the user's email address.
   * - If an email is provided, it will immediately send an OTP request to the user and display the OTP verification modal.
   * - Supports both manual entry and pre-filled email addresses, as well as custom modal titles and subtitles.
   * - Uses the addEmailContinue helper to manage the OTP flow, verification, and update logic.
   * - After successful verification and update, the user details state is refreshed and an optional success page can be shown.
   * - Supports customizing the duration of the success page after update.
   * - Handles all error cases and throws a TurnkeyError with appropriate error codes.
   *
   * @param email - Optional parameter to specify the new email address.
   * @param title - Optional title for the modal (defaults to "Connect an email" if the user does not have an email).
   * @param subTitle - Optional subtitle for the modal.
   * @param successPageDuration - Optional duration (in ms) for the success page after update (default: 0, no success page).
   *
   * @returns A promise that resolves to the userId of the user that was changed.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error adding the email.
   */
  const handleAddEmail = async (params?: {
    email?: string;
    title?: string;
    subTitle?: string;
    successPageDuration?: number | undefined;
  }): Promise<string> => {
    const { successPageDuration, subTitle, title } = params || {};

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

  /**
   * Handles the add phone number flow.
   *
   * - This function opens a modal with the UpdatePhoneNumber component for adding and verifying the user's phone number.
   * - If a phone number is provided, it will immediately send an OTP request to the user and display the OTP verification modal.
   * - Supports both manual entry and pre-filled phone numbers, as well as custom modal titles and subtitles.
   * - Uses the addPhoneNumberContinue helper to manage the OTP flow, verification, and update logic.
   * - After successful verification and update, the user details state is refreshed and an optional success page can be shown.
   * - Supports customizing the duration of the success page after update.
   * - Handles all error cases and throws a TurnkeyError with appropriate error codes.
   *
   * @param phoneNumber - Optional parameter to specify the new phone number.
   * @param formattedPhone - Optional parameter to specify the formatted phone number.
   * @param title - Optional title for the modal.
   * @param subTitle - Optional subtitle for the modal.
   * @param successPageDuration - Optional duration (in ms) for the success page after update (default: 0, no success page).
   *
   * @returns A promise that resolves to the userId of the user that was changed.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error adding the phone number.
   */
  const handleAddPhoneNumber = async (params?: {
    phoneNumber?: string;
    formattedPhone?: string;
    title?: string;
    subTitle?: string;
    successPageDuration?: number | undefined;
  }): Promise<string> => {
    const { successPageDuration, subTitle, title } = params || {};

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

  /**
   * Handles the removal of a passkey (authenticator) for the user.
   *
   * - This function opens a modal with the RemovePasskey component, allowing the user to confirm and remove a passkey authenticator from their account.
   * - It supports specifying the authenticator ID to remove, as well as optional modal title and subtitle for custom UI messaging.
   * - After successful removal, the user details state is refreshed to reflect the updated list of authenticators.
   * - Supports customizing the duration of the success page shown after removal.
   * - Allows specifying the stamper to use for the removal (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Handles all error cases and throws a TurnkeyError with appropriate error codes.
   *
   * @param authenticatorId - The ID of the authenticator (passkey) to remove.
   * @param userId - Optional user ID to remove the passkey for a specific user (defaults to current session's userId).
   * @param title - Optional title for the modal.
   * @param subTitle - Optional subtitle for the modal.
   * @param successPageDuration - Optional duration (in ms) for the success page after removal (default: 0, no success page).
   * @param stampWith - Optional parameter to specify the stamper to use for the removal (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @returns A promise that resolves to an array of authenticator IDs that were removed.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error removing the passkey.
   */
  const handleRemovePasskey = async (
    params: {
      authenticatorId: string;
      userId?: string;
      title?: string;
      subTitle?: string;
      successPageDuration?: number | undefined;
    } & DefaultParams,
  ): Promise<string[]> => {
    const {
      authenticatorId,
      successPageDuration,
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

  /**
   * Handles the addition of a passkey (authenticator) for the user.
   *
   * - This function opens a modal-driven flow for adding a new passkey authenticator (WebAuthn/FIDO2) to the user's account.
   * - If a `name` or `displayName` is provided, those will be used for the passkey metadata; otherwise, defaults are generated based on the website and timestamp.
   * - The passkey is created and linked to the specified user (by `userId`) or the current session's user if not provided.
   * - After successful addition, a success page is shown for the specified duration (or skipped if `successPageDuration` is 0).
   * - Supports stamping the request with a specific stamper (`StamperType.Passkey`, `StamperType.ApiKey`, or `StamperType.Wallet`) for granular authentication control.
   * - Automatically refreshes the user details state after successful addition to ensure the latest authenticators list is available in the provider.
   * - Handles all error cases and throws a `TurnkeyError` with appropriate error codes.
   *
   * @param name - Optional internal name for the passkey (for backend or developer reference).
   * @param displayName - Optional display name for the passkey (shown to the user in the UI).
   * @param userId - Optional user ID to add the passkey for a specific user (defaults to current session's userId).
   * @param successPageDuration - Optional duration (in ms) for the success page after addition (default: 0, no success page).
   * @param stampWith - Optional parameter to stamp the request with a specific stamper (`StamperType.Passkey`, `StamperType.ApiKey`, or `StamperType.Wallet`).
   *
   * @returns A promise that resolves to the user's updated passkeys.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error adding the passkey.
   */
  const handleAddPasskey = async (
    params?: {
      name?: string;
      displayName?: string;
      userId?: string;
      successPageDuration?: number | undefined;
    } & DefaultParams,
  ): Promise<string[]> => {
    const { name, displayName, successPageDuration, stampWith } = params || {};

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
      const resPromise = withTurnkeyErrorHandling(
        () =>
          addPasskey({
            ...(name && { name }),
            ...(displayName && { displayName }),
            userId,
            stampWith,
          }),
        callbacks,
        "Failed to create passkey",
      );
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

  /**
   * Handles the removal of an OAuth provider.
   *
   * - This function opens a modal with the RemoveOAuthProvider component, allowing the user to confirm and remove an OAuth provider (such as Google, Apple, or Facebook) from their account.
   * - It supports specifying the provider ID to remove, as well as optional modal title and subtitle for custom UI messaging.
   * - After successful removal, the user details state is refreshed to reflect the updated list of linked OAuth providers.
   * - Optionally, a callback can be provided to handle successful removal, receiving the updated list of provider IDs.
   * - Supports customizing the duration of the success page shown after removal.
   * - Allows specifying the stamper to use for the removal (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Handles all error cases and throws a TurnkeyError with appropriate error codes.
   *
   * @param providerId - The ID of the OAuth provider to remove (as found in the user's provider list).
   * @param title - Optional title for the modal.
   * @param subTitle - Optional subtitle for the modal.
   * @param successPageDuration - Optional duration (in ms) for the success page after removal (default: 0, no success page).
   * @param stampWith - Optional parameter to specify the stamper to use for the removal (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @returns A promise that resolves to an array of provider IDs that were removed.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error removing the provider.
   */
  const handleRemoveOAuthProvider = async (
    params: {
      providerId: string;
      title?: string;
      subTitle?: string;
      successPageDuration?: number | undefined;
    } & DefaultParams,
  ): Promise<string[]> => {
    const { providerId, successPageDuration, subTitle, title, stampWith } =
      params;

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
              onSuccess={(providerIds) => {
                resolve(providerIds);
              }}
              onError={(error) => {
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

  /**
   * Handles the addition of an OAuth provider for the user.
   *
   * - This function opens a modal-driven flow for linking a new OAuth provider (Google, Apple, or Facebook) to the user's account.
   * - It supports all enabled OAuth providers as defined in the configuration and dynamically triggers the appropriate OAuth flow.
   * - Uses the handleGoogleOauth, handleAppleOauth, and handleFacebookOauth functions to initiate the provider-specific OAuth authentication process.
   * - After successful authentication, the provider is linked to the user's account and a success page is shown.
   * - Automatically refreshes the user details state after linking to ensure the latest provider list is available in the provider.
   * - Optionally allows specifying the stamper to use for the addition (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet) for granular authentication control.
   * - Handles all error cases and throws a TurnkeyError with appropriate error codes.
   *
   * @param providerName - The name of the OAuth provider to add (OAuthProviders.GOOGLE, OAuthProviders.APPLE, OAuthProviders.FACEBOOK).
   * @param stampWith - Optional parameter to specify the stamper to use for the addition (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   *
   * @returns A void promise.
   * @throws {TurnkeyError} If the client is not initialized, no active session is found, or if there is an error adding the provider.
   */
  const handleAddOAuthProvider = async (
    params: {
      providerName: OAuthProviders;
    } & DefaultParams,
  ): Promise<void> => {
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

  /**
   * Handles the linking of an external wallet account to the user's Turnkey account.
   *
   * - This function opens a modal with the LinkWalletModal component, allowing the user to select and connect an external wallet provider (such as MetaMask, Phantom, etc.).
   * - It fetches the list of available wallet providers (for all supported chains) and passes them to the modal for user selection.
   * - After a successful wallet connection, the provider state is refreshed to include the newly linked wallet account.
   * - Optionally, a success page is shown for the specified duration after linking (default: 2000ms).
   * - Supports both Ethereum and Solana wallet providers, and can be extended to additional chains as supported by Turnkey.
   * - Handles all error cases and throws a TurnkeyError with appropriate error codes if the client is not initialized or no active session is found.
   *
   * @param successPageDuration - Optional duration (in ms) for the success page after linking (default: 2000ms).
   *
   * @returns A void promise.
   * @throws {TurnkeyError} If the client is not initialized or if no active session is found.
   */
  const handleLinkExternalWallet = async (params: {
    successPageDuration?: number | undefined;
  }): Promise<void> => {
    const { successPageDuration = 2000 } = params; // TODO (Amir / Ethan): This 2 second default should be standard on all modals! Or should they??
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
      }}
    >
      {children}
    </ClientContext.Provider>
  );
};
