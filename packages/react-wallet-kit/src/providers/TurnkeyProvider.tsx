import { CreateSubOrgParams, TurnkeySDKClientConfig } from "@turnkey/sdk-js";
import { ClientProvider } from "./client/Provider";
import { ModalProvider } from "./modal/Provider";
import { ModalRoot } from "./modal/Root";
import { Session, TurnkeyError, TurnkeyNetworkError } from "@turnkey/sdk-types";
import { ThemeOverrides, TurnkeyThemeOverrides } from "./theme/Overrides";

export interface TurnkeyProviderConfig extends TurnkeySDKClientConfig {
  auth?: {
    methods?: {
      emailOtpAuthEnabled?: boolean;
      smsOtpAuthEnabled?: boolean;
      passkeyAuthEnabled?: boolean;
      walletAuthEnabled?: boolean;
      googleOAuthEnabled?: boolean;
      appleOAuthEnabled?: boolean;
      facebookOAuthEnabled?: boolean;
    };
    methodOrder?: Array<"socials" | "email" | "sms" | "passkey" | "wallet">;
    oauthOrder?: Array<"google" | "apple" | "facebook">;
    oAuthConfig?: {
      oAuthRedirectUri?: string;
      googleClientId?: string;
      appleClientId?: string;
      facebookClientId?: string;
      openOAuthInPage?: boolean;
    };
    sessionExpirationSeconds?: {
      passkey?: string;
      wallet?: string;
    };
    createSuborgParams?: {
      email?: CreateSubOrgParams;
      sms?: CreateSubOrgParams;
      passkey?: CreateSubOrgParams;
      wallet?: CreateSubOrgParams;
      oAuth?: CreateSubOrgParams;
    };
    autoRefreshSession?: boolean;
  };
  ui?: {
    darkMode?: boolean;
    colors?: {
      light?: Partial<ThemeOverrides>;
      dark?: Partial<ThemeOverrides>;
    };
    preferLargeActionButtons?: boolean; // If true, this will use full width buttons for actions like "Continue". Otherwise, small icon buttons will be used instead.
    borderRadius?: string | number; // e.g., 8, "1rem"
    backgroundBlur?: string | number; // e.g., 10, "1rem"
  };
  language?: {
    // Ohayō!
  };
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
        <TurnkeyThemeOverrides
          light={config.ui?.colors?.light}
          dark={config.ui?.colors?.dark}
        />
        {children}
        <ModalRoot />
      </ClientProvider>
    </ModalProvider>
  );
}
