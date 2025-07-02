import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import {
  AuthState,
  GOOGLE_AUTH_URL,
  isValidSession,
  popupHeight,
  popupWidth,
  SESSION_WARNING_THRESHOLD_MS,
  withTurnkeyErrorHandling,
} from "../../utils";
import {
  CreateSubOrgParams,
  DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
  ExportBundle,
  OtpType,
  Provider,
  StamperType,
  TurnkeyClient,
  Wallet,
  WalletAccount,
} from "@turnkey/sdk-js";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { TurnkeyClientMethods, TurnkeySDKClientBase } from "@turnkey/sdk-js";
import {
  Session,
  SessionType,
  TCreateSubOrganizationResponse,
  TDeleteSubOrganizationResponse,
  TGetWalletAccountsResponse,
  TSignTransactionResponse,
  TStampLoginResponse,
  TurnkeyError,
  TurnkeyErrorCodes,
  TurnkeyNetworkError,
  v1AddressFormat,
  v1Attestation,
  v1AuthenticatorParamsV2,
  v1GetWalletKitConfigResponse,
  v1Pagination,
  v1SignRawPayloadResult,
  v1TransactionType,
  v1User,
  v1WalletAccount,
} from "@turnkey/sdk-types";
import { useModal } from "../modal/Provider";
import { TurnkeyCallbacks, TurnkeyProviderConfig } from "../TurnkeyProvider";
import { AuthComponent } from "../../components/auth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { WalletType } from "@turnkey/wallet-stamper";
import { ActionPage } from "../../components/auth/Action";

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
  login: () => Promise<void>;
  handleGoogleOauth: (params: {
    clientId?: string;
    additionalState?: Record<string, string>;
    openInPage?: boolean;
  }) => Promise<void>;
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
  const proxyAuthConfigRef = useRef<v1GetWalletKitConfigResponse | null>(null);

  const [allSessions, setAllSessions] = useState<
    Record<string, Session> | undefined
  >(undefined);
  const { pushPage } = useModal();

  useEffect(() => {
    initializeClient();
  }, []);

  // Handle redirect-based auth
  useEffect(() => {
    if (window.location.hash) {
      if (!client) return; // Client is not ready yet. Don't error just return.
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const idToken = hashParams.get("id_token");
      const state = hashParams.get("state");

      const stateParams = new URLSearchParams(state || "");
      const provider = stateParams.get("provider");
      const flow = stateParams.get("flow");
      const openModal = stateParams.get("openModal");

      const publicKey = stateParams.get("publicKey");

      if (!publicKey) {
        throw new Error(
          "Public key is missing in the state parameters. You must encode the public key in the state parameter when initiating the OAuth flow.",
        );
      }

      if (idToken && flow === "redirect") {
        if (openModal === "true") {
          const providerName = provider
            ? provider?.charAt(0).toUpperCase() + provider?.slice(1)
            : "Provider";
          // This state is set when the OAuth flow comes from the AuthComponent. We handle it differently because the callback is ran inside the loading component.
          pushPage({
            key: "Google OAuth",
            content: (
              <ActionPage
                title={`Authenticating with ${providerName}...`}
                action={async () => {
                  await completeOauth({
                    oidcToken: idToken,
                    publicKey,
                    // TODO (Amir): Shall we pass createSubOrgParams here?
                  });

                  // TODO (Amir): Shall we also allow the oAuthcallbacks to run here?
                }}
                icon={<FontAwesomeIcon size="3x" icon={faGoogle} />}
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
            // TODO (Amir): Shall we pass createSubOrgParams here?. Edit: Yes totally. We need to find a way to pass it in the page replace flow.
          });
        }
        window.history.replaceState(
          null,
          document.title,
          window.location.pathname + window.location.search,
        );
      }
    }
  }, [client]);

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

  const buildConfig = (proxyAuthConfig: v1GetWalletKitConfigResponse) => {
    return {
      ...config,
      auth: {
        ...config.auth,
        methods: {
          ...config.auth?.methods,
          emailOtpAuthEnabled:
            config.auth?.methods?.emailOtpAuthEnabled ??
            proxyAuthConfig.emailEnabled,
          smsOtpAuthEnabled:
            config.auth?.methods?.smsOtpAuthEnabled ??
            proxyAuthConfig.smsEnabled,
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
            config.auth?.methods?.appleOAuthEnabled ??
            proxyAuthConfig.appleEnabled,
          facebookOAuthEnabled:
            config.auth?.methods?.facebookOAuthEnabled ??
            proxyAuthConfig.facebookEnabled,
        },
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
      },
    } as TurnkeyProviderConfig;
  };

  const initializeClient = async () => {
    try {
      const turnkeyClient = new TurnkeyClient({
        apiBaseUrl: config.apiBaseUrl,
        authProxyUrl: config.authProxyUrl,
        authProxyId: config.authProxyId,
        organizationId: config.organizationId,
        passkeyConfig: {
          rpId: config.passkeyConfig?.rpId,
          timeout: config.passkeyConfig?.timeout || 60000, // 60 seconds
          userVerification:
            config.passkeyConfig?.userVerification || "preferred",
          allowCredentials: config.passkeyConfig?.allowCredentials || [],
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
        if (autoRefreshSession) {
          await refreshSession({
            sessionType: session.sessionType,
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
      const sessionKey = await client!.getActiveSessionKey();
      const session = await client!.getSession({
        ...(sessionKey && { sessionKey }),
      });

      if (session && sessionKey)
        await scheduleSessionExpiration({ sessionKey, expiry: session.expiry });

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
    saveInClient?: boolean;
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
    walletId: string;
    stamperType?: StamperType;
    paginationOptions?: v1Pagination;
  }): Promise<TGetWalletAccountsResponse> {
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
    wallet?: v1WalletAccount;
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

  async function updateUser(params: {
    userId?: string;
    organizationId?: string;
    name?: string;
    email?: string;
    phoneNumber?: string;
  }): Promise<v1User> {
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    const res = await withTurnkeyErrorHandling(
      () => client.updateUser(params),
      callbacks,
      "Failed to update user",
    );
    if (res) {
      setUser(res);
    }
    return res;
  }

  async function createWallet(params: {
    walletName: string;
    accounts?: WalletAccount[] | v1AddressFormat[];
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
    accounts: WalletAccount[];
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
    accounts?: WalletAccount[];
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
    customAccounts?: WalletAccount[];
    wallet?: {
      publicKey: string;
      type: WalletType;
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
    const sessionKey = await client.getActiveSessionKey();
    const session = await client.getSession({
      ...(sessionKey && { sessionKey }),
    });

    if (session && sessionKey)
      await scheduleSessionExpiration({ sessionKey, expiry: session.expiry });

    const allSessions = await client.getAllSessions();
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
    const session = await client.getSession();
    const allSessions = await client.getAllSessions();
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
    const session = await client.getSession({ sessionKey });

    if (session && sessionKey) {
      await scheduleSessionExpiration({ sessionKey, expiry: session.expiry });
    }

    const allSessions = await client.getAllSessions();
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

  async function getProxyAuthConfig(): Promise<v1GetWalletKitConfigResponse> {
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

  async function handleGoogleOauth(params: {
    clientId?: string;
    openInPage?: boolean;
    additionalState?: Record<string, string>;
  }): Promise<void> {
    const {
      clientId = masterConfig?.auth?.oAuthConfig?.googleClientId,
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

      console.log(typeof openInPage);
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
      console.log("openingopage", openInPage);
      if (openInPage) {
        console.log("WHHYYY");
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

                  if (callbacks?.onOauthRedirect) {
                    callbacks.onOauthRedirect({ idToken, publicKey });
                  } else {
                    completeOauth({
                      oidcToken: idToken,
                      publicKey,
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

  const login = async () => {
    pushPage({
      key: "Log in or sign up",
      content: <AuthComponent />,
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
        login,
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
        signMessage,
        signTransaction,
        fetchUser,
        updateUser,
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
        handleGoogleOauth,
        getProxyAuthConfig,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
};
