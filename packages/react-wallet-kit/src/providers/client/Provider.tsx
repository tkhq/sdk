import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import {
  APPLE_AUTH_URL,
  AuthState,
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
  withTurnkeyErrorHandling,
} from "../../utils";
import {
  Chain,
  CreateSubOrgParams,
  DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
  ExportBundle,
  OtpType,
  Provider,
  StamperType,
  TurnkeyClient,
  Wallet,
} from "@turnkey/sdk-js";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { TurnkeyClientMethods, TurnkeySDKClientBase } from "@turnkey/sdk-js";
import {
  OAuthProviders,
  Session,
  SessionType,
  TCreateSubOrganizationResponse,
  TDeleteSubOrganizationResponse,
  TSignTransactionResponse,
  TStampLoginResponse,
  TurnkeyError,
  TurnkeyErrorCodes,
  TurnkeyNetworkError,
  v1AddressFormat,
  v1Attestation,
  v1AuthenticatorParamsV2,
  ProxyTGetWalletKitConfigResponse,
  v1Pagination,
  v1SignRawPayloadResult,
  v1TransactionType,
  v1User,
  v1WalletAccount,
  v1WalletAccountParams,
} from "@turnkey/sdk-types";
import { useModal } from "../modal/Provider";
import { TurnkeyCallbacks, TurnkeyProviderConfig } from "../TurnkeyProvider";
import { AuthComponent } from "../../components/auth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faApple,
  faFacebook,
  faGoogle,
} from "@fortawesome/free-brands-svg-icons";
import { WalletProvider, WalletType } from "@turnkey/wallet-stamper";
import { ActionPage } from "../../components/auth/Action";
import { SignMessageModal } from "../../components/sign/Message";
import { ExportComponent, ExportType } from "../../components/export";
import { ImportComponent } from "../../components/import";
import { SuccessPage } from "../../components/design/Success";
import { UpdateEmail } from "../../components/user/UpdateEmail";
import { UpdatePhoneNumber } from "../../components/user/UpdatePhoneNumber";
import { UpdateUserName } from "../../components/user/UpdateUserName";
import { RemoveOAuthProvider } from "../../components/user/RemoveOAuthProvider";
import {
  addEmailContinue,
  addPhoneNumberContinue,
  removeOAuthProviderContinue,
  removePasskeyContinue,
  updateEmailContinue,
  updatePhoneNumberContinue,
} from "../../helpers";
import { RemovePasskey } from "../../components/user/RemovePasskey";
import { ExternalWalletSelector } from "../../components/auth/Wallet";
import { LinkWalletModal } from "../../components/user/LinkWallet";

interface ClientProviderProps {
  children: ReactNode;
  config: TurnkeyProviderConfig;
  callbacks?: TurnkeyCallbacks | undefined;
}

export interface ClientContextType extends TurnkeyClientMethods {
  httpClient: TurnkeySDKClientBase | undefined;
  session: Session | undefined;
  allSessions?: Record<string, Session> | undefined;
  authState: AuthState;
  config?: TurnkeyProviderConfig | undefined;
  user: v1User | undefined;
  wallets: Wallet[];
  refreshUser: () => Promise<void>;
  refreshWallets: () => Promise<void>;
  handleLogin: () => Promise<void>;
  handleGoogleOauth: (params: {
    clientId?: string;
    additionalState?: Record<string, string>;
    openInPage?: boolean;
  }) => Promise<void>;
  handleAppleOauth: (params: {
    clientId?: string;
    additionalState?: Record<string, string>;
    openInPage?: boolean;
  }) => Promise<void>;
  handleFacebookOauth: (params: {
    clientId?: string;
    additionalState?: Record<string, string>;
    openInPage?: boolean;
  }) => Promise<void>;
  handleExport: (params: {
    walletId: string;
    exportType: ExportType;
    targetPublicKey?: string;
    stamperType?: StamperType;
  }) => Promise<void>;
  handleImport: (params: {
    defaultWalletAccounts?: v1AddressFormat[] | v1WalletAccountParams[];
    onImportSuccess?: (walletId: string) => void;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  }) => Promise<void>;
  handleUpdateUserEmail: (params?: {
    email?: string;
    title?: string;
    subTitle?: string;
    onSuccess?: (userId: string) => void;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  }) => Promise<void>;
  handleUpdateUserPhoneNumber: (params?: {
    phone?: string;
    formattedPhone?: string;
    title?: string;
    subTitle?: string;
    onSuccess?: (userId: string) => void;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  }) => Promise<void>;
  handleUpdateUserName: (params?: {
    userName?: string;
    title?: string;
    subTitle?: string;
    onSuccess?: (userId: string) => void;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  }) => Promise<void>;
  handleAddEmail: (params?: {
    email?: string;
    title?: string;
    subTitle?: string;
    onSuccess?: (userId: string) => void;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  }) => Promise<void>;
  handleAddPhoneNumber: (params?: {
    phoneNumber?: string;
    formattedPhone?: string;
    title?: string;
    subTitle?: string;
    onSuccess?: (userId: string) => void;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  }) => Promise<void>;
  handleAddOAuthProvider: (params: {
    providerName: OAuthProviders;
  }) => Promise<void>;
  handleRemoveOAuthProvider: (params: {
    providerId: string;
    title?: string;
    subTitle?: string;
    onSuccess?: (providerIds: string[]) => void;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  }) => Promise<void>;
  handleAddPasskey: (params?: {
    name?: string;
    displayName?: string;
    userId?: string;
    onSuccess?: (authenticatorIds: string[]) => void;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  }) => Promise<void>;
  handleRemovePasskey: (params: {
    authenticatorId: string;
    title?: string;
    subTitle?: string;
    onSuccess?: (authenticatorIds: string[]) => void;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  }) => Promise<void>;
  handleSignMessage: (params: {
    message: string;
    wallet: v1WalletAccount;
    stampWith?: StamperType;
    subText?: string;
  }) => Promise<v1SignRawPayloadResult>;
  handleLinkExternalWallet: (params: {}) => Promise<void>;
}

export const ClientContext = createContext<ClientContextType | undefined>(
  undefined,
);

export const useTurnkey = (): ClientContextType => {
  const context = useContext(ClientContext);
  if (!context)
    throw new Error("useTurnkey must be used within TurnkeyProvider");
  return context;
};

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

  useEffect(() => {
    if (client) {
      initializeProviders();
    }
  }, [client]);

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
                      providerName: provider ?? "oauth-provider", // Keep lowercase provider name
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
              providerName: provider ?? "oauth-provider", // Keep lowercase provider name
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
      const proxyAuthConfig = await client.getProxyAuthConfig();
      proxyAuthConfigRef.current = proxyAuthConfig;
      setMasterConfig(buildConfig(proxyAuthConfig));
    };

    fetchProxyAuthConfig();
  }, [client]);

  useEffect(() => {
    // If the proxyAuthConfigRef is already set, we don't need to fetch it again. Rebuild the master config with the updated config and stored proxyAuthConfig
    if (!proxyAuthConfigRef.current) return;
    setMasterConfig(buildConfig(proxyAuthConfigRef.current));
  }, [config]);

  const buildConfig = (proxyAuthConfig: ProxyTGetWalletKitConfigResponse) => {
    // Juggle the local overrides with the values set in the dashboard (proxyAuthConfig).
    const resolvedMethods = {
      emailOtpAuthEnabled:
        config.auth?.methods?.emailOtpAuthEnabled ??
        proxyAuthConfig.emailEnabled,
      smsOtpAuthEnabled:
        config.auth?.methods?.smsOtpAuthEnabled ?? proxyAuthConfig.smsEnabled,
      passkeyAuthEnabled:
        config.auth?.methods?.passkeyAuthEnabled ??
        proxyAuthConfig.passkeyEnabled,
      walletAuthEnabled:
        config.auth?.methods?.walletAuthEnabled ??
        proxyAuthConfig.walletEnabled,
      googleOAuthEnabled:
        config.auth?.methods?.googleOAuthEnabled ??
        proxyAuthConfig.googleEnabled,
      appleOAuthEnabled:
        config.auth?.methods?.appleOAuthEnabled ?? proxyAuthConfig.appleEnabled,
      facebookOAuthEnabled:
        config.auth?.methods?.facebookOAuthEnabled ??
        proxyAuthConfig.facebookEnabled,
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

    const passkeyConfig = {
      ...config.passkeyConfig,
      rpId: config.passkeyConfig?.rpId ?? window.location.hostname,
      timeout: config.passkeyConfig?.timeout ?? 60000,
    };
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
            proxyAuthConfig.openOAuthInPage,
        },
        sessionExpirationSeconds: {
          passkey: proxyAuthConfig?.passkeySessionExpirationSeconds,
          wallet: proxyAuthConfig?.walletSessionExpirationSeconds,
        },
        methodOrder,
        oauthOrder,
      },
      passkeyConfig, // TODO (Amir): This should technically be inside auth object. Also walletconfig
      importIframeUrl: config.importIframeUrl ?? "https://import.turnkey.com",
      exportIframeUrl: config.exportIframeUrl ?? "https://export.turnkey.com",
    } as TurnkeyProviderConfig;
  };

  const initializeClient = async () => {
    try {
      const turnkeyClient = new TurnkeyClient({
        apiBaseUrl: config.apiBaseUrl,
        authProxyUrl: config.authProxyUrl,
        authProxyId: config.authProxyId,
        organizationId: config.organizationId,
        importIframeUrl: config.importIframeUrl ?? "https://import.turnkey.com",
        exportIframeUrl: config.exportIframeUrl ?? "https://export.turnkey.com",
        passkeyConfig: {
          rpId: config.passkeyConfig?.rpId,
          timeout: config.passkeyConfig?.timeout || 60000, // 60 seconds
          userVerification:
            config.passkeyConfig?.userVerification || "preferred",
          allowCredentials: config.passkeyConfig?.allowCredentials || [],
        },
        walletConfig: {
          ethereum: config.walletConfig?.ethereum,
          solana: config.walletConfig?.solana,
        },
      });

      setAutoRefreshSession(config?.auth?.autoRefreshSession ?? false);

      await turnkeyClient.init();
      setClient(turnkeyClient);
    } catch (error) {
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
    setAuthState(AuthState.Loading);
    try {
      const allSessions = await getAllSessions();
      if (!allSessions) {
        setAuthState(AuthState.Unauthenticated);
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

        setAuthState(AuthState.Authenticated);
        return;
      }
      setAuthState(AuthState.Unauthenticated);
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
      setAuthState(AuthState.Unauthenticated);
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
        console.log("Session is about to expire, refreshing session...");
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
        console.log(session.expirationSeconds);
        if (autoRefreshSession) {
          await refreshSession({
            sessionType: session.sessionType,
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

  const handlePostAuth = async () => {
    try {
      const sessionKey = await getActiveSessionKey();
      const session = await getSession({
        ...(sessionKey && { sessionKey }),
      });

      console.log("Post-auth session:", session);

      if (session && sessionKey)
        await scheduleSessionExpiration({
          sessionKey,
          expiry: session.expiry,
        });

      const allSessions = await client!.getAllSessions();

      await refreshWallets();
      await refreshUser();

      setSession(session);
      setAllSessions(allSessions);
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
  }): Promise<{ attestation: v1Attestation; encodedChallenge: string }> {
    if (!client) {
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    }
    // return client.createPasskey(params);
    return await withTurnkeyErrorHandling(
      () => client.createPasskey(params),
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
    setAuthState(AuthState.Loading);
    await withTurnkeyErrorHandling(
      () => client.logout(params),
      callbacks,
      "Failed to logout",
    );
    handlePostLogout();
    setAuthState(AuthState.Unauthenticated);
    return;
  }

  async function loginWithPasskey(params?: {
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
    setAuthState(AuthState.Loading);

    const expirationSeconds =
      masterConfig?.auth?.sessionExpirationSeconds?.passkey ??
      DEFAULT_SESSION_EXPIRATION_IN_SECONDS;
    const res = await withTurnkeyErrorHandling(
      () => client.loginWithPasskey({ ...params, expirationSeconds }),
      callbacks,
      "Failed to login with passkey",
    );
    if (res) {
      await handlePostAuth();
      setAuthState(AuthState.Authenticated);
    } else {
      setAuthState(AuthState.Unauthenticated);
    }
    return res;
  }

  async function signUpWithPasskey(params?: {
    createSubOrgParams?: CreateSubOrgParams;
    sessionType?: SessionType;
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
      masterConfig.auth?.createSuborgParams?.passkey;
    params =
      createSubOrgParams !== undefined
        ? { ...params, createSubOrgParams }
        : { ...params };

    setAuthState(AuthState.Loading);

    const expirationSeconds =
      masterConfig?.auth?.sessionExpirationSeconds?.passkey ??
      DEFAULT_SESSION_EXPIRATION_IN_SECONDS;
    const res = await withTurnkeyErrorHandling(
      () => client.signUpWithPasskey({ ...params, expirationSeconds }),
      callbacks,
      "Failed to sign up with passkey",
    );
    if (res) {
      await handlePostAuth();
      setAuthState(AuthState.Authenticated);
    } else {
      setAuthState(AuthState.Unauthenticated);
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
    await refreshWallets();
  }

  const initializeProviders = useCallback(async () => {
    const [ethProviders, solProviders] = await Promise.all([
      getWalletProviders(WalletType.Ethereum),
      getWalletProviders(WalletType.Solana),
    ]);

    console.log("I am running");

    const cleanups: Array<() => void> = [];

    ethProviders
      .filter((p) => p.connectedAddresses.length > 0)
      .forEach((p) => {
        const onAccountsChanged = (accs: string[]) => {
          console.log("onAccountsChanged eth");
          if (accs.length === 0) fetchWallets();
        };
        const onDisconnect = () => {
          console.log("onDisconnect eth");
          fetchWallets();
        };

        // cast to any so TS won’t complain
        (p.provider as any).on("accountsChanged", onAccountsChanged);
        (p.provider as any).on("disconnect", onDisconnect);

        cleanups.push(() => {
          (p.provider as any).removeListener(
            "accountsChanged",
            onAccountsChanged,
          );
          (p.provider as any).removeListener("disconnect", onDisconnect);
        });
      });

    solProviders
      .filter((p) => p.connectedAddresses.length > 0)
      .forEach((p) => {
        const onAccountsChanged = (accs: string[]) => {
          console.log("onAccountsChanged sol");
          if (accs.length === 0) fetchWallets();
        };
        const onDisconnect = () => {
          console.log("onDisconnect sol");
          fetchWallets();
        };

        // Phantom‑style
        (p.provider as any).on("accountChanged", onAccountsChanged);
        (p.provider as any).on("disconnect", onDisconnect);

        cleanups.push(() => {
          (p.provider as any).removeListener(
            "accountChanged",
            onAccountsChanged,
          );
          (p.provider as any).removeListener("disconnect", onDisconnect);
        });

        // Wallet‑Standard events, if supported
        const ev = (p.provider as any).features?.["standard:events"];
        if (ev) {
          ev.on("accountsChanged", onAccountsChanged);
          ev.on("disconnect", onDisconnect);

          cleanups.push(() => {
            ev.off("accountsChanged", onAccountsChanged);
            ev.off("disconnect", onDisconnect);
          });
        }
      });

    return () => cleanups.forEach((fn) => fn());
  }, [fetchWallets]);

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
    setAuthState(AuthState.Loading);

    const expirationSeconds =
      masterConfig?.auth?.sessionExpirationSeconds?.passkey ??
      DEFAULT_SESSION_EXPIRATION_IN_SECONDS;
    const res = await withTurnkeyErrorHandling(
      () => client.loginWithWallet({ ...params, expirationSeconds }),
      callbacks,
      "Failed to login with wallet",
    );
    if (res) {
      await handlePostAuth();
      setAuthState(AuthState.Authenticated);
    } else {
      setAuthState(AuthState.Unauthenticated);
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
      masterConfig.auth?.createSuborgParams?.wallet;
    params =
      createSubOrgParams !== undefined
        ? { ...params, createSubOrgParams }
        : { ...params };
    setAuthState(AuthState.Loading);

    const expirationSeconds =
      masterConfig?.auth?.sessionExpirationSeconds?.passkey ??
      DEFAULT_SESSION_EXPIRATION_IN_SECONDS;
    const res = await withTurnkeyErrorHandling(
      () => client.signUpWithWallet({ ...params, expirationSeconds }),
      callbacks,
      "Failed to sign up with wallet",
    );
    if (res) {
      await handlePostAuth();
      setAuthState(AuthState.Authenticated);
    } else {
      setAuthState(AuthState.Unauthenticated);
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
      masterConfig.auth?.createSuborgParams?.wallet;
    params =
      createSubOrgParams !== undefined
        ? { ...params, createSubOrgParams }
        : { ...params };
    setAuthState(AuthState.Loading);

    const expirationSeconds =
      masterConfig?.auth?.sessionExpirationSeconds?.passkey ??
      DEFAULT_SESSION_EXPIRATION_IN_SECONDS;
    const res = await withTurnkeyErrorHandling(
      () => client.loginOrSignupWithWallet({ ...params, expirationSeconds }),
      callbacks,
      "Failed to login or sign up with wallet",
    );
    if (res) {
      await handlePostAuth();
      setAuthState(AuthState.Authenticated);
    } else {
      setAuthState(AuthState.Unauthenticated);
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
    sessionType?: SessionType;
    sessionKey?: string;
  }): Promise<string> {
    if (!client) {
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    }
    setAuthState(AuthState.Loading);
    const res = await withTurnkeyErrorHandling(
      () => client.loginWithOtp(params),
      callbacks,
      "Failed to login with OTP",
    );
    if (res) {
      await handlePostAuth();
      setAuthState(AuthState.Authenticated);
    } else {
      setAuthState(AuthState.Unauthenticated);
    }
    return res;
  }

  async function signUpWithOtp(params: {
    verificationToken: string;
    contact: string;
    otpType: OtpType;
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
    let createSubOrgParams = params.createSubOrgParams;
    if (!createSubOrgParams && masterConfig?.auth?.createSuborgParams) {
      if (params.otpType === OtpType.Email) {
        createSubOrgParams = masterConfig.auth.createSuborgParams.email;
      } else if (params.otpType === OtpType.Sms) {
        createSubOrgParams = masterConfig.auth.createSuborgParams.sms;
      }
    }
    params =
      createSubOrgParams !== undefined
        ? { ...params, createSubOrgParams }
        : { ...params };
    setAuthState(AuthState.Loading);
    const res = await withTurnkeyErrorHandling(
      () => client.signUpWithOtp(params),
      callbacks,
      "Failed to sign up with OTP",
    );
    if (res) {
      await handlePostAuth();
      setAuthState(AuthState.Authenticated);
    } else {
      setAuthState(AuthState.Unauthenticated);
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
        createSubOrgParams = masterConfig.auth.createSuborgParams.email;
      } else if (params.otpType === OtpType.Sms) {
        createSubOrgParams = masterConfig.auth.createSuborgParams.sms;
      }
    }
    params =
      createSubOrgParams !== undefined
        ? { ...params, createSubOrgParams }
        : { ...params };

    setAuthState(AuthState.Loading);
    const res = await withTurnkeyErrorHandling(
      () => client.completeOtp(params),
      callbacks,
      "Failed to complete OTP",
    );
    if (res) {
      await handlePostAuth();
      setAuthState(AuthState.Authenticated);
    } else {
      setAuthState(AuthState.Unauthenticated);
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

    setAuthState(AuthState.Loading);
    const res = await withTurnkeyErrorHandling(
      () => client.completeOauth(params),
      callbacks,
      "Failed to complete OAuth",
    );
    if (res) {
      await handlePostAuth();
      setAuthState(AuthState.Authenticated);
    } else {
      setAuthState(AuthState.Unauthenticated);
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
    setAuthState(AuthState.Loading);
    const res = await withTurnkeyErrorHandling(
      () => client.loginWithOauth(params),
      callbacks,
      "Failed to login with OAuth",
    );
    if (res) {
      await handlePostAuth();
      setAuthState(AuthState.Authenticated);
    } else {
      setAuthState(AuthState.Unauthenticated);
    }
    return res;
  }

  async function signUpWithOauth(params: {
    oidcToken: string;
    publicKey: string;
    providerName: string;
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
      params.createSubOrgParams ?? masterConfig.auth?.createSuborgParams?.oAuth;
    params =
      createSubOrgParams !== undefined
        ? { ...params, createSubOrgParams }
        : { ...params };
    setAuthState(AuthState.Loading);
    const res = await withTurnkeyErrorHandling(
      () => client.signUpWithOauth(params),
      callbacks,
      "Failed to sign up with OAuth",
    );
    if (res) {
      await handlePostAuth();
      setAuthState(AuthState.Authenticated);
    } else {
      setAuthState(AuthState.Unauthenticated);
    }
    return res;
  }

  async function fetchWallets(params?: {
    stamperType?: StamperType;
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
    stamperType?: StamperType;
    paginationOptions?: v1Pagination;
    walletProviders?: WalletProvider[];
  }): Promise<v1WalletAccount[]> {
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
    wallet: v1WalletAccount;
    stampWith?: StamperType;
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
    wallet: v1WalletAccount;
    stampWith?: StamperType;
    subText?: string;
  }): Promise<v1SignRawPayloadResult> {
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
                wallet={params.wallet}
                stampWith={params.stampWith}
                onSuccess={(result) => {
                  resolve(result);
                }}
                onError={(error) => {
                  reject(error);
                }}
              />
            ),
          });
        }),
      callbacks,
      "Failed to sign message",
    );
  }

  async function signTransaction(params: {
    signWith: string;
    unsignedTransaction: string;
    type: v1TransactionType;
    stampWith?: StamperType;
  }): Promise<TSignTransactionResponse> {
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

  async function fetchUser(params?: {
    organizationId?: string;
    userId?: string;
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
    if (res) await refreshUser();
    return res;
  }

  async function removeUserEmail(params: { userId?: string }): Promise<string> {
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
    if (res) await refreshUser();
    return res;
  }

  async function updateUserPhoneNumber(params: {
    phoneNumber: string;
    verificationToken?: string;
    userId?: string;
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
    if (res) await refreshUser();
    return res;
  }

  async function removeUserPhoneNumber(params: {
    userId?: string;
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
    if (res) await refreshUser();
    return res;
  }

  async function updateUserName(params: {
    userName: string;
    userId?: string;
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
    if (res) await refreshUser();
    return res;
  }

  async function addOAuthProvider(params: {
    providerName: string;
    oidcToken: string;
    userId?: string;
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
    if (res) await refreshUser();
    return res;
  }

  async function removeOAuthProvider(params: {
    providerId: string;
    userId?: string;
  }): Promise<string[]> {
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    const res = await withTurnkeyErrorHandling(
      () => client.removeOAuthProvider(params),
      callbacks,
      "Failed to remove OAuth provider",
    );
    if (res) await refreshUser();
    return res;
  }

  async function addPasskey(params?: {
    name?: string;
    displayName?: string;
    userId?: string;
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
    if (res) await refreshUser();
    return res;
  }

  async function removePasskey(params: {
    authenticatorId: string;
    userId?: string;
  }): Promise<string[]> {
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    const res = await withTurnkeyErrorHandling(
      () => client.removePasskey(params),
      callbacks,
      "Failed to remove passkey",
    );
    if (res) await refreshUser();
    return res;
  }

  async function createWallet(params: {
    walletName: string;
    accounts?: v1WalletAccountParams[] | v1AddressFormat[];
    organizationId?: string;
    mnemonicLength?: number;
    stampWith?: StamperType;
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
    if (res) await refreshWallets();
    return res;
  }

  async function createWalletAccounts(params: {
    accounts: v1WalletAccountParams[];
    walletId: string;
    organizationId?: string;
    stampWith?: StamperType;
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
    if (res) await refreshWallets();
    return res;
  }

  async function exportWallet(params: {
    walletId: string;
    targetPublicKey: string;
    organizationId?: string;
    stamperType?: StamperType;
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
    if (res) await refreshWallets();
    return res;
  }

  async function importWallet(params: {
    encryptedBundle: string;
    walletName: string;
    accounts?: v1WalletAccountParams[];
    userId?: string;
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
    if (res) await refreshWallets();
    return res;
  }

  async function deleteSubOrganization(params?: {
    deleteWithoutExport?: boolean;
    stamperWith?: StamperType;
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

  async function createSubOrganization(params?: {
    oauthProviders?: Provider[];
    userEmail?: string;
    userPhoneNumber?: string;
    userName?: string;
    subOrgName?: string;
    passkey?: v1AuthenticatorParamsV2;
    customAccounts?: v1WalletAccountParams[];
    wallet?: {
      publicKey: string;
      type: Chain;
    };
  }): Promise<TCreateSubOrganizationResponse> {
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    return withTurnkeyErrorHandling(
      () => client.createSubOrganization(params),
      callbacks,
      "Failed to create sub-organization",
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
    sessionType?: SessionType;
    expirationSeconds?: string; // TODO: Need to pull from proxyAuthConfig
    publicKey?: string;
    sessionKey?: string;
    invalidateExisitng?: boolean;
  }): Promise<TStampLoginResponse | undefined> {
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

    await withTurnkeyErrorHandling(
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
    return;
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

  async function refreshUser(): Promise<void> {
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    const user = await withTurnkeyErrorHandling(
      () => client.fetchUser(),
      callbacks,
      "Failed to refresh user",
    );
    if (user) {
      setUser(user);
    }
  }

  async function refreshWallets(): Promise<void> {
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    const wallets = await withTurnkeyErrorHandling(
      () => fetchWallets(),
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
    stamperType?: StamperType;
  }) => {
    const { walletId, exportType, targetPublicKey, stamperType } = params;
    pushPage({
      key: "Export Wallet",
      content: (
        <ExportComponent
          walletId={walletId ?? wallets[0]?.walletId!}
          exportType={exportType ?? ExportType.Wallet}
          {...(targetPublicKey !== undefined ? { targetPublicKey } : {})}
          {...(stamperType !== undefined ? { stamperType } : {})}
        />
      ),
    });
  };

  const handleImport = async (params: {
    defaultWalletAccounts?: v1AddressFormat[] | v1WalletAccountParams[];
    onImportSuccess?: (walletId: string) => void;
    successPageDuration?: number | undefined;
  }) => {
    const { defaultWalletAccounts, onImportSuccess, successPageDuration } =
      params;
    pushPage({
      key: "Import Wallet",
      content: (
        <ImportComponent
          {...(defaultWalletAccounts !== undefined
            ? { defaultWalletAccounts }
            : {})}
          {...(onImportSuccess !== undefined ? { onImportSuccess } : {})}
          {...(successPageDuration !== undefined
            ? { successPageDuration }
            : {})}
        />
      ),
    });
  };

  const handleUpdateUserName = async (params?: {
    userName?: string;
    title?: string;
    subTitle?: string;
    onSuccess?: (userId: string) => void;
    successPageDuration?: number | undefined;
  }) => {
    const {
      onSuccess = undefined,
      successPageDuration,
      subTitle,
      title,
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

    const onContinue = async (userName: string) => {
      if (!userName || userName === "") {
        throw new TurnkeyError(
          "User name is required for verification.",
          TurnkeyErrorCodes.MISSING_PARAMS,
        );
      }
      const res = await updateUserName({
        userName,
        userId: session.userId,
      });

      if (res) {
        if (onSuccess) {
          onSuccess(res);
        } else {
          if (successPageDuration && successPageDuration !== 0) {
            pushPage({
              key: "success",
              content: (
                <SuccessPage
                  text="User Name Changed Successfully!"
                  duration={successPageDuration}
                  onComplete={() => {
                    closeModal();
                  }}
                />
              ),
              preventBack: true,
              showTitle: false,
            });
          } else {
            closeModal();
          }
        }
        await refreshUser();
      } else {
        closeModal();
        throw new TurnkeyError(
          "Failed to update user name.",
          TurnkeyErrorCodes.UPDATE_USER_NAME_ERROR,
        );
      }
    };

    try {
      if (!params?.userName && params?.userName !== "") {
        pushPage({
          key: "Update User Name",
          content: (
            <UpdateUserName
              onContinue={onContinue}
              {...(title !== undefined ? { title } : {})}
              {...(subTitle !== undefined ? { subTitle } : {})}
            />
          ),
          showTitle: false,
        });
      } else {
        onContinue(params?.userName);
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
    onSuccess?: (userId: string) => void;
    successPageDuration?: number | undefined;
  }) => {
    const {
      onSuccess = undefined,
      successPageDuration,
      subTitle,
      title,
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

    try {
      if (!params?.phoneNumber && params?.phoneNumber !== "") {
        pushPage({
          key: "Update Phone Number",
          content: (
            <UpdatePhoneNumber
              onContinue={(phone: string, formattedPhone: string) =>
                updatePhoneNumberContinue({
                  phone,
                  formattedPhone,
                  onSuccess,
                  successPageDuration,
                  initOtp,
                  verifyOtp,
                  updateUserPhoneNumber,
                  pushPage,
                  closeModal,
                  session,
                })
              }
              {...(title !== undefined ? { title } : {})}
              {...(subTitle !== undefined ? { subTitle } : {})}
            />
          ),
          showTitle: false,
        });
      } else {
        updatePhoneNumberContinue({
          phone: params?.phoneNumber,
          formattedPhone: params?.formattedPhone || params?.phoneNumber,
          onSuccess,
          successPageDuration,
          initOtp,
          verifyOtp,
          updateUserPhoneNumber,
          pushPage,
          closeModal,
          session,
        });
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
    onSuccess?: (userId: string) => void;
    successPageDuration?: number | undefined;
  }) => {
    const {
      onSuccess = undefined,
      successPageDuration,
      subTitle,
      title,
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

    try {
      if (!params?.email && params?.email !== "") {
        pushPage({
          key: "Update Email",
          content: (
            <UpdateEmail
              onContinue={(emailInput: string) =>
                updateEmailContinue({
                  email: emailInput,
                  onSuccess,
                  successPageDuration,
                  initOtp,
                  verifyOtp,
                  updateUserEmail,
                  pushPage,
                  closeModal,
                  session,
                })
              }
              {...(title !== undefined ? { title } : {})}
              {...(subTitle !== undefined ? { subTitle } : {})}
            />
          ),
          showTitle: false,
        });
      } else {
        updateEmailContinue({
          email: params.email,
          onSuccess,
          successPageDuration,
          initOtp,
          verifyOtp,
          updateUserEmail,
          pushPage,
          closeModal,
          session,
        });
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
    onSuccess?: (userId: string) => void;
    successPageDuration?: number | undefined;
  }) => {
    const {
      onSuccess = undefined,
      successPageDuration,
      subTitle,
      title,
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

    try {
      if (!params?.email && params?.email !== "") {
        pushPage({
          key: "Add Email",
          content: (
            <UpdateEmail
              onContinue={async (emailInput: string) => {
                await addEmailContinue({
                  email: emailInput,
                  onSuccess,
                  successPageDuration,
                  initOtp,
                  verifyOtp,
                  updateUserEmail,
                  pushPage,
                  closeModal,
                  session,
                });
              }}
              {...(!user?.userEmail
                ? { title: title ?? "Connect an email" }
                : {})}
              {...(subTitle !== undefined ? { subTitle } : {})}
            />
          ),
          showTitle: false,
        });
      } else {
        await addEmailContinue({
          email: params.email,
          onSuccess,
          successPageDuration,
          initOtp,
          verifyOtp,
          updateUserEmail,
          pushPage,
          closeModal,
          session,
        });
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
    onSuccess?: (userId: string) => void;
    successPageDuration?: number | undefined;
  }) => {
    const {
      onSuccess = undefined,
      successPageDuration,
      subTitle,
      title,
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

    try {
      if (!params?.phoneNumber && params?.phoneNumber !== "") {
        pushPage({
          key: "Add Phone Number",
          content: (
            <UpdatePhoneNumber
              onContinue={(phone: string, formattedPhone: string) =>
                addPhoneNumberContinue({
                  phone,
                  formattedPhone,
                  onSuccess,
                  successPageDuration,
                  initOtp,
                  verifyOtp,
                  updateUserPhoneNumber,
                  pushPage,
                  closeModal,
                  session,
                })
              }
              {...(!user?.userPhoneNumber
                ? { title: title ?? "Connect a phone number" }
                : {})}
              {...(subTitle !== undefined ? { subTitle } : {})}
            />
          ),
          showTitle: false,
        });
      } else {
        addPhoneNumberContinue({
          phone: params.phoneNumber,
          formattedPhone: params?.formattedPhone || params.phoneNumber,
          onSuccess,
          successPageDuration,
          initOtp,
          verifyOtp,
          updateUserPhoneNumber,
          pushPage,
          closeModal,
          session,
        });
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
    title?: string;
    subTitle?: string;
    onSuccess?: (authenticatorIds: string[]) => void;
    successPageDuration?: number | undefined;
  }) => {
    const {
      authenticatorId,
      successPageDuration,
      onSuccess = undefined,
      subTitle,
      title,
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
      pushPage({
        key: "Remove Passkey",
        content: (
          <RemovePasskey
            authenticatorId={authenticatorId}
            onContinue={async () => {
              removePasskeyContinue({
                authenticatorId,
                onSuccess,
                successPageDuration,
                pushPage,
                closeModal,
                session,
                removePasskey,
              });
            }}
            {...(title !== undefined ? { title } : {})}
            {...(subTitle !== undefined ? { subTitle } : {})}
          />
        ),
        showTitle: false,
      });
    } catch (error) {
      if (error instanceof TurnkeyError) {
        throw error;
      }
      throw new TurnkeyError(
        "Failed to remove passkey in handler.",
        TurnkeyErrorCodes.REMOVE_PASSKEY_ERROR,
        error,
      );
    }
  };

  const handleAddPasskey = async (params?: {
    name?: string;
    displayName?: string;
    userId?: string;
    onSuccess?: (authenticatorIds: string[]) => void;
    successPageDuration?: number | undefined;
  }): Promise<void> => {
    const {
      name,
      displayName,
      onSuccess = undefined,
      successPageDuration,
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
      const res = await withTurnkeyErrorHandling(
        () =>
          addPasskey({
            ...(name && { name }),
            ...(displayName && { displayName }),
            userId,
          }),
        callbacks,
        "Failed to create passkey",
      );
      pushPage({
        key: "Passkey Added",
        content: (
          <SuccessPage
            text="Successfully added passkey!"
            duration={successPageDuration}
            onComplete={() => {
              closeModal();
              if (onSuccess) {
                onSuccess(res);
              }
            }}
          />
        ),
        preventBack: true,
        showTitle: false,
      });
      await refreshUser();
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
    onSuccess?: (providerIds: string[]) => void;
    successPageDuration?: number | undefined;
  }) => {
    const {
      providerId,
      onSuccess = undefined,
      successPageDuration,
      subTitle,
      title,
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
      pushPage({
        key: "Remove OAuth Provider",
        content: (
          <RemoveOAuthProvider
            providerId={providerId}
            onContinue={async () => {
              removeOAuthProviderContinue({
                providerId,
                onSuccess,
                successPageDuration,
                pushPage,
                closeModal,
                session,
                removeOAuthProvider,
              });
            }}
            {...(title !== undefined ? { title } : {})}
            {...(subTitle !== undefined ? { subTitle } : {})}
          />
        ),
        showTitle: false,
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

    const { providerName } = params;

    const onOAuthSuccess = async (params: {
      providerName: string;
      oidcToken: string;
    }) => {
      await withTurnkeyErrorHandling(
        () =>
          addOAuthProvider({
            providerName: params.providerName,
            oidcToken: params.oidcToken,
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

      await refreshUser();
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
        removeOAuthProvider,
        addPasskey,
        removePasskey,
        createWallet,
        createWalletAccounts,
        exportWallet,
        importWallet,
        deleteSubOrganization,
        createSubOrganization,
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
