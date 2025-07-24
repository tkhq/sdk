import type {
  TurnkeySDKClientBase,
  DefaultParams,
  TurnkeyClientMethods,
  Wallet,
} from "@turnkey/sdk-js";
import type {
  OAuthProviders,
  Session,
  v1AddressFormat,
  v1HashFunction,
  v1PayloadEncoding,
  v1SignRawPayloadResult,
  v1User,
  v1WalletAccount,
  v1WalletAccountParams,
} from "@turnkey/sdk-types";
import type { AuthState, ClientState } from "@utils";
import type { TurnkeyProviderConfig, ExportType } from "../../types/base";
import { createContext } from "react";

export interface ClientContextType extends TurnkeyClientMethods {
  httpClient: TurnkeySDKClientBase | undefined;
  session: Session | undefined;
  allSessions?: Record<string, Session> | undefined;
  clientState: ClientState;
  authState: AuthState;
  config?: TurnkeyProviderConfig | undefined;
  user: v1User | undefined;
  wallets: Wallet[];
  refreshUser: (params?: DefaultParams) => Promise<void>;
  refreshWallets: (params?: DefaultParams) => Promise<void>;
  handleLogin: () => Promise<void>;
  handleGoogleOauth: (params: {
    clientId?: string;
    additionalState?: Record<string, string>;
    openInPage?: boolean;
  }) => Promise<void>;
  handleAppleOauth: (params: {
    clientId?: string;
    additionalState?: Record<string, string>;
    openInPage?: boolean;
  }) => Promise<void>;
  handleFacebookOauth: (params: {
    clientId?: string;
    additionalState?: Record<string, string>;
    openInPage?: boolean;
  }) => Promise<void>;
  handleExport: (
    params: {
      walletId: string;
      exportType: ExportType;
      targetPublicKey?: string;
    } & DefaultParams,
  ) => Promise<void>;
  handleImport: (
    params: {
      defaultWalletAccounts?: v1AddressFormat[] | v1WalletAccountParams[];
      onImportSuccess?: (walletId: string) => void;
      successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
    } & DefaultParams,
  ) => Promise<void>;
  handleUpdateUserEmail: (params?: {
    email?: string;
    title?: string;
    subTitle?: string;
    onSuccess?: (userId: string) => void;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  }) => Promise<void>;
  handleUpdateUserPhoneNumber: (params?: {
    phone?: string;
    formattedPhone?: string;
    title?: string;
    subTitle?: string;
    onSuccess?: (userId: string) => void;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  }) => Promise<void>;
  handleUpdateUserName: (
    params?: {
      userName?: string;
      title?: string;
      subTitle?: string;
      onSuccess?: (userId: string) => void;
      successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
    } & DefaultParams,
  ) => Promise<void>;
  handleAddEmail: (params?: {
    email?: string;
    title?: string;
    subTitle?: string;
    onSuccess?: (userId: string) => void;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  }) => Promise<void>;
  handleAddPhoneNumber: (params?: {
    phoneNumber?: string;
    formattedPhone?: string;
    title?: string;
    subTitle?: string;
    onSuccess?: (userId: string) => void;
    successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  }) => Promise<void>;
  handleAddOAuthProvider: (
    params: {
      providerName: OAuthProviders;
    } & DefaultParams,
  ) => Promise<void>;
  handleRemoveOAuthProvider: (
    params: {
      providerId: string;
      title?: string;
      subTitle?: string;
      onSuccess?: (providerIds: string[]) => void;
      successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
    } & DefaultParams,
  ) => Promise<void>;
  handleAddPasskey: (
    params?: {
      name?: string;
      displayName?: string;
      userId?: string;
      onSuccess?: (authenticatorIds: string[]) => void;
      successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
    } & DefaultParams,
  ) => Promise<void>;
  handleRemovePasskey: (
    params: {
      authenticatorId: string;
      title?: string;
      subTitle?: string;
      onSuccess?: (authenticatorIds: string[]) => void;
      successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
    } & DefaultParams,
  ) => Promise<void>;
  handleSignMessage: (
    params: {
      message: string;
      walletAccount: v1WalletAccount;
      encoding?: v1PayloadEncoding;
      hashFunction?: v1HashFunction;
      subText?: string;
    } & DefaultParams,
  ) => Promise<v1SignRawPayloadResult>;
  handleLinkExternalWallet: (params: {}) => Promise<void>;
}

export const ClientContext = createContext<ClientContextType | undefined>(
  undefined,
);
