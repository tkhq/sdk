import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import { GOOGLE_AUTH_URL, popupHeight, popupWidth } from "../../utils";
import { TurnkeyClient, TurnkeySDKClientConfig } from "@turnkey/sdk-js";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { TurnkeySDKClientBase } from "@turnkey/sdk-js/dist/__generated__/sdk-client-base";
import { Session } from "@turnkey/sdk-types";
import { ModalProvider, useModal } from "../modal/Provider";
import { TurnkeyProviderConfig } from "../TurnkeyProvider";

interface ClientProviderProps {
  children: ReactNode;
  config: TurnkeyProviderConfig;
}

export interface ClientContextType {
  client: TurnkeyClient | undefined;
  httpClient: TurnkeySDKClientBase | undefined;
  session: Session | undefined;
  handleGoogleOauth: (params: {
    clientId: string;
    onSuccess?: (response: { idToken: string; publicKey: string }) => void;
    setLoading?: (loading: boolean) => void;
    openInPage?: boolean;
  }) => Promise<void>;
}

export const ClientContext = createContext<ClientContextType | undefined>({
  client: undefined,
  httpClient: undefined,
  session: undefined,
  handleGoogleOauth: async () => {
    throw new Error("handleGoogleOauth is not implemented");
  },
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
}) => {
  const [client, setClient] = useState<TurnkeyClient | undefined>(undefined);
  const [session, setSession] = useState<Session | undefined>(undefined);

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

  async function handleGoogleOauth(params: {
    clientId: string;
    onSuccess?: (response: { idToken: string; publicKey: string }) => void;
    openInPage?: boolean;
  }): Promise<void> {
    const {
      clientId,
      onSuccess = (response) => {
        client?.handleOauthLoginOrSignup({
          oidcToken: response.idToken,
          publicKey: response.publicKey,
        });
      },
      openInPage,
    } = params;

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

    const publicKey = await client?.apiKeyStamper?.createKeyPair();
    if (!publicKey) return;
    await client?.apiKeyStamper?.setPublicKeyOverride(publicKey);

    const nonce = bytesToHex(sha256(publicKey));
    const redirectURI = process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI!.replace(
      /\/$/,
      "",
    );

    const googleAuthUrl = new URL(GOOGLE_AUTH_URL);
    googleAuthUrl.searchParams.set("client_id", clientId);
    googleAuthUrl.searchParams.set("redirect_uri", redirectURI);
    googleAuthUrl.searchParams.set("response_type", "id_token");
    googleAuthUrl.searchParams.set("scope", "openid email profile");
    googleAuthUrl.searchParams.set("nonce", nonce);
    googleAuthUrl.searchParams.set("prompt", "select_account");
    googleAuthUrl.searchParams.set("state", `provider=google&flow=${flow}`);

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
            onSuccess({ idToken, publicKey });
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

  const { pushPage } = useModal();

  useEffect(() => {
    pushPage({
      key: "example-modal",
      content: (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            width: "400px",
            height: "600px",
          }}
        >
          <h2>Example Modal</h2>
          <p>This is an example modal content.</p>
          <button
            onClick={() =>
              pushPage({
                key: "nested-modal",
                content: (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      width: "600px",
                      height: "200px",
                    }}
                  >
                    <h2>Good mronign</h2>
                  </div>
                ),
              })
            }
            style={{
              backgroundColor: "lightcoral",
              borderRadius: "8px",
              padding: "8px 16px",
              color: "white",
            }}
          >
            Open Nested Modal
          </button>
        </div>
      ),
    });
  }, []);

  return (
    <ClientContext.Provider
      value={{
        client,
        session,
        httpClient: client?.httpClient,
        handleGoogleOauth,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
};
