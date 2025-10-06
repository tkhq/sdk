import type {
    StamperType,
  } from "@turnkey/core";
  
  export type RefreshUserParams = {
    stampWith?: StamperType | undefined;
    organizationId?: string;
    userId?: string;
  };
  
  export type RefreshWalletsParams = {
    stampWith?: StamperType | undefined;
    organizationId?: string;
    userId?: string;
  };
  
  export type HandleDiscordOauthParams = {
    clientId?: string;
    additionalState?: Record<string, string>;
    openInPage?: boolean;
    onOauthSuccess?: (params: { oidcToken: string; providerName: string }) => any;
  };
  
  export type HandleXOauthParams = {
    clientId?: string;
    additionalState?: Record<string, string>;
    openInPage?: boolean;
    onOauthSuccess?: (params: { oidcToken: string; providerName: string }) => any;
  };
  
  export type HandleGoogleOauthParams = {
    clientId?: string;
    additionalState?: Record<string, string>;
    openInPage?: boolean;
    onOauthSuccess?: (params: { oidcToken: string; providerName: string }) => any;
  };
  
  export type HandleAppleOauthParams = {
    clientId?: string;
    additionalState?: Record<string, string>;
    openInPage?: boolean;
    onOauthSuccess?: (params: { oidcToken: string; providerName: string }) => any;
  };
  
  export type HandleFacebookOauthParams = {
    clientId?: string;
    additionalState?: Record<string, string>;
    openInPage?: boolean;
    onOauthSuccess?: (params: { oidcToken: string; providerName: string }) => any;
  };