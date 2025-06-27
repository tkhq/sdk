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
import { OAuthLoading } from "../../components/auth/OAuth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";

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
    additionalState?: Record<string, string>;
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
          "Public key is missing in the state parameters. You must encode the public key in the state parameter when initiating the OAuth flow."
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
                  await handleOauthLoginOrSignup({
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
          handleOauthLoginOrSignup({
            oidcToken: idToken,
            publicKey,
            // TODO (Amir): Shall we pass createSubOrgParams here?
          });
        }
        window.history.replaceState(
          null,
          document.title,
          window.location.pathname + window.location.search
        );
      }
    }
  }, [client]);

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
      const publicKey = await client?.apiKeyStamper?.createKeyPair();
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
              `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
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
          `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
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
                    handleOauthLoginOrSignup({
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

          // Set a timeout to prevent hanging forever
          setTimeout(() => {
            clearInterval(interval);
            if (!authWindow.closed) {
              authWindow.close();
            }
            reject(new Error("Authentication timed out."));
          }, 300000); // 5 minutes timeout
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
