import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import { GOOGLE_AUTH_URL, popupHeight, popupWidth } from "../../utils";
import { CreateSubOrgParams, TurnkeyClient } from "@turnkey/sdk-js";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { TurnkeySDKClientBase } from "@turnkey/sdk-js/dist/__generated__/sdk-client-base";
import { Session } from "@turnkey/sdk-types";
import { useModal } from "../modal/Provider";
import { TurnkeyCallbacks, TurnkeyProviderConfig } from "../TurnkeyProvider";
import { AuthComponent } from "../../components/auth";

interface ClientProviderProps {
  children: ReactNode;
  config: TurnkeyProviderConfig;
  callbacks?: TurnkeyCallbacks | undefined;
}

export interface ClientContextType {
  client: TurnkeyClient | undefined;
  httpClient: TurnkeySDKClientBase | undefined;
  session: Session | undefined;
  login: () => Promise<void>;
  handleOauthLoginOrSignup: (params: {
    oidcToken: string;
    publicKey: string;
    createSubOrgParams?: CreateSubOrgParams | undefined;
  }) => Promise<string>;
  handleGoogleOauth: (params: {
    clientId?: string;
    setLoading?: (loading: boolean) => void;
    openInPage?: boolean;
  }) => Promise<void>;
}

export const ClientContext = createContext<ClientContextType | undefined>({
  client: undefined,
  httpClient: undefined,
  session: undefined,
  login: async () => {},
  handleOauthLoginOrSignup: async () => "",
  handleGoogleOauth: async () => {},
});

export const useTurnkey = (): ClientContextType => {
  const context = useContext(ClientContext);
  if (!context)
    throw new Error("useTurnkey must be used within ClientProvider");
  return context;
};

export const ClientProvider: React.FC<ClientProviderProps> = ({
  config,
  children,
  callbacks,
}) => {
  const [client, setClient] = useState<TurnkeyClient | undefined>(undefined);
  const [session, setSession] = useState<Session | undefined>(undefined);
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

  async function handleOauthLoginOrSignup(params: {
    oidcToken: string;
    publicKey: string;
    createSubOrgParams?: CreateSubOrgParams | undefined;
  }) {
    if (!client) {
      throw new Error("Client is not initialized.");
    }
    return client.handleOauthLoginOrSignup(params);
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
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
    );

    if (!authWindow) {
      console.error("Failed to open Google login window.");
      return;
    }

    const publicKey = await client?.apiKeyStamper?.createKeyPair();
    if (!publicKey) return;
    await client?.apiKeyStamper?.setPublicKeyOverride(publicKey);

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
            `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
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
              handleOauthLoginOrSignup({
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

  const login = async () => {
    pushPage({
      key: "Log in or sign up",
      content: <AuthComponent />,
    });
  };

  return (
    <ClientContext.Provider
      value={{
        client,
        session,
        httpClient: client?.httpClient,
        login,
        handleOauthLoginOrSignup,
        handleGoogleOauth,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
};
