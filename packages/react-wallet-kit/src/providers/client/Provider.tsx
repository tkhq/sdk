import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import {
  GOOGLE_AUTH_URL,
  isValidSession,
  popupHeight,
  popupWidth,
  SESSION_WARNING_THRESHOLD_MS,
} from "../../utils";
import {
  CreateSubOrgParams,
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
  v1AddressFormat,
  v1Attestation,
  v1AuthenticatorParamsV2,
  v1Pagination,
  v1SignRawPayloadResult,
  v1TransactionType,
  v1User,
  v1WalletAccount,
} from "@turnkey/sdk-types";
import { useModal } from "../modal/Provider";
import { TurnkeyCallbacks, TurnkeyProviderConfig } from "../TurnkeyProvider";
import { AuthComponent } from "../../components/auth";
import { OAuthLoading } from "../../components/auth/OAuth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { WalletProvider, WalletType } from "@turnkey/wallet-stamper";
import { Chain } from "@turnkey/sdk-js/dist/__stampers__/wallet/base";

interface ClientProviderProps {
  children: ReactNode;
  config: TurnkeyProviderConfig;
  callbacks?: TurnkeyCallbacks | undefined;
}

export interface ClientContextType extends TurnkeyClientMethods {
  httpClient: TurnkeySDKClientBase | undefined;
  session: Session | undefined;
  allSessions?: Record<string, Session> | undefined;
  authState: "unauthenticated" | "loading" | "authenticated" | "ready";
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
  const [authState, setAuthState] = useState<
    "unauthenticated" | "loading" | "authenticated" | "ready"
  >("unauthenticated");
  const expiryTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const [allSessions, setAllSessions] = useState<
    Record<string, Session> | undefined
  >(undefined);
  const { pushPage } = useModal();

  useEffect(() => {
    const initializeClient = async () => {
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
        walletConfig: config.walletConfig,
      });

      setAutoRefreshSession(config?.autoRefreshSession ?? false);

      await turnkeyClient.init();
      setClient(turnkeyClient);
    };

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
          // This state is set when the OAuth flow comes from the AuthComponent. We handle it differently because the callback is ran inside the loading component.
          pushPage({
            key: "Log in or sign up",
            content: (
              <OAuthLoading
                name={provider ?? "OAuth Provider"}
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
    const initializeSessions = async () => {
      setAuthState("loading");
      const allSessions = await getAllSessions();
      if (!allSessions) {
        setAuthState("unauthenticated");
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
      const activeSessionKey = await client.getActiveSessionKey();
      if (activeSessionKey) {
        setSession(allSessions?.[activeSessionKey]);
        setAuthState("authenticated");
        return;
      }
      setAuthState("unauthenticated");
    };

    initializeSessions();

    return () => {
      clearSessionTimeouts();
    };
  }, [client]);

  async function scheduleSessionExpiration(params: {
    sessionKey: string;
    expiry: number;
  }) {
    const { sessionKey, expiry } = params;

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
  }

  function clearSessionTimeouts() {
    Object.values(expiryTimeoutsRef.current).forEach((timeout) => {
      clearTimeout(timeout);
    });
    expiryTimeoutsRef.current = {};
  }

  const handlePostAuth = async () => {
    const sessionKey = await client!.getActiveSessionKey();
    const session = await client!.getSession({ sessionKey });

    if (session && sessionKey)
      await scheduleSessionExpiration({ sessionKey, expiry: session.expiry });

    const allSessions = await client!.getAllSessions();
    setSession(session);
    setAllSessions(allSessions);
  };

  async function createPasskey(params?: {
    name?: string;
    displayName?: string;
  }): Promise<{ attestation: v1Attestation; encodedChallenge: string }> {
    if (!client) {
      throw new Error("Client is not initialized.");
    }
    return client.createPasskey(params);
  }

  async function logout(params?: { sessionKey?: string }): Promise<void> {
    if (!client) {
      throw new Error("Client is not initialized.");
    }
    setAuthState("loading");
    await client.logout(params);
    await handlePostAuth();
    setAuthState("unauthenticated");
    return;
  }

  async function loginWithPasskey(params?: {
    sessionType?: SessionType;
    publicKey?: string;
    sessionKey?: string | undefined;
  }): Promise<string> {
    if (!client) {
      throw new Error("Client is not initialized.");
    }
    setAuthState("loading");
    const res = await client.loginWithPasskey(params);
    if (res) {
      await handlePostAuth();
      setAuthState("authenticated");
    } else {
      setAuthState("unauthenticated");
    }
    return res;
  }

  async function signUpWithPasskey(params?: {
    createSubOrgParams?: CreateSubOrgParams;
    sessionType?: SessionType;
    sessionKey?: string | undefined;
    passkeyDisplayName?: string;
  }): Promise<string> {
    if (!client) {
      throw new Error("Client is not initialized.");
    }
    setAuthState("loading");
    const res = await client.signUpWithPasskey(params);
    if (res) {
      await handlePostAuth();
      setAuthState("authenticated");
    } else {
      setAuthState("unauthenticated");
    }
    return res;
  }

  function getWalletProviders(chain?: Chain): WalletProvider[] {
    if (!client) throw new Error("Client is not initialized.");
    return client.getWalletProviders(chain);
  }

  async function loginWithWallet(params: {
    walletProvider: WalletProvider;
    sessionType?: SessionType;
    publicKey?: string;
    sessionKey?: string | undefined;
  }): Promise<string> {
    if (!client) {
      throw new Error("Client is not initialized.");
    }
    setAuthState("loading");
    const res = await client.loginWithWallet(params);
    if (res) {
      await handlePostAuth();
      setAuthState("authenticated");
    } else {
      setAuthState("unauthenticated");
    }
    return res;
  }

  async function signUpWithWallet(params: {
    walletProvider: WalletProvider;
    createSubOrgParams?: CreateSubOrgParams;
    sessionType?: SessionType;
    sessionKey?: string | undefined;
  }): Promise<string> {
    if (!client) {
      throw new Error("Client is not initialized.");
    }
    setAuthState("loading");
    const res = await client.signUpWithWallet(params);
    if (res) {
      await handlePostAuth();
      setAuthState("authenticated");
    } else {
      setAuthState("unauthenticated");
    }
    return res;
  }

  async function initOtp(params: {
    otpType: OtpType;
    contact: string;
  }): Promise<string> {
    if (!client) {
      throw new Error("Client is not initialized.");
    }
    return client.initOtp(params);
  }

  async function verifyOtp(params: {
    otpId: string;
    otpCode: string;
    contact: string;
    otpType: OtpType;
  }): Promise<{ subOrganizationId: string; verificationToken: string }> {
    if (!client) {
      throw new Error("Client is not initialized.");
    }
    return client.verifyOtp(params);
  }

  async function loginWithOtp(params: {
    verificationToken: string;
    publicKey?: string;
    invalidateExisting?: boolean;
    sessionType?: SessionType;
    sessionKey?: string | undefined;
  }): Promise<string> {
    if (!client) {
      throw new Error("Client is not initialized.");
    }
    setAuthState("loading");
    const res = await client.loginWithOtp(params);
    if (res) {
      await handlePostAuth();
      setAuthState("authenticated");
    } else {
      setAuthState("unauthenticated");
    }
    return res;
  }

  async function signUpWithOtp(params: {
    verificationToken: string;
    contact: string;
    otpType: OtpType;
    createSubOrgParams?: CreateSubOrgParams;
    sessionType?: SessionType;
    sessionKey?: string | undefined;
  }): Promise<string> {
    if (!client) {
      throw new Error("Client is not initialized.");
    }
    setAuthState("loading");
    const res = await client.signUpWithOtp(params);
    if (res) {
      await handlePostAuth();
      setAuthState("authenticated");
    } else {
      setAuthState("unauthenticated");
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
    sessionKey?: string | undefined;
    createSubOrgParams?: CreateSubOrgParams;
  }): Promise<string> {
    if (!client) {
      throw new Error("Client is not initialized.");
    }
    setAuthState("loading");
    const res = await client.completeOtp(params);
    if (res) {
      await handlePostAuth();
      setAuthState("authenticated");
    } else {
      setAuthState("unauthenticated");
    }
    return res;
  }

  async function completeOauth(params: {
    oidcToken: string;
    publicKey: string;
    sessionKey?: string | undefined;
    invalidateExisting?: boolean;
    createSubOrgParams?: CreateSubOrgParams | undefined;
  }): Promise<string> {
    if (!client) {
      throw new Error("Client is not initialized.");
    }
    setAuthState("loading");
    const res = await client.completeOauth(params);
    if (res) {
      await handlePostAuth();
      setAuthState("authenticated");
    } else {
      setAuthState("unauthenticated");
    }
    return res;
  }

  async function loginWithOauth(params: {
    oidcToken: string;
    publicKey: string;
    invalidateExisting?: boolean;
    sessionKey?: string | undefined;
  }): Promise<string> {
    if (!client) {
      throw new Error("Client is not initialized.");
    }
    setAuthState("loading");
    const res = await client.loginWithOauth(params);
    if (res) {
      await handlePostAuth();
      setAuthState("authenticated");
    } else {
      setAuthState("unauthenticated");
    }
    return res;
  }

  async function signUpWithOauth(params: {
    oidcToken: string;
    publicKey: string;
    providerName: string;
    createSubOrgParams?: CreateSubOrgParams;
    sessionType?: SessionType;
    sessionKey?: string | undefined;
  }): Promise<string> {
    if (!client) {
      throw new Error("Client is not initialized.");
    }
    setAuthState("loading");
    const res = await client.signUpWithOauth(params);
    if (res) {
      await handlePostAuth();
      setAuthState("authenticated");
    } else {
      setAuthState("unauthenticated");
    }
    return res;
  }

  async function fetchWallets(params?: {
    stamperType?: StamperType;
    saveInClient?: boolean;
  }): Promise<Wallet[]> {
    if (!client) {
      throw new Error("Client is not initialized.");
    }
    return client.fetchWallets(params);
  }

  async function fetchWalletAccounts(params: {
    walletId: string;
    stamperType?: StamperType;
    paginationOptions?: v1Pagination;
  }): Promise<TGetWalletAccountsResponse> {
    if (!client) {
      throw new Error("Client is not initialized.");
    }
    return client.fetchWalletAccounts(params);
  }

  const login = async () => {
    pushPage({
      key: "Log in or sign up",
      content: <AuthComponent />,
    });
  };

  async function signMessage(params: {
    message: string;
    wallet?: v1WalletAccount;
    stampWith?: StamperType;
  }): Promise<v1SignRawPayloadResult> {
    if (!client) throw new Error("Client is not initialized.");
    return client.signMessage(params);
  }

  async function signTransaction(params: {
    signWith: string;
    unsignedTransaction: string;
    type: v1TransactionType;
    stampWith?: StamperType;
  }): Promise<TSignTransactionResponse> {
    if (!client) throw new Error("Client is not initialized.");
    return client.signTransaction(params);
  }

  async function fetchUser(params?: {
    organizationId?: string;
    userId?: string;
  }): Promise<v1User> {
    if (!client) throw new Error("Client is not initialized.");
    return client.fetchUser(params);
  }

  async function createWallet(params: {
    walletName: string;
    accounts?: WalletAccount[] | v1AddressFormat[];
    organizationId?: string;
    mnemonicLength?: number;
    stampWith?: StamperType;
  }): Promise<string> {
    if (!client) throw new Error("Client is not initialized.");
    return client.createWallet(params);
  }

  async function createWalletAccounts(params: {
    accounts: WalletAccount[];
    walletId: string;
    organizationId?: string;
    stampWith?: StamperType;
  }): Promise<string[]> {
    if (!client) throw new Error("Client is not initialized.");
    return client.createWalletAccounts(params);
  }

  async function exportWallet(params: {
    walletId: string;
    targetPublicKey: string;
    organizationId?: string;
    stamperType?: StamperType;
  }): Promise<ExportBundle> {
    if (!client) throw new Error("Client is not initialized.");
    return client.exportWallet(params);
  }

  async function importWallet(params: {
    encryptedBundle: string;
    walletName: string;
    accounts?: WalletAccount[];
    userId?: string;
  }): Promise<string> {
    if (!client) throw new Error("Client is not initialized.");
    return client.importWallet(params);
  }

  async function deleteSubOrganization(params?: {
    deleteWithoutExport?: boolean;
    stamperWith?: StamperType;
  }): Promise<TDeleteSubOrganizationResponse> {
    if (!client) throw new Error("Client is not initialized.");
    return client.deleteSubOrganization(params);
  }

  async function createSubOrganization(params?: {
    oauthProviders?: Provider[] | undefined;
    userEmail?: string | undefined;
    userPhoneNumber?: string | undefined;
    userName?: string | undefined;
    subOrgName?: string | undefined;
    passkey?: v1AuthenticatorParamsV2 | undefined;
    customAccounts?: WalletAccount[] | undefined;
    wallet?:
      | {
          publicKey: string;
          type: WalletType;
        }
      | undefined;
  }): Promise<TCreateSubOrganizationResponse> {
    if (!client) throw new Error("Client is not initialized.");
    return client.createSubOrganization(params);
  }

  async function storeSession(params: {
    sessionToken: string;
    sessionKey?: string | undefined;
  }): Promise<void> {
    if (!client) throw new Error("Client is not initialized.");
    await client.storeSession(params);
    const sessionKey = await client.getActiveSessionKey();
    const session = await client.getSession({ sessionKey });

    if (session && sessionKey)
      await scheduleSessionExpiration({ sessionKey, expiry: session.expiry });

    const allSessions = await client.getAllSessions();
    setSession(session);
    setAllSessions(allSessions);
    return;
  }

  async function clearSession(params?: {
    sessionKey?: string | undefined;
  }): Promise<void> {
    if (!client) throw new Error("Client is not initialized.");
    await client.clearSession(params);
    const session = await client.getSession();
    const allSessions = await client.getAllSessions();
    setSession(session);
    setAllSessions(allSessions);
    return;
  }

  async function clearAllSessions(): Promise<void> {
    if (!client) throw new Error("Client is not initialized.");
    setSession(undefined);
    setAllSessions(undefined);
    return await client.clearAllSessions();
  }

  async function refreshSession(params?: {
    sessionType?: SessionType;
    expirationSeconds?: string | undefined;
    publicKey?: string;
    sessionKey?: string | undefined;
    invalidateExisitng?: boolean;
  }): Promise<TStampLoginResponse | undefined> {
    if (!client) throw new Error("Client is not initialized.");

    const activeSessionKey = await client.getActiveSessionKey();
    if (!activeSessionKey) {
      throw new Error("No active session found.");
    }

    let sessionKey = params?.sessionKey ?? activeSessionKey;

    await client.refreshSession({ ...params, sessionKey });
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
    sessionKey?: string | undefined;
  }): Promise<Session | undefined> {
    if (!client) throw new Error("Client is not initialized.");
    return client.getSession(params);
  }

  async function getAllSessions(): Promise<
    Record<string, Session> | undefined
  > {
    if (!client) throw new Error("Client is not initialized.");
    return client.getAllSessions();
  }

  async function setActiveSession(params: {
    sessionKey: string;
  }): Promise<void> {
    if (!client) throw new Error("Client is not initialized.");
    const session = await client.getSession({ sessionKey: params.sessionKey });
    if (!session) {
      throw new Error("Session not found.");
    }
    await client.setActiveSession(params);
    setSession(session);
    return;
  }

  async function getActiveSessionKey(): Promise<string | undefined> {
    if (!client) throw new Error("Client is not initialized.");
    return client.getActiveSessionKey();
  }

  async function clearUnusedKeyPairs(): Promise<void> {
    if (!client) throw new Error("Client is not initialized.");
    return client.clearUnusedKeyPairs();
  }

  async function createApiKeyPair(params?: {
    externalKeyPair?: CryptoKeyPair | { publicKey: string; privateKey: string };
    storeOverride?: boolean;
  }): Promise<string> {
    if (!client) throw new Error("Client is not initialized.");
    return client.createApiKeyPair(params);
  }

  async function handleGoogleOauth(params: {
    clientId?: string;
    openInPage?: boolean;
    additionalState?: Record<string, string>;
  }): Promise<void> {
    const {
      clientId = config.auth?.googleClientId,
      openInPage = config.auth?.openOAuthInPage,
      additionalState: additionalParameters,
    } = params;

    try {
      if (!clientId) {
        throw new Error("Google Client ID is not configured.");
      }
      if (!config.auth?.oAuthRedirectUri) {
        throw new Error("OAuth redirect URI is not configured.");
      }

      const flow = openInPage ? "redirect" : "popup";
      const redirectURI = config.auth?.oAuthRedirectUri.replace(/\/$/, "");

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

  return (
    <ClientContext.Provider
      value={{
        session,
        allSessions,
        authState,
        httpClient: client?.httpClient,
        login,
        createPasskey,
        logout,
        loginWithPasskey,
        signUpWithPasskey,
        getWalletProviders,
        loginWithWallet,
        signUpWithWallet,
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
      }}
    >
      {children}
    </ClientContext.Provider>
  );
};
