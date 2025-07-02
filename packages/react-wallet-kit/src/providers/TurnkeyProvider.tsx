import { TurnkeySDKClientConfig } from "@turnkey/sdk-js";
import { ClientProvider } from "./client/Provider";
import { ModalProvider } from "./modal/Provider";
import { ModalRoot } from "./modal/Root";
import { Session, TurnkeyError, TurnkeyNetworkError } from "@turnkey/sdk-types";

export interface TurnkeyProviderConfig extends TurnkeySDKClientConfig {
  auth?: {
    googleClientId?: string;
    oAuthRedirectUri?: string;
    openOAuthInPage?: boolean;
  };
  autoRefreshSession?: boolean;
}

export interface TurnkeyCallbacks {
  onOauthRedirect?: (response: { idToken: string; publicKey: string }) => void;
  beforeSessionExpiry?: (params: { sessionKey: string }) => void;
  onSessionExpired?: (params: { sessionKey: string }) => void;
  onAuthenticationSuccess?: (params: { session: Session | undefined }) => void;
  onError?: (error: TurnkeyError | TurnkeyNetworkError) => void;
}

export function TurnkeyProvider({
  children,
  config,
  callbacks,
}: {
  children: React.ReactNode;
  config: TurnkeyProviderConfig;
  callbacks?: TurnkeyCallbacks;
}) {
  return (
    <ModalProvider>
      <ClientProvider config={config} callbacks={callbacks}>
        {children}
        <ModalRoot />
      </ClientProvider>
    </ModalProvider>
  );
}
