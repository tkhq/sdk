import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import { GOOGLE_AUTH_URL, popupHeight, popupWidth } from "../../utils";
import {
  CreateSubOrgParams,
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
  useState,
} from "react";
import { TurnkeyClientMethods, TurnkeySDKClientBase } from "@turnkey/sdk-js";
import {
  Session,
  SessionType,
  TGetWalletAccountsResponse,
  TSignTransactionResponse,
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
import { WalletType } from "@turnkey/wallet-stamper";

interface ClientProviderProps {
  children: ReactNode;
  config: TurnkeyProviderConfig;
  callbacks?: TurnkeyCallbacks | undefined;
}

export interface ClientContextType extends TurnkeyClientMethods {
  httpClient: TurnkeySDKClientBase | undefined;
  session: Session | undefined;
  allSessions?: Record<string, Session> | undefined;
  login: () => Promise<void>;
  handleGoogleOauth: (params: {
    clientId?: string;
    setLoading?: (loading: boolean) => void;
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
      });

      await turnkeyClient.init();
      setClient(turnkeyClient);
    };

    initializeClient();
  }, []);

  useEffect(() => {
    const fetchSessions = async () => {
      if (client) {
        const currentSessionPromise = client.getSession();
        const allSessionsPromise = client.getAllSessions();
        const [currentSession, allSessions] = await Promise.all([
          currentSessionPromise,
          allSessionsPromise,
        ]);
        setSession(currentSession);
        setAllSessions(allSessions);
      }
    };
    fetchSessions();
  }, [client]);

  useEffect(() => {
    if (client) {
      const interval = setInterval(async () => {
        if (allSessions) {
          for (const sessionKey in allSessions) {
            const session = allSessions[sessionKey];
            if (!session) continue;
            if (session.expiry - Date.now() < 2 * 60 * 1000) {
              callbacks?.beforeSessionExpiry?.({ sessionKey: sessionKey });
            }
          }
        }
      }, 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [client, callbacks]);

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
    return client.logout(params);
  }

  async function loginWithPasskey(params?: {
    sessionType?: SessionType;
    publicKey?: string;
    sessionKey?: string | undefined;
  }): Promise<string> {
    if (!client) {
      throw new Error("Client is not initialized.");
    }
    const res = await client.loginWithPasskey(params);
    if (res) {
      const session = await client.getSession();
      const allSessions = await client.getAllSessions();
      setSession(session);
      setAllSessions(allSessions);
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
    const res = await client.signUpWithPasskey(params);
    if (res) {
      const session = await client.getSession();
      const allSessions = await client.getAllSessions();
      setSession(session);
      setAllSessions(allSessions);
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
    const res = await client.loginWithOtp(params);
    if (res) {
      const session = await client.getSession();
      const allSessions = await client.getAllSessions();
      setSession(session);
      setAllSessions(allSessions);
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
    const res = await client.signUpWithOtp(params);
    if (res) {
      const session = await client.getSession();
      const allSessions = await client.getAllSessions();
      setSession(session);
      setAllSessions(allSessions);
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
    const res = await client.completeOtp(params);
    if (res) {
      const session = await client.getSession();
      const allSessions = await client.getAllSessions();
      setSession(session);
      setAllSessions(allSessions);
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
    const res = await client.completeOauth(params);
    if (res) {
      const session = await client.getSession();
      const allSessions = await client.getAllSessions();
      setSession(session);
      setAllSessions(allSessions);
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
    const res = await client.loginWithOauth(params);
    if (res) {
      const session = await client.getSession();
      const allSessions = await client.getAllSessions();
      setSession(session);
      setAllSessions(allSessions);
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
    const res = await client.signUpWithOauth(params);
    if (res) {
      const session = await client.getSession();
      const allSessions = await client.getAllSessions();
      setSession(session);
      setAllSessions(allSessions);
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
  }): Promise<import("@turnkey/sdk-js").ExportBundle> {
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
  }): Promise<import("@turnkey/sdk-types").TDeleteSubOrganizationResponse> {
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
  }): Promise<import("@turnkey/sdk-types").TCreateSubOrganizationResponse> {
    if (!client) throw new Error("Client is not initialized.");
    return client.createSubOrganization(params);
  }

  async function storeSession(params: {
    sessionToken: string;
    sessionKey?: string | undefined;
  }): Promise<void> {
    if (!client) throw new Error("Client is not initialized.");
    await client.storeSession(params);
    const session = await client.getSession();
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
    return client.clearAllSessions();
  }

  async function refreshSession(params?: {
    sessionType?: SessionType;
    expirationSeconds?: string | undefined;
    publicKey?: string;
    sessionKey?: string | undefined;
    invalidateExisitng?: boolean;
  }): Promise<import("@turnkey/sdk-types").TStampLoginResponse | undefined> {
    if (!client) throw new Error("Client is not initialized.");
    await client.refreshSession(params);
    const session = await client.getSession();
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
    await client.setActiveSession(params);
    const session = await client.getSession();
    setSession(session);
    return;
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
    additionalParameters?: Record<string, string>; // TODO (Amir): Describe what this does in comment header
  }): Promise<void> {
    const {
      clientId = config.auth?.googleClientId,
      openInPage,
      additionalParameters,
    } = params;
    console.log("handleGoogleOauth", {
      clientId,
      openInPage,
      additionalParameters,
    });
    if (!clientId) {
      throw new Error("Google Client ID is not configured.");
    }
    if (!config.auth?.oAuthRedirectUri) {
      throw new Error("OAuth redirect URI is not configured.");
    }

    const width = popupWidth;
    const height = popupHeight;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    const flow = openInPage ? "redirect" : "popup";

    const authWindow = window.open(
      "about:blank",
      "_blank",
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`,
    );

    if (!authWindow) {
      console.error("Failed to open Google login window.");
      return;
    }

    const publicKey = await createApiKeyPair();

    if (!publicKey) {
      throw new Error("Failed to create API key pair.");
    }

    const nonce = bytesToHex(sha256(publicKey));
    const redirectURI = config.auth?.oAuthRedirectUri.replace(/\/$/, "");

    const googleAuthUrl = new URL(GOOGLE_AUTH_URL);
    googleAuthUrl.searchParams.set("client_id", clientId);
    googleAuthUrl.searchParams.set("redirect_uri", redirectURI);
    googleAuthUrl.searchParams.set("response_type", "id_token");
    googleAuthUrl.searchParams.set("scope", "openid email profile");
    googleAuthUrl.searchParams.set("nonce", nonce);
    googleAuthUrl.searchParams.set("prompt", "select_account");
    let state = `provider=google&flow=${flow}`;
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

    authWindow.location.href = googleAuthUrl.toString();

    const interval = setInterval(() => {
      try {
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
                // TODO (Amir): Shall we pass createSubOrgParams here?
              });
            }
          }
        }
      } catch {
        // Ignore cross-origin errors
      }

      if (authWindow.closed) {
        clearInterval(interval);
      }
    }, 500);
  }

  return (
    <ClientContext.Provider
      value={{
        session,
        allSessions,
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
        createApiKeyPair,
        handleGoogleOauth,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
};
