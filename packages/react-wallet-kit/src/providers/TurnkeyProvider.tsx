import { TurnkeySDKClientConfig } from "@turnkey/sdk-js";
import { ClientProvider } from "./client/Provider";
import { ModalProvider } from "./modal/Provider";
import { ModalRoot } from "./modal/Root";

export interface TurnkeyProviderConfig extends TurnkeySDKClientConfig {
  auth?: {
    googleClientId?: string;
    oAuthRedirectUri?: string;
    openOAuthInPage?: boolean;
  };
}

export interface TurnkeyCallbacks {
  onOauthRedirect?: (response: { idToken: string; publicKey: string }) => void;
  beforeSessionExpiry?: (session: { sessionKey: string }) => void;
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
