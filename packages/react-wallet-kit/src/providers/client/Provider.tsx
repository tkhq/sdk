"use client";

import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import {
  buildOAuthUrl,
  capitalizeProviderName,
  cleanupOAuthUrl,
  cleanupOAuthUrlPreserveSearch,
  clearOAuthAddProviderMetadata,
  completeOAuthFlow,
  completeOAuthPopup,
  exchangeFacebookCodeForToken,
  generateChallengePair,
  getOAuthAddProviderMetadata,
  getProviderIcon,
  handlePKCEFlow,
  hasPKCEVerifier,
  OAUTH_INTENT_ADD_PROVIDER,
  openOAuthPopup,
  parseOAuthResponse,
  type PKCEProvider,
  redirectToOAuthProvider,
  storeOAuthAddProviderMetadata,
  storePKCEVerifier,
} from "../../utils/oauth";
import {
  isValidSession,
  mergeWalletsWithoutDuplicates,
  SESSION_WARNING_THRESHOLD_MS,
  useDebouncedCallback,
  useWalletProviderState,
  withTurnkeyErrorHandling,
} from "../../utils/utils";
import {
  type TimerMap,
  clearKey,
  clearAll,
  setCappedTimeoutInMap,
  setTimeoutInMap,
  clearKeys,
} from "../../utils/timers";
import {
  getAuthProxyConfig,
  Chain,
  DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
  OtpType,
  StamperType,
  TurnkeyClient,
  WalletInterfaceType,
  WalletProvider,
  WalletSource,
  type AddOauthProviderParams,
  type AddPasskeyParams,
  type ClearSessionParams,
  type CompleteOauthParams,
  type CompleteOtpParams,
  type CreateApiKeyPairParams,
  type CreatePasskeyParams,
  type CreatePasskeyResult,
  type CreateWalletAccountsParams,
  type CreateWalletParams,
  type DeleteSubOrganizationParams,
  type ExportBundle,
  type ExportPrivateKeyParams,
  type ExportWalletAccountParams,
  type ExportWalletParams,
  type FetchOrCreateP256ApiKeyUserParams,
  type FetchOrCreatePoliciesParams,
  type FetchOrCreatePoliciesResult,
  type FetchPrivateKeysParams,
  type FetchUserParams,
  type FetchWalletAccountsParams,
  type FetchWalletsParams,
  type GetSessionParams,
  type ImportPrivateKeyParams,
  type ImportWalletParams,
  type InitOtpParams,
  type LoginOrSignupWithWalletParams,
  type LoginWithOauthParams,
  type LoginWithOtpParams,
  type LoginWithPasskeyParams,
  type LoginWithWalletParams,
  type LogoutParams,
  type RefreshSessionParams,
  type RemoveOauthProvidersParams,
  type RemovePasskeyParams,
  type RemoveUserEmailParams,
  type RemoveUserPhoneNumberParams,
  type SetActiveSessionParams,
  type EthSendTransactionParams,
  type SignMessageParams,
  type SignTransactionParams,
  type SignUpWithOauthParams,
  type SignUpWithOtpParams,
  type SignUpWithPasskeyParams,
  type SignUpWithWalletParams,
  type StoreSessionParams,
  type SwitchWalletAccountChainParams,
  type UpdateUserEmailParams,
  type UpdateUserNameParams,
  type UpdateUserPhoneNumberParams,
  type VerifyOtpParams,
  type Wallet,
  type WalletAccount,
  type VerifyOtpResult,
  type ConnectedWallet,
  type FetchBootProofForAppProofParams,
  type TurnkeySDKClientBase,
  type CreateHttpClientParams,
  type BuildWalletLoginRequestParams,
  type BuildWalletLoginRequestResult,
  type VerifyAppProofsParams,
  type PollTransactionStatusParams,
  type SignAndSendTransactionParams,
  type EthTransaction,
} from "@turnkey/core";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  TurnkeyError,
  TurnkeyErrorCodes,
  TurnkeyNetworkError,
  OAuthProviders,
  type Session,
  type TDeleteSubOrganizationResponse,
  type TStampLoginResponse,
  type ProxyTGetWalletKitConfigResponse,
  type v1SignRawPayloadResult,
  type v1User,
  type v1PrivateKey,
  type BaseAuthResult,
  type WalletAuthResult,
  AuthAction,
  type PasskeyAuthResult,
  type v1BootProof,
  type v1AppProof,
  FiatOnRampCryptoCurrency,
  FiatOnRampBlockchainNetwork,
  TGetSendTransactionStatusResponse,
} from "@turnkey/sdk-types";
import { useModal } from "../modal/Hook";
import {
  type TurnkeyCallbacks,
  type TurnkeyProviderConfig,
  AuthMethod,
  AuthState,
  ClientState,
  ExportType,
  ImportType,
} from "../../types/base";
import { AuthComponent } from "../../components/auth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ActionPage } from "../../components/auth/Action";
import { SignMessageModal } from "../../components/sign/Message";
import { ExportComponent } from "../../components/export/Export";
import { ImportComponent } from "../../components/import/Import";
import { SuccessPage } from "../../components/design/Success";
import { UpdateEmail } from "../../components/user/UpdateEmail";
import { UpdatePhoneNumber } from "../../components/user/UpdatePhoneNumber";
import { UpdateUserName } from "../../components/user/UpdateUserName";
import { RemoveOAuthProvider } from "../../components/user/RemoveOAuthProvider";
import { RemovePasskey } from "../../components/user/RemovePasskey";
import { ConnectWalletModal } from "../../components/user/ConnectWallet";
import { ClientContext } from "./Types";
import { OtpVerification } from "../../components/auth/OTP";
import { RemoveEmail } from "../../components/user/RemoveEmail";
import { RemovePhoneNumber } from "../../components/user/RemovePhoneNumber";
import type {
  HandleAddEmailParams,
  HandleAddOauthProviderParams,
  HandleAddPasskeyParams,
  HandleAddPhoneNumberParams,
  HandleAppleOauthParams,
  HandleConnectExternalWalletParams,
  HandleDiscordOauthParams,
  HandleExportPrivateKeyParams,
  HandleExportWalletAccountParams,
  HandleExportWalletParams,
  HandleFacebookOauthParams,
  HandleGoogleOauthParams,
  HandleImportPrivateKeyParams,
  HandleImportWalletParams,
  HandleLoginParams,
  HandleOnRampParams,
  HandleRemoveOauthProviderParams,
  HandleRemovePasskeyParams,
  HandleRemoveUserEmailParams,
  HandleRemoveUserPhoneNumberParams,
  HandleSendTransactionParams,
  HandleSignMessageParams,
  HandleUpdateUserEmailParams,
  HandleUpdateUserNameParams,
  HandleUpdateUserPhoneNumberParams,
  HandleVerifyAppProofsParams,
  HandleXOauthParams,
  RefreshUserParams,
  RefreshWalletsParams,
} from "../../types/method-types";
import { VerifyPage } from "../../components/verify/Verify";
import { OnRampPage } from "../../components/onramp/OnRamp";
import { CoinbaseLogo, MoonPayLogo } from "../../components/design/Svg";
import { SendTransactionPage } from "../../components/send-transaction/SendTransaction";
import { getChainLogo } from "../../components/send-transaction/helpers";

/**
 * @inline
 */
interface ClientProviderProps {
  children: ReactNode;
  config: TurnkeyProviderConfig;
  callbacks?: TurnkeyCallbacks | undefined;
}

/**
 * Provides Turnkey client authentication, session management, wallet operations, and user profile management
 * for the React Wallet Kit SDK. This context provider encapsulates all core authentication flows (Passkey, Wallet, OTP, OAuth),
 * session lifecycle (creation, expiration, refresh), wallet connecting/import/export, and user profile updates (email, phone, name).
 *
 * The provider automatically initializes the Turnkey client, fetches configuration (including proxy auth config if needed),
 * and synchronizes session and authentication state. It exposes a comprehensive set of methods for authentication flows,
 * wallet management, and user profile operations, as well as UI handlers for modal-driven flows.
 *
 * Features:
 * - Passkey, Wallet, OTP (Email/SMS), and OAuth (Google, Apple, Facebook, X, Discord) authentication and sign-up flows.
 * - Session management: creation, expiration scheduling, refresh, and clearing.
 * - Wallet management: fetch, connect, import, export, account management.
 * - User profile management: email, phone, name, OAuth provider, and passkey linking/removal.
 * - Modal-driven UI flows for authentication, wallet connecting, and profile updates.
 * - Error handling and callback integration for custom error and event responses.
 *
 * Usage:
 * Wrap your application with `TurnkeyProvider` to enable authentication and wallet features via context.
 *
 * @param config - The Turnkey provider configuration object.
 * @param children - React children to be rendered within the provider.
 * @param callbacks - Optional callbacks for error handling and session events.
 *
 * @returns A React context provider exposing authentication, wallet, and user management methods and state.
 */
export const ClientProvider: React.FC<ClientProviderProps> = ({
  config,
  children,
  callbacks,
}) => {
  const [client, setClient] = useState<TurnkeyClient | undefined>(undefined);
  const [session, setSession] = useState<Session | undefined>(undefined);
  const [masterConfig, setMasterConfig] = useState<
    TurnkeyProviderConfig | undefined
  >(undefined);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [user, setUser] = useState<v1User | undefined>(undefined);
  const [clientState, setClientState] = useState<ClientState>();
  const [authState, setAuthState] = useState<AuthState>(
    AuthState.Unauthenticated,
  );

  // if there is no authProxyConfigId or if autoFetchWalletKitConfig is specifically
  // set to false, we don't need to fetch the config
  const shouldFetchWalletKitConfig =
    !!config.authProxyConfigId && (config.autoFetchWalletKitConfig ?? true);

  // we use this custom hook to only update the state if the value is different
  // this is so our useEffect that calls `initializeWalletProviderListeners()` only runs when it needs to
  const [walletProviders, setWalletProviders] = useWalletProviderState();

  const expiryTimeoutsRef = useRef<TimerMap>({});
  const proxyAuthConfigRef = useRef<ProxyTGetWalletKitConfigResponse | null>(
    null,
  );

  const [allSessions, setAllSessions] = useState<
    Record<string, Session> | undefined
  >(undefined);
  const { isMobile, pushPage, popPage, closeModal } = useModal();

  const completeRedirectOauth = async () => {
    // Check for either hash or search parameters that could indicate an OAuth redirect
    if (!window.location.hash && !window.location.search) {
      // No OAuth redirect parameters found, nothing to do
      return;
    }

    /**
     * Wraps an OAuth completion action with optional modal UI.
     * This is the key difference between redirect and popup flows:
     * - Popup: No modal needed (the popup window itself is the UI)
     * - Redirect: Optional modal to show loading/success states on return
     */
    const withModalWrapper = async (params: {
      provider: string;
      isAddProvider: boolean;
      metadata: ReturnType<typeof getOAuthAddProviderMetadata>;
      openModal?: string | null | undefined;
      action: () => Promise<void>;
    }) => {
      const { provider, isAddProvider, metadata, openModal, action } = params;
      const providerDisplayName = capitalizeProviderName(provider);
      const icon = getProviderIcon(provider);

      if (openModal === "true") {
        // Show modal UI for the completion
        await new Promise<void>((resolve, reject) => {
          pushPage({
            key: `${providerDisplayName} OAuth`,
            content: (
              <ActionPage
                closeOnComplete={isAddProvider ? false : true} // Don't close automatically if adding provider, we show the success screen
                title={
                  isAddProvider
                    ? `Adding ${providerDisplayName} provider...`
                    : `Authenticating with ${providerDisplayName}...`
                }
                action={async () => {
                  try {
                    await action();
                    if (isAddProvider && metadata) {
                      // Don't show success for auth. Not needed
                      pushPage({
                        key: "OAuth Provider Added",
                        content: (
                          <SuccessPage
                            text={`Successfully added ${providerDisplayName} OAuth provider!`}
                            duration={metadata.successPageDuration ?? 2000}
                            onComplete={() => {
                              closeModal();
                            }}
                          />
                        ),
                        preventBack: true,
                        showTitle: false,
                      });
                    }
                    resolve();
                  } catch (err) {
                    if (isAddProvider) {
                      clearOAuthAddProviderMetadata();
                    }
                    reject(err);
                    popPage();
                  }
                }}
                icon={<FontAwesomeIcon icon={icon} size="3x" />}
              />
            ),
            showTitle: false,
            onClose: () => {
              if (isAddProvider) {
                clearOAuthAddProviderMetadata();
              }
              reject(
                new TurnkeyError(
                  isAddProvider
                    ? `User canceled the ${providerDisplayName} add provider process.`
                    : `User canceled the ${providerDisplayName} authentication process.`,
                  TurnkeyErrorCodes.USER_CANCELED,
                ),
              );
            },
          });
        });
      } else {
        // No modal - execute directly
        try {
          await action();
        } catch (err) {
          if (isAddProvider) {
            clearOAuthAddProviderMetadata();
          }
          throw err;
        }
      }
    };

    // Handle PKCE-based OAuth redirects (Facebook, Discord, X) with code in search parameters
    if (
      window.location.search &&
      window.location.search.includes("code=") &&
      window.location.search.includes("state=")
    ) {
      // Parse the URL using our unified helper
      const result = parseOAuthResponse(window.location.href);

      if (!result || !result.authCode || !result.publicKey) {
        return;
      }

      if (result.flow !== "redirect") {
        // To complete OAuth we need redirect flow
        return;
      }

      const {
        authCode: code,
        provider,
        publicKey,
        oauthIntent,
        sessionKey,
        nonce,
        openModal,
      } = result;

      const isAddProvider = oauthIntent === OAUTH_INTENT_ADD_PROVIDER;
      const metadata = isAddProvider ? getOAuthAddProviderMetadata() : null;

      /**
       * Helper to complete PKCE redirect flow with optional modal wrapper.
       * Uses handlePKCEFlow from oauth utils for the core logic.
       * We put this in a separate function to avoid duplicating for each provider.
       */
      const completePKCERedirect = async (
        providerName: PKCEProvider,
        exchangeCodeFn: (codeVerifier: string) => Promise<string>,
      ) => {
        const action = async () => {
          try {
            await handlePKCEFlow({
              publicKey,
              providerName,
              sessionKey: sessionKey ?? undefined,
              callbacks,
              completeOauth,
              onAddProvider:
                // Only set onAddProvider if we are adding a provider and have metadata
                isAddProvider && metadata
                  ? async (oidcToken: string) => {
                      await addOauthProvider({
                        providerName: provider!,
                        oidcToken,
                        organizationId: metadata.organizationId,
                        userId: metadata.userId,
                        ...(metadata.stampWith && {
                          stampWith: metadata.stampWith as StamperType,
                        }),
                      });
                      clearOAuthAddProviderMetadata();
                    }
                  : undefined,
              exchangeCodeForToken: exchangeCodeFn,
            });
          } catch (err) {
            if (callbacks?.onError) {
              const providerDisplayName = capitalizeProviderName(providerName);
              callbacks.onError(
                err instanceof TurnkeyError
                  ? err
                  : new TurnkeyError(
                      `${providerDisplayName} authentication failed`,
                      TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
                      err,
                    ),
              );
            }
            throw err;
          }
        };

        await withModalWrapper({
          provider: providerName,
          isAddProvider,
          metadata,
          openModal,
          action,
        });

        // Clean up URL after successful completion
        cleanupOAuthUrl();
      };

      // FACEBOOK
      if (provider === OAuthProviders.FACEBOOK) {
        const clientId = masterConfig?.auth?.oauthConfig?.facebookClientId;
        const redirectURI = masterConfig?.auth?.oauthConfig?.oauthRedirectUri;
        const hasVerifier = hasPKCEVerifier(OAuthProviders.FACEBOOK);

        if (clientId && redirectURI && hasVerifier) {
          await completePKCERedirect(
            OAuthProviders.FACEBOOK,
            async (codeVerifier) => {
              const tokenResponse = await exchangeFacebookCodeForToken(
                clientId,
                redirectURI,
                code,
                codeVerifier,
              );
              const oidcToken = tokenResponse?.id_token;
              if (!oidcToken) {
                throw new TurnkeyError(
                  "Missing OIDC token",
                  TurnkeyErrorCodes.OAUTH_LOGIN_ERROR,
                );
              }
              return oidcToken;
            },
          );
        }
        return;
      }

      // DISCORD
      if (provider === OAuthProviders.DISCORD) {
        const clientId = masterConfig?.auth?.oauthConfig?.discordClientId;
        const redirectURI = masterConfig?.auth?.oauthConfig?.oauthRedirectUri;
        const hasVerifier = hasPKCEVerifier(OAuthProviders.DISCORD);

        if (clientId && redirectURI && hasVerifier && nonce) {
          await completePKCERedirect(
            OAuthProviders.DISCORD,
            async (codeVerifier) => {
              const resp = await client?.httpClient.proxyOAuth2Authenticate({
                provider: "OAUTH2_PROVIDER_DISCORD",
                authCode: code,
                redirectUri: redirectURI,
                codeVerifier,
                clientId,
                nonce,
              });
              const oidcToken = resp?.oidcToken;
              if (!oidcToken) {
                throw new TurnkeyError(
                  "Missing OIDC token",
                  TurnkeyErrorCodes.OAUTH_LOGIN_ERROR,
                );
              }
              return oidcToken;
            },
          );
        }
        return;
      }

      // X (Twitter)
      if (provider === OAuthProviders.X) {
        const clientId = masterConfig?.auth?.oauthConfig?.xClientId;
        const redirectURI = masterConfig?.auth?.oauthConfig?.oauthRedirectUri;
        const hasVerifier = hasPKCEVerifier(OAuthProviders.X);

        if (clientId && redirectURI && hasVerifier && nonce) {
          await completePKCERedirect(OAuthProviders.X, async (codeVerifier) => {
            const resp = await client?.httpClient.proxyOAuth2Authenticate({
              provider: "OAUTH2_PROVIDER_X",
              authCode: code,
              redirectUri: redirectURI,
              codeVerifier,
              clientId,
              nonce,
            });
            const oidcToken = resp?.oidcToken;
            if (!oidcToken) {
              throw new TurnkeyError(
                "Missing OIDC token",
                TurnkeyErrorCodes.OAUTH_LOGIN_ERROR,
              );
            }
            return oidcToken;
          });
        }
        return;
      }
    }

    // Handle Google/Apple redirects (uses hash with idToken - non-PKCE)
    if (window.location.hash) {
      // Parse the URL using our unified helper
      const result = parseOAuthResponse(window.location.href);

      if (
        !result ||
        !result.idToken ||
        result.flow !== "redirect" ||
        !result.publicKey
      ) {
        // idToken and publicKey are required to complete OAuth. These are both in the hash for non-PKCE providers
        return;
      }

      const {
        idToken,
        provider,
        publicKey,
        openModal,
        sessionKey,
        oauthIntent,
      } = result;

      const isAddProvider = oauthIntent === OAUTH_INTENT_ADD_PROVIDER;
      const metadata = isAddProvider ? getOAuthAddProviderMetadata() : null;
      const resolvedProvider = provider || OAuthProviders.GOOGLE;

      // Use completeOAuthFlow from utils for the core completion logic
      const action = async () => {
        await completeOAuthFlow({
          provider: resolvedProvider as OAuthProviders,
          publicKey,
          oidcToken: idToken,
          sessionKey: sessionKey ?? undefined,
          callbacks,
          completeOauth,
          onAddProvider:
            isAddProvider && metadata
              ? async (oidcToken) => {
                  await addOauthProvider({
                    providerName: resolvedProvider,
                    oidcToken,
                    organizationId: metadata.organizationId,
                    userId: metadata.userId,
                    ...(metadata.stampWith && {
                      stampWith: metadata.stampWith as StamperType,
                    }),
                  });
                  clearOAuthAddProviderMetadata();
                }
              : undefined,
        });
      };

      await withModalWrapper({
        provider: resolvedProvider,
        isAddProvider,
        metadata,
        openModal: openModal ?? undefined,
        action,
      });

      // Clean up the URL after processing
      cleanupOAuthUrlPreserveSearch();
    }
  };

  const buildConfig = (
    proxyAuthConfig?: ProxyTGetWalletKitConfigResponse | undefined,
  ) => {
    // Juggle the local overrides with the values set in the dashboard (proxyAuthConfig).
    const resolvedMethods = {
      emailOtpAuthEnabled:
        config.auth?.methods?.emailOtpAuthEnabled ??
        proxyAuthConfig?.enabledProviders.includes("email"),
      smsOtpAuthEnabled:
        config.auth?.methods?.smsOtpAuthEnabled ??
        proxyAuthConfig?.enabledProviders.includes("sms"),
      passkeyAuthEnabled:
        config.auth?.methods?.passkeyAuthEnabled ??
        proxyAuthConfig?.enabledProviders.includes("passkey"),
      walletAuthEnabled:
        config.auth?.methods?.walletAuthEnabled ??
        proxyAuthConfig?.enabledProviders.includes("wallet"),
      googleOauthEnabled:
        config.auth?.methods?.googleOauthEnabled ??
        proxyAuthConfig?.enabledProviders.includes("google"),
      xOauthEnabled:
        config.auth?.methods?.xOauthEnabled ??
        proxyAuthConfig?.enabledProviders.includes("x"),
      discordOauthEnabled:
        config.auth?.methods?.discordOauthEnabled ??
        proxyAuthConfig?.enabledProviders.includes("discord"),
      appleOauthEnabled:
        config.auth?.methods?.appleOauthEnabled ??
        proxyAuthConfig?.enabledProviders.includes("apple"),
      facebookOauthEnabled:
        config.auth?.methods?.facebookOauthEnabled ??
        proxyAuthConfig?.enabledProviders.includes("facebook"),
    };

    const resolvedClientIds = {
      googleClientId:
        config.auth?.oauthConfig?.googleClientId ??
        proxyAuthConfig?.oauthClientIds?.google,
      appleClientId:
        config.auth?.oauthConfig?.appleClientId ??
        proxyAuthConfig?.oauthClientIds?.apple,
      facebookClientId:
        config.auth?.oauthConfig?.facebookClientId ??
        proxyAuthConfig?.oauthClientIds?.facebook,
      xClientId:
        config.auth?.oauthConfig?.xClientId ??
        proxyAuthConfig?.oauthClientIds?.x,
      discordClientId:
        config.auth?.oauthConfig?.discordClientId ??
        proxyAuthConfig?.oauthClientIds?.discord,
    };

    const redirectUrl =
      config.auth?.oauthConfig?.oauthRedirectUri ??
      proxyAuthConfig?.oauthRedirectUrl;

    // Set a default ordering for the oAuth methods
    const oauthOrder =
      config.auth?.oauthOrder ??
      (["google", "apple", "x", "discord", "facebook"] as const).filter(
        (provider) => resolvedMethods[`${provider}OauthEnabled` as const],
      );

    // Set a default ordering for the overall auth methods
    const methodOrder =
      config.auth?.methodOrder ??
      ([
        oauthOrder.length > 0 ? "socials" : null,
        resolvedMethods.emailOtpAuthEnabled ? "email" : null,
        resolvedMethods.smsOtpAuthEnabled ? "sms" : null,
        resolvedMethods.passkeyAuthEnabled ? "passkey" : null,
        resolvedMethods.walletAuthEnabled ? "wallet" : null,
      ].filter(Boolean) as Array<
        "socials" | "email" | "sms" | "passkey" | "wallet"
      >);

    // Warn if they are trying to set auth proxy only settings directly

    if (proxyAuthConfig) {
      if (config.auth?.sessionExpirationSeconds) {
        console.warn(
          "Turnkey SDK warning. You have set sessionExpirationSeconds directly in the TurnkeyProvider. This setting will be ignored because you are using an auth proxy. Please configure session expiration in the Turnkey dashboard.",
        );
      }
      if (config.auth?.otpAlphanumeric !== undefined) {
        console.warn(
          "Turnkey SDK warning. You have set otpAlphanumeric directly in the TurnkeyProvider. This setting will be ignored because you are using an auth proxy. Please configure OTP settings in the Turnkey dashboard.",
        );
      }
      if (config.auth?.otpLength) {
        console.warn(
          "Turnkey SDK warning. You have set otpLength directly in the TurnkeyProvider. This setting will be ignored because you are using an auth proxy. Please configure OTP settings in the Turnkey dashboard.",
        );
      }
    }

    // These are settings that, if using the auth proxy, must be set in the dashboard. They override any local settings unless they are not using auth proxy or are not fetching the auth proxy config.
    const authProxyPrioSettings = {
      sessionExpirationSeconds:
        proxyAuthConfig?.sessionExpirationSeconds ??
        config.auth?.sessionExpirationSeconds,
      otpAlphanumeric:
        proxyAuthConfig?.otpAlphanumeric ??
        config.auth?.otpAlphanumeric ??
        true,
      otpLength: proxyAuthConfig?.otpLength ?? config.auth?.otpLength ?? "6",
    };

    return {
      ...config,

      // Overrides:
      auth: {
        ...config.auth,
        ...authProxyPrioSettings,
        methods: resolvedMethods,
        oauthConfig: {
          ...config.auth?.oauthConfig,
          ...resolvedClientIds,
          oauthRedirectUri: redirectUrl,

          // on mobile we default to true since many mobile browsers
          // (e.g. Safari) block popups
          openOauthInPage: isMobile
            ? true
            : config.auth?.oauthConfig?.openOauthInPage,
        },
        methodOrder,
        oauthOrder,
        autoRefreshSession: config.auth?.autoRefreshSession ?? true,
      },
      autoRefreshManagedState: config.autoRefreshManagedState ?? true,
      walletConfig: {
        ...config.walletConfig,
        features: {
          ...config.walletConfig?.features,
          auth:
            // If walletAuthEnabled is not set, default to true. Wallet auth can be enabled/disabled in the dashboard or by explicitly changing the walletAuthEnabled / walletConfig auth feature.
            resolvedMethods.walletAuthEnabled ??
            config.walletConfig?.features?.auth ??
            true,
          connecting: config.walletConfig?.features?.connecting ?? true, // Default connecting to true if not set. We don't care about auth settings here.
        },
        chains: {
          ...config.walletConfig?.chains,
          ethereum: {
            ...config.walletConfig?.chains?.ethereum,
            // keep user's value if provided; default only when undefined
            native: config.walletConfig?.chains?.ethereum?.native ?? true,
          },
          solana: {
            ...config.walletConfig?.chains?.solana,
            // keep user's value if provided; default only when undefined
            native: config.walletConfig?.chains?.solana?.native ?? true,
          },
        },
      },
      importIframeUrl: config.importIframeUrl ?? "https://import.turnkey.com",
      exportIframeUrl: config.exportIframeUrl ?? "https://export.turnkey.com",
    } as TurnkeyProviderConfig;
  };

  /**
   * Initializes the Turnkey client with the provided configuration.
   * This function sets up the client, fetches the proxy auth config if needed,
   * and prepares the client for use in authentication and wallet operations.
   *
   * @internal
   */
  const initializeClient = async () => {
    if (!masterConfig || client || clientState == ClientState.Loading) return;

    try {
      setClientState(ClientState.Loading);
      const turnkeyClient = new TurnkeyClient({
        apiBaseUrl: masterConfig.apiBaseUrl,
        authProxyUrl: masterConfig.authProxyUrl,
        authProxyConfigId: masterConfig.authProxyConfigId,
        organizationId: masterConfig.organizationId,

        // Define passkey and wallet config here. If we don't pass it into the client, Mr. Client will assume that we don't want to use passkeys/wallets and not create the stamper!
        passkeyConfig: {
          rpId: masterConfig.passkeyConfig?.rpId,
          timeout: masterConfig.passkeyConfig?.timeout || 60000, // 60 seconds
          userVerification:
            masterConfig.passkeyConfig?.userVerification || "preferred",
          allowCredentials: masterConfig.passkeyConfig?.allowCredentials || [],
        },
        walletConfig: {
          features: {
            ...masterConfig.walletConfig?.features,
          },
          chains: { ...masterConfig.walletConfig?.chains },
          ...(masterConfig.walletConfig?.walletConnect && {
            walletConnect: masterConfig.walletConfig.walletConnect,
          }),
        },
        defaultStamperType: masterConfig.defaultStamperType,
      });

      await turnkeyClient.init();
      setClient(turnkeyClient);

      // Don't set clientState to ready until we fetch the proxy auth config (See other fetchProxyAuthConfig useEffect)
    } catch (error) {
      setClientState(ClientState.Error);
      if (
        error instanceof TurnkeyError ||
        error instanceof TurnkeyNetworkError
      ) {
        callbacks?.onError?.(error);
      } else {
        callbacks?.onError?.(
          new TurnkeyError(
            `Failed to initialize Turnkey client`,
            TurnkeyErrorCodes.INITIALIZE_CLIENT_ERROR,
            error,
          ),
        );
      }
    }
  };

  /**
   * Initializes the user sessions by fetching all active sessions and setting up their state.
   * @internal
   */
  const initializeSessions = async () => {
    setSession(undefined);
    setAllSessions(undefined);
    try {
      const allLocalStorageSessions = await getAllSessions();
      if (!allLocalStorageSessions) return;

      await Promise.all(
        Object.keys(allLocalStorageSessions).map(async (sessionKey) => {
          const session = allLocalStorageSessions?.[sessionKey];
          if (!isValidSession(session)) {
            await clearSession({ sessionKey });
            if (sessionKey === (await getActiveSessionKey())) {
              setSession(undefined);
            }
            delete allLocalStorageSessions[sessionKey];
            return;
          }

          scheduleSessionExpiration({
            sessionKey,
            expiry: session!.expiry,
          });
        }),
      );

      setAllSessions(allLocalStorageSessions || undefined);
      const activeSessionKey = await client?.getActiveSessionKey();
      if (activeSessionKey) {
        // If we have an active session key, set
        if (!allLocalStorageSessions[activeSessionKey]) {
          return;
        }
        setSession(allLocalStorageSessions[activeSessionKey]);

        // we use `maybeFetchWallets()` instead of `maybeRefreshWallets()` here to avoid a race condition
        // specifically, if WalletConnect finishes initializing before this promise resolves,
        // `maybeRefreshWallets()` could overwrite the WalletConnect wallet state with an outdated
        // list of wallets that doesn’t yet include the WalletConnect wallets
        const [, wallets] = await Promise.all([
          maybeRefreshUser(),
          (() => {
            if (!masterConfig?.autoRefreshManagedState) return [];
            return fetchWallets();
          })(),
        ]);

        // the prev wallets should only ever be WalletConnect wallets
        if (wallets) {
          setWallets((prev) => mergeWalletsWithoutDuplicates(prev, wallets));
        }

        return;
      }
    } catch (error) {
      if (
        error instanceof TurnkeyError ||
        error instanceof TurnkeyNetworkError
      ) {
        callbacks?.onError?.(error);
      } else {
        callbacks?.onError?.(
          new TurnkeyError(
            `Failed to initialize sessions`,
            TurnkeyErrorCodes.INITIALIZE_SESSION_ERROR,
            error,
          ),
        );
      }
    }
  };

  /**
   * @internal
   * Attach listeners for connected wallet providers so we can refresh state on changes.
   *
   * - Ethereum: listens for disconnect and chain/account changes to trigger a refresh.
   * - Solana: listens for disconnect via Wallet Standard `change` events to trigger a refresh.
   * - WalletConnect:
   *    - listens for disconnect and other state changes via its unified `change` event
   *    - additionally listens for `pairingExpired` events (proposal expiration), in which
   *      case we re-fetch providers to refresh the pairing URI for the UI.
   *
   * Notes:
   * - Only connected providers are bound, except WalletConnect which must always register
   *   to handle proposal expiration even if no active session exists.
   * - Since all WalletConnect providers share the same session, we only attach to one.
   *
   * @param walletProviders - Discovered providers; only connected ones are bound.
   * @param onUpdateState - Invoked when a relevant provider event occurs.
   * @returns Cleanup function that removes all listeners registered by this call.
   */
  async function initializeWalletProviderListeners(
    walletProviders: WalletProvider[],
    onUpdateState: () => Promise<void>,
  ): Promise<() => void> {
    if (walletProviders.length === 0) return () => {};

    const cleanups: Array<() => void> = [];

    // we only want to initialize these listeners for connected walletProviders
    const nativeOnly = (provider: WalletProvider) =>
      provider.interfaceType !== WalletInterfaceType.WalletConnect;

    const ethProviders = masterConfig?.walletConfig?.chains.ethereum?.native
      ? walletProviders.filter(
          (provider) =>
            provider.chainInfo.namespace === Chain.Ethereum &&
            nativeOnly(provider) &&
            provider.connectedAddresses.length > 0,
        )
      : [];

    const solProviders = masterConfig?.walletConfig?.chains.solana?.native
      ? walletProviders.filter(
          (provider) =>
            provider.chainInfo.namespace === Chain.Solana &&
            nativeOnly(provider) &&
            provider.connectedAddresses.length > 0,
        )
      : [];

    // WalletConnect is excluded from native event wiring. Instead,
    // it uses a unified `change` event exposed by our custom wrapper
    //
    // unlike native providers, we register listeners for WalletConnect
    // even if it’s not currently “connected”. This is required so we
    // can detect proposal expiration events and display the new regenerated
    // URI for the UI
    const wcProviders = walletProviders.filter(
      (p) => p.interfaceType === WalletInterfaceType.WalletConnect,
    );

    // since all WalletConnect providers share the same underlying session
    // and emit identical events, we only attach listeners to a single provider
    const wcProvider = wcProviders.find(
      (p) => p.interfaceType === WalletInterfaceType.WalletConnect,
    );

    function attachEthereumListeners(
      provider: any,
      onUpdateState: () => Promise<void>,
    ) {
      if (typeof provider.on !== "function") return;

      const handleChainChanged = async (_chainId: string) => onUpdateState();
      const handleAccountsChanged = async (accounts: string[]) => {
        if (accounts.length === 0) onUpdateState();
      };
      const handleDisconnect = () => onUpdateState();

      provider.on("chainChanged", handleChainChanged);
      provider.on("accountsChanged", handleAccountsChanged);
      provider.on("disconnect", handleDisconnect);

      return () => {
        provider.removeListener("chainChanged", handleChainChanged);
        provider.removeListener("accountsChanged", handleAccountsChanged);
        provider.removeListener("disconnect", handleDisconnect);
      };
    }

    function attachSolanaListeners(
      provider: any,
      onUpdateState: () => Promise<void>,
    ) {
      const cleanups: Array<() => void> = [];

      const walletEvents = provider?.features?.["standard:events"];
      if (walletEvents?.on) {
        const offChange = walletEvents.on("change", async (_evt: any) => {
          await onUpdateState();
        });
        cleanups.push(offChange);
      }

      return () => cleanups.forEach((fn) => fn());
    }

    ethProviders.forEach((p) => {
      const cleanup = attachEthereumListeners(
        (p as any).provider,
        onUpdateState,
      );
      if (cleanup) cleanups.push(cleanup);
    });

    solProviders.forEach((p) => {
      const cleanup = attachSolanaListeners((p as any).provider, onUpdateState);
      if (cleanup) cleanups.push(cleanup);
    });

    if (wcProvider) {
      const standardEvents = (wcProvider.provider as any)?.features?.[
        "standard:events"
      ];
      if (standardEvents?.on) {
        if (standardEvents?.on) {
          const unsubscribe = standardEvents.on("change", async (evt: any) => {
            // if the event is a proposalExpired, we want to re-fetch the providers
            // to refresh the uri, there is no need to refresh the wallets state
            if (evt?.type === "pairingExpired") {
              debouncedFetchWalletProviders();
              return;
            }

            // if WalletConnect initialization failed, refresh providers
            // (the failed provider will be removed from the list)
            if (evt?.type === "failed") {
              debouncedFetchWalletProviders();
              callbacks?.onError?.(
                new TurnkeyError(
                  `WalletConnect initialization failed: ${evt.error || "Unknown error"}`,
                  TurnkeyErrorCodes.WALLET_CONNECT_INITIALIZATION_ERROR,
                  evt.error,
                ),
              );

              return;
            }

            if (evt?.type === "initialized") {
              // this updates our walletProvider state
              const providers = await debouncedFetchWalletProviders();

              // if we have an active session, we need to restore any possibly connected
              // WalletConnect wallets since its now initialized
              const currentSession = await getSession();
              if (currentSession) {
                const wcProviders = providers?.filter(
                  (p) => p.interfaceType === WalletInterfaceType.WalletConnect,
                );

                const wcWallets = await fetchWallets({
                  walletProviders: wcProviders,
                  connectedOnly: true,
                });

                if (wcWallets.length > 0) {
                  setWallets((prev) =>
                    mergeWalletsWithoutDuplicates(prev, wcWallets),
                  );
                }
              }

              return;
            }

            // any other event (disconnect, chain switch, accounts changed)
            // we refresh the wallets state
            await onUpdateState();
          });
          cleanups.push(unsubscribe);
        }
      }
    }

    return () => {
      cleanups.forEach((remove) => remove());
    };
  }

  /**
   * Clears all scheduled session timers (warning + expiry).
   *
   * - Removes all active timers managed by this client.
   * - Useful on re-init or logout to avoid stale timers.
   *
   * @throws {TurnkeyError} If an error occurs while clearing the timers.
   */
  function clearSessionTimeouts(sessionKeys?: string[]) {
    try {
      if (sessionKeys) {
        clearKeys(expiryTimeoutsRef.current, sessionKeys);
      } else {
        clearAll(expiryTimeoutsRef.current); // clears & deletes everything
      }
    } catch (error) {
      if (
        error instanceof TurnkeyError ||
        error instanceof TurnkeyNetworkError
      ) {
        callbacks?.onError?.(error);
      } else {
        callbacks?.onError?.(
          new TurnkeyError(
            "Failed to clear session timeouts",
            TurnkeyErrorCodes.CLEAR_SESSION_TIMEOUTS_ERROR,
            error,
          ),
        );
      }
    }
  }

  /**
   * @internal
   * Handles the post-authentication flow.
   *
   * - This function is called after a successful authentication (login or sign-up) via any supported method (Passkey, Wallet, OTP, OAuth).
   * - It fetches the active session and all sessions, updates the session state, and schedules session expiration and warning timeouts.
   * - It also refreshes the user's wallets and profile information to ensure the provider state is up to date.
   * - This function is used internally after all authentication flows to synchronize state and trigger any necessary callbacks.
   *
   * @returns A void promise.
   * @throws {TurnkeyError} If the client is not initialized or if there is an error during the process.
   */
  const handlePostAuth = async (params: {
    method: AuthMethod;
    action: AuthAction;
    identifier: string;
    appProofs?: v1AppProof[] | undefined;
  }) => {
    const { method, action, identifier, appProofs } = params;
    try {
      const sessionKey = await getActiveSessionKey();
      const session = await getSession({
        ...(sessionKey && { sessionKey }),
      });

      if (session && sessionKey)
        await scheduleSessionExpiration({
          sessionKey,
          expiry: session.expiry,
        });

      const allSessions = await client!.getAllSessions();

      setSession(session);
      setAllSessions(allSessions);

      await Promise.all([maybeRefreshWallets(), maybeRefreshUser()]);

      if (
        masterConfig?.auth?.verifyWalletOnSignup === true &&
        appProofs &&
        appProofs.length > 0 &&
        action === AuthAction.SIGNUP
      ) {
        // On signup, if we have appProofs, verify them
        await handleVerifyAppProofs({ appProofs });
      }

      callbacks?.onAuthenticationSuccess?.({
        session,
        method,
        action,
        identifier,
      });
    } catch (error) {
      if (
        error instanceof TurnkeyError ||
        error instanceof TurnkeyNetworkError
      ) {
        callbacks?.onError?.(error);
      } else {
        callbacks?.onError?.(
          new TurnkeyError(
            `Failed to handle post-authentication`,
            TurnkeyErrorCodes.HANDLE_POST_AUTH_ERROR,
            error,
          ),
        );
      }
    }
  };

  /**
   * @internal
   * Handles the post-logout flow.
   *
   * - This function is called after a successful logout or session clear.
   * - It clears all scheduled session expiration and warning timeouts associated to the session key to prevent memory leaks.
   * - It resets the session state, removes user data from memory, the logged out session from all sessions state, and clears the wallets list.
   * - This ensures that all sensitive information is removed from the provider state after logout.
   * - Called internally after logout or when all sessions are cleared.
   *
   * @returns void
   * @throws {TurnkeyError} If there is an error during the post-logout process.
   */
  const handlePostLogout = (sessionKey?: string) => {
    try {
      clearSessionTimeouts(
        sessionKey ? [sessionKey, `${sessionKey}-warning`] : undefined,
      );
      setAllSessions((prev) => {
        if (!prev) return prev;
        if (sessionKey) {
          const next = { ...prev };
          delete next[sessionKey];
          return next;
        }
        return {};
      });
      setSession(undefined);
      setUser(undefined);
      setWallets([]);
    } catch (error) {
      callbacks?.onError?.(
        new TurnkeyError(
          `Failed to initialize sessions`,
          TurnkeyErrorCodes.HANDLE_POST_LOGOUT_ERROR,
          error,
        ),
      );
    }
  };

  const createHttpClient = useCallback(
    (params?: CreateHttpClientParams): TurnkeySDKClientBase => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      return client.createHttpClient(params);
    },
    [client],
  );

  const getActiveSessionKey = useCallback(async (): Promise<
    string | undefined
  > => {
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    return withTurnkeyErrorHandling(
      () => client.getActiveSessionKey(),
      undefined,
      callbacks,
      "Failed to get active session key",
    );
  }, [client, callbacks]);

  const logout: (params?: LogoutParams) => Promise<void> = useCallback(
    async (params?: { sessionKey?: string }): Promise<void> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      await withTurnkeyErrorHandling(
        async () => {
          // If no sessionKey is provided, we try to get the active one.
          let sessionKey = params?.sessionKey;
          if (!sessionKey) sessionKey = await getActiveSessionKey();
          await client.logout(params);
          // We only handle post logout if the sessionKey is defined since that means we actually logged out of a session.
          if (sessionKey) handlePostLogout(sessionKey);
        },
        undefined,
        callbacks,
        "Failed to logout",
      );

      return;
    },
    [client, callbacks, getActiveSessionKey],
  );

  const getSession = useCallback(
    async (params?: GetSessionParams): Promise<Session | undefined> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.getSession(params),
        undefined,
        callbacks,
        "Failed to get session",
      );
    },
    [client, callbacks],
  );

  const getAllSessions = useCallback(async (): Promise<
    Record<string, Session> | undefined
  > => {
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    return withTurnkeyErrorHandling(
      () => client.getAllSessions(),
      undefined,
      callbacks,
      "Failed to get all sessions",
    );
  }, [client, callbacks]);

  const createPasskey = useCallback(
    async (params?: CreatePasskeyParams): Promise<CreatePasskeyResult> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      return withTurnkeyErrorHandling(
        () => client.createPasskey({ ...params }),
        undefined,
        callbacks,
        "Failed to create passkey",
      );
    },
    [client, callbacks],
  );

  const fetchUser = useCallback(
    async (params?: FetchUserParams): Promise<v1User> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.fetchUser(params),
        () => logout(),
        callbacks,
        "Failed to fetch user",
      );
    },
    [client, callbacks, logout],
  );

  const fetchWalletProviders = useCallback(
    async (chain?: Chain): Promise<WalletProvider[]> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      return withTurnkeyErrorHandling(
        async () => {
          const newProviders = await client.fetchWalletProviders(chain);

          // we update state with the latest providers
          // we keep this state so that initializeWalletProviderListeners() re-runs
          // whenever the list of connected providers changes
          // this ensures we attach disconnect listeners for each connected provider
          setWalletProviders(newProviders);

          return newProviders;
        },
        undefined,
        callbacks,
        "Failed to fetch wallet providers",
      );
    },
    [client, callbacks],
  );

  const fetchWallets = useCallback(
    async (params?: FetchWalletsParams): Promise<Wallet[]> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      return withTurnkeyErrorHandling(
        () => client.fetchWallets(params),
        () => logout(),
        callbacks,
        "Failed to fetch wallets",
      );
    },
    [client, callbacks, logout],
  );

  const refreshUser = useCallback(
    async (params?: RefreshUserParams): Promise<void> => {
      const { stampWith, organizationId, userId } = params || {};

      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );

      const user = await withTurnkeyErrorHandling(
        () =>
          fetchUser({
            stampWith,
            ...(organizationId && { organizationId }),
            ...(userId && { userId }),
          }),
        () => logout(),
        callbacks,
        "Failed to refresh user",
      );

      if (user) {
        setUser(user);
      }
    },
    [client, callbacks, fetchUser, logout],
  );

  /**
   * @internal
   * Auto-refresh user only if enabled in config. This is only used internally.
   *
   * @param params.organizationId - organization ID to specify the sub-organization (defaults to the current session's organizationId).
   * @param params.userId - user ID to fetch specific user details (defaults to the current session's userId).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves when the user is refreshed, or does nothing if auto-refresh is disabled
   */
  const maybeRefreshUser = useCallback(
    async (params?: RefreshUserParams): Promise<void> => {
      if (!masterConfig?.autoRefreshManagedState) return;
      return refreshUser(params);
    },
    [masterConfig, refreshUser],
  );

  const refreshWallets = useCallback(
    async (params?: RefreshWalletsParams): Promise<Wallet[]> => {
      const { stampWith, organizationId, userId } = params || {};

      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );

      const walletProviders = await withTurnkeyErrorHandling(
        () => fetchWalletProviders(),
        undefined,
        callbacks,
        "Failed to refresh wallets",
      );

      const wallets = await withTurnkeyErrorHandling(
        () =>
          fetchWallets({
            stampWith,
            walletProviders,
            ...(organizationId && { organizationId }),
            ...(userId && { userId }),
          }),
        () => logout(),
        callbacks,
        "Failed to refresh wallets",
      );

      if (wallets) {
        setWallets(wallets);
      }

      return wallets;
    },
    [client, callbacks, fetchWalletProviders, fetchWallets, logout],
  );

  /**
   * @internal
   * Auto-refresh wallets only if enabled in config. This is only used internally.
   *
   * @param params.organizationId - organization ID to specify the sub-organization (defaults to the current session's organizationId).
   * @param params.userId - user ID to fetch specific user details (defaults to the current session's userId).
   * @param params.stampWith - parameter to stamp the request with a specific stamper (StamperType.Passkey, StamperType.ApiKey, or StamperType.Wallet).
   * @returns A promise that resolves to an array of wallets, or an empty array if auto-refresh is disabled
   */
  const maybeRefreshWallets = useCallback(
    async (params?: RefreshWalletsParams): Promise<Wallet[]> => {
      if (!masterConfig?.autoRefreshManagedState) return [];
      return refreshWallets(params);
    },
    [masterConfig, refreshWallets],
  );

  const clearSession = useCallback(
    async (params?: ClearSessionParams): Promise<void> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      await withTurnkeyErrorHandling(
        async () => client.clearSession(params),
        undefined,
        callbacks,
        "Failed to clear session",
      );
      const sessionKey = params?.sessionKey ?? (await getActiveSessionKey());
      if (!sessionKey) return;
      if (!params?.sessionKey) {
        setSession(undefined);
      }
      clearSessionTimeouts([sessionKey]);
      // clear only the cleared session from allSessions
      const newAllSessions = { ...allSessions };
      if (newAllSessions) {
        delete newAllSessions[sessionKey];
      }
      setAllSessions(newAllSessions);
      return;
    },
    [client, callbacks, getActiveSessionKey, allSessions],
  );

  /**
   * @internal
   * Schedules a session expiration and warning timer for the given session key.
   *
   * - Sets up two timers: one for warning before expiry and one for actual expiry.
   * - Uses capped timeouts under the hood so delays > 24.8 days are safe (see utils/timers.ts).
   *
   * @param params.sessionKey - The key of the session to schedule expiration for.
   * @param params.expiry - The expiration time in seconds since epoch.
   * @throws {TurnkeyError} If an error occurs while scheduling the session expiration.
   */
  const scheduleSessionExpiration = useCallback(
    async (params: {
      sessionKey: string;
      expiry: number; // seconds since epoch
    }) => {
      const { sessionKey, expiry } = params;

      try {
        const warnKey = `${sessionKey}-warning`;

        // Replace any prior timers for this session
        clearKey(expiryTimeoutsRef.current, sessionKey);
        clearKey(expiryTimeoutsRef.current, warnKey);

        const now = Date.now();
        const expiryMs = expiry * 1000;
        const timeUntilExpiry = expiryMs - now;

        const runRefresh = async () => {
          const activeSession = await getSession();

          if (!activeSession && expiryTimeoutsRef.current[warnKey]) {
            // Keep nudging until session materializes (short 10s timer is fine)
            setTimeoutInMap(
              expiryTimeoutsRef.current,
              warnKey,
              runRefresh,
              10_000,
            );
            return;
          }

          const session = await getSession({ sessionKey });
          if (!session) return;

          callbacks?.beforeSessionExpiry?.({ sessionKey });

          if (masterConfig?.auth?.autoRefreshSession) {
            await refreshSession({
              expirationSeconds: session.expirationSeconds!,
              sessionKey,
            });
          }
        };

        const expireSession = async () => {
          const expiredSession = await getSession({ sessionKey });
          if (!expiredSession) return;

          callbacks?.onSessionExpired?.({ sessionKey });

          if ((await getActiveSessionKey()) === sessionKey) {
            setSession(undefined);
          }

          setAllSessions((prev) => {
            if (!prev) return prev;
            const next = { ...prev };
            delete next[sessionKey];
            return next;
          });

          await clearSession({ sessionKey });

          // Remove timers for this session
          clearKey(expiryTimeoutsRef.current, sessionKey);
          clearKey(expiryTimeoutsRef.current, warnKey);

          await logout();
        };

        // Already expired → expire immediately
        if (timeUntilExpiry <= 0) {
          await expireSession();
          return;
        }

        // Warning timer (if threshold is in the future)
        const warnAt = expiryMs - SESSION_WARNING_THRESHOLD_MS;
        if (warnAt <= now) {
          void runRefresh(); // fire-and-forget is fine
        } else {
          setCappedTimeoutInMap(
            expiryTimeoutsRef.current,
            warnKey,
            runRefresh,
            warnAt - now,
          );
        }

        // Actual expiry timer (safe for long delays)
        setCappedTimeoutInMap(
          expiryTimeoutsRef.current,
          sessionKey,
          expireSession,
          timeUntilExpiry,
        );
      } catch (error) {
        if (
          error instanceof TurnkeyError ||
          error instanceof TurnkeyNetworkError
        ) {
          callbacks?.onError?.(error);
        } else {
          callbacks?.onError?.(
            new TurnkeyError(
              `Failed to schedule session expiration for ${sessionKey}`,
              TurnkeyErrorCodes.SCHEDULE_SESSION_EXPIRY_ERROR,
              error,
            ),
          );
        }
      }
    },
    // Note: `refreshSession()` is intentionally NOT in the dependency array even though
    // it's called in runRefresh. This is because: `refreshSession()` itself calls `scheduleSessionExpiration()`,
    // creating a circular dependency that would cause infinite re-renders
    //
    // this is fine because `refreshSession()` reference is stable enough for this use case (session
    // expiration timers are long-lived and don't need to re-subscribe on every `refreshSession()` change)
    [
      callbacks,
      masterConfig,
      getSession,
      getActiveSessionKey,
      clearSession,
      logout,
    ],
  );

  const refreshSession = useCallback(
    async (
      params?: RefreshSessionParams,
    ): Promise<TStampLoginResponse | undefined> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }

      const activeSessionKey = await client.getActiveSessionKey();
      if (!activeSessionKey) {
        throw new TurnkeyError(
          "No active session found.",
          TurnkeyErrorCodes.NO_SESSION_FOUND,
        );
      }

      const sessionKey = params?.sessionKey ?? activeSessionKey;

      const res = await withTurnkeyErrorHandling(
        () => client.refreshSession({ ...params }),
        () => logout(),
        callbacks,
        "Failed to refresh session",
      );
      const session = await getSession({ sessionKey });

      if (session && sessionKey) {
        await scheduleSessionExpiration({
          sessionKey,
          expiry: session.expiry,
        });
      }

      const allSessions = await getAllSessions();
      setSession(session);
      setAllSessions(allSessions);
      return res;
    },
    [
      client,
      callbacks,
      logout,
      getSession,
      scheduleSessionExpiration,
      getAllSessions,
    ],
  );

  const loginWithPasskey = useCallback(
    async (params?: LoginWithPasskeyParams): Promise<PasskeyAuthResult> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }

      const expirationSeconds =
        params?.expirationSeconds ??
        masterConfig?.auth?.sessionExpirationSeconds ??
        DEFAULT_SESSION_EXPIRATION_IN_SECONDS;
      const res = await withTurnkeyErrorHandling(
        () => client.loginWithPasskey({ ...params, expirationSeconds }),
        () => logout(),
        callbacks,
        "Failed to login with passkey",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Passkey,
          action: AuthAction.LOGIN,
          identifier: res.credentialId,
          appProofs: res.appProofs,
        });
      }
      return res;
    },
    [client, callbacks, masterConfig, logout, handlePostAuth],
  );

  const signUpWithPasskey = useCallback(
    async (params?: SignUpWithPasskeyParams): Promise<PasskeyAuthResult> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      if (!masterConfig) {
        throw new TurnkeyError(
          "Config is not ready yet!",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }
      // If createSubOrgParams is not provided, use the default from masterConfig
      let createSubOrgParams =
        params?.createSubOrgParams ??
        masterConfig.auth?.createSuborgParams?.passkeyAuth;
      params =
        createSubOrgParams !== undefined
          ? { ...params, createSubOrgParams }
          : { ...params };

      const expirationSeconds =
        params?.expirationSeconds ??
        masterConfig?.auth?.sessionExpirationSeconds ??
        DEFAULT_SESSION_EXPIRATION_IN_SECONDS;

      const websiteName = window.location.hostname;
      const timestamp =
        new Date().toLocaleDateString() +
        "-" +
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

      // We allow passkeyName to be passed in thru the provider or thru the params of this function directly.
      // This is because signUpWithPasskey will create a new passkey using that name.
      // Any extra authenticators will be created after the first one. (see core implementation)
      const passkeyName =
        params?.passkeyDisplayName ??
        masterConfig.auth?.createSuborgParams?.passkeyAuth?.passkeyName ??
        `${websiteName}-${timestamp}`;

      const res = await withTurnkeyErrorHandling(
        () =>
          client.signUpWithPasskey({
            ...params,
            passkeyDisplayName: passkeyName,
            expirationSeconds,
          }),
        () => logout(),
        callbacks,
        "Failed to sign up with passkey",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Passkey,
          action: AuthAction.SIGNUP,
          identifier: res.credentialId,
          appProofs: res.appProofs,
        });
      }
      return res;
    },
    [client, callbacks, logout, handlePostAuth, masterConfig],
  );

  const connectWalletAccount = useCallback(
    async (walletProvider: WalletProvider): Promise<WalletAccount> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }

      return withTurnkeyErrorHandling(
        async () => {
          const address = await client.connectWalletAccount(walletProvider);

          let wallets: Wallet[];

          const s = await getSession();
          if (s) {
            // this will update our walletProvider state
            wallets = await maybeRefreshWallets();
          } else {
            wallets = await fetchWallets({ connectedOnly: true });
          }

          // we narrow to only connected wallets
          // because we know the account must come from one of them
          const connectedWallets = wallets.filter(
            (w): w is ConnectedWallet => w.source === WalletSource.Connected,
          );

          // find the matching account
          const matchedAccount = connectedWallets
            .flatMap((w) => w.accounts)
            .find((a) => a.address === address);

          if (!matchedAccount) {
            throw new TurnkeyError(
              `No connected wallet account found for address: ${address}`,
              TurnkeyErrorCodes.NO_WALLET_FOUND,
            );
          }

          return matchedAccount;
        },
        () => logout(),
        callbacks,
        "Failed to connect wallet account",
      );
    },

    [client, callbacks, getSession, logout, maybeRefreshWallets, fetchWallets],
  );

  const disconnectWalletAccount = useCallback(
    async (walletProvider: WalletProvider): Promise<void> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }

      await withTurnkeyErrorHandling(
        async () => {
          await client.disconnectWalletAccount(walletProvider);

          // no need here to call `maybeRefreshWallets()` because the provider emits a disconnect event which
          // will trigger a refresh via the listener we set up in `initializeWalletProviderListeners()`
        },
        undefined,
        callbacks,
        "Failed to disconnect wallet account",
      );
    },
    [client, callbacks],
  );

  const switchWalletAccountChain = useCallback(
    async (params: SwitchWalletAccountChainParams): Promise<void> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }

      await withTurnkeyErrorHandling(
        async () => {
          await client.switchWalletAccountChain({ ...params, walletProviders });
        },
        undefined,
        callbacks,
        "Failed to switch wallet account chain",
      );
    },
    [client, walletProviders, callbacks],
  );

  const buildWalletLoginRequest = useCallback(
    async (
      params: BuildWalletLoginRequestParams,
    ): Promise<BuildWalletLoginRequestResult> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }

      const expirationSeconds =
        params?.expirationSeconds ??
        masterConfig?.auth?.sessionExpirationSeconds ??
        DEFAULT_SESSION_EXPIRATION_IN_SECONDS;
      return await withTurnkeyErrorHandling(
        () => client.buildWalletLoginRequest({ ...params, expirationSeconds }),
        undefined,
        callbacks,
        "Failed to login with wallet",
      );
    },
    [client, callbacks, masterConfig],
  );

  const loginWithWallet = useCallback(
    async (params: LoginWithWalletParams): Promise<WalletAuthResult> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }

      const expirationSeconds =
        params?.expirationSeconds ??
        masterConfig?.auth?.sessionExpirationSeconds ??
        DEFAULT_SESSION_EXPIRATION_IN_SECONDS;
      const res = await withTurnkeyErrorHandling(
        () => client.loginWithWallet({ ...params, expirationSeconds }),
        undefined,
        callbacks,
        "Failed to login with wallet",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Wallet,
          action: AuthAction.LOGIN,
          identifier: res.address,
          appProofs: res.appProofs,
        });
      }
      return res;
    },
    [client, callbacks, handlePostAuth, masterConfig],
  );

  const signUpWithWallet = useCallback(
    async (params: SignUpWithWalletParams): Promise<WalletAuthResult> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      if (!masterConfig) {
        throw new TurnkeyError(
          "Config is not ready yet!",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }
      // If createSubOrgParams is not provided, use the default from masterConfig
      let createSubOrgParams =
        params.createSubOrgParams ??
        masterConfig.auth?.createSuborgParams?.walletAuth;
      params =
        createSubOrgParams !== undefined
          ? { ...params, createSubOrgParams }
          : { ...params };

      const expirationSeconds =
        params?.expirationSeconds ??
        masterConfig?.auth?.sessionExpirationSeconds ??
        DEFAULT_SESSION_EXPIRATION_IN_SECONDS;
      const res = await withTurnkeyErrorHandling(
        () => client.signUpWithWallet({ ...params, expirationSeconds }),
        undefined,
        callbacks,
        "Failed to sign up with wallet",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Wallet,
          action: AuthAction.SIGNUP,
          identifier: res.address,
          appProofs: res.appProofs,
        });
      }
      return res;
    },
    [client, callbacks, handlePostAuth, masterConfig],
  );

  const loginOrSignupWithWallet = useCallback(
    async (
      params: LoginOrSignupWithWalletParams,
    ): Promise<WalletAuthResult & { action: AuthAction }> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      if (!masterConfig) {
        throw new TurnkeyError(
          "Config is not ready yet!",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }
      // If createSubOrgParams is not provided, use the default from masterConfig
      let createSubOrgParams =
        params.createSubOrgParams ??
        masterConfig.auth?.createSuborgParams?.walletAuth;
      params =
        createSubOrgParams !== undefined
          ? { ...params, createSubOrgParams }
          : { ...params };

      const expirationSeconds =
        params?.expirationSeconds ??
        masterConfig?.auth?.sessionExpirationSeconds ??
        DEFAULT_SESSION_EXPIRATION_IN_SECONDS;
      const res = await withTurnkeyErrorHandling(
        () => client.loginOrSignupWithWallet({ ...params, expirationSeconds }),
        undefined,
        callbacks,
        "Failed to login or sign up with wallet",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Wallet,
          action: res.action,
          identifier: res.address,
          appProofs: res.appProofs,
        });
      }
      return res;
    },
    [client, callbacks, handlePostAuth, masterConfig],
  );

  const initOtp = useCallback(
    async (params: InitOtpParams): Promise<string> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      return withTurnkeyErrorHandling(
        () => client.initOtp(params),
        undefined,
        callbacks,
        "Failed to initialize OTP",
      );
    },
    [client, callbacks],
  );

  const verifyOtp = useCallback(
    async (params: VerifyOtpParams): Promise<VerifyOtpResult> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      return withTurnkeyErrorHandling(
        () => client.verifyOtp(params),
        undefined,
        callbacks,
        "Failed to verify OTP",
      );
    },
    [client, callbacks],
  );

  const loginWithOtp = useCallback(
    async (params: LoginWithOtpParams): Promise<BaseAuthResult> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }

      const res = await withTurnkeyErrorHandling(
        () => client.loginWithOtp(params),
        undefined,
        callbacks,
        "Failed to login with OTP",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Otp,
          action: AuthAction.LOGIN,
          identifier: params.verificationToken,
          appProofs: res.appProofs,
        });
      }
      return res;
    },
    [client, callbacks, handlePostAuth],
  );

  const signUpWithOtp = useCallback(
    async (params: SignUpWithOtpParams): Promise<BaseAuthResult> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      if (!masterConfig) {
        throw new TurnkeyError(
          "Config is not ready yet!",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }
      // If createSubOrgParams is not provided, use the default from masterConfig
      let createSubOrgParams = params.createSubOrgParams;
      if (!createSubOrgParams && masterConfig?.auth?.createSuborgParams) {
        if (params.otpType === OtpType.Email) {
          createSubOrgParams =
            masterConfig.auth.createSuborgParams.emailOtpAuth;
        } else if (params.otpType === OtpType.Sms) {
          createSubOrgParams = masterConfig.auth.createSuborgParams.smsOtpAuth;
        }
      }
      params =
        createSubOrgParams !== undefined
          ? { ...params, createSubOrgParams }
          : { ...params };

      const res = await withTurnkeyErrorHandling(
        () => client.signUpWithOtp(params),
        undefined,
        callbacks,
        "Failed to sign up with OTP",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Otp,
          action: AuthAction.SIGNUP,
          identifier: params.verificationToken,
          appProofs: res.appProofs,
        });
      }
      return res;
    },
    [client, callbacks, masterConfig, handlePostAuth],
  );

  const completeOtp = useCallback(
    async (
      params: CompleteOtpParams,
    ): Promise<
      BaseAuthResult & { verificationToken: string; action: AuthAction }
    > => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      if (!masterConfig) {
        throw new TurnkeyError(
          "Config is not ready yet!",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }

      // If createSubOrgParams is not provided, use the default from masterConfig
      let createSubOrgParams = params.createSubOrgParams;
      if (!createSubOrgParams && masterConfig?.auth?.createSuborgParams) {
        if (params.otpType === OtpType.Email) {
          createSubOrgParams =
            masterConfig.auth.createSuborgParams.emailOtpAuth;
        } else if (params.otpType === OtpType.Sms) {
          createSubOrgParams = masterConfig.auth.createSuborgParams.smsOtpAuth;
        }
      }
      params =
        createSubOrgParams !== undefined
          ? { ...params, createSubOrgParams }
          : { ...params };

      const res = await withTurnkeyErrorHandling(
        () => client.completeOtp(params),
        undefined,
        callbacks,
        "Failed to complete OTP",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Otp,
          action: res.action,
          identifier: res.verificationToken,
          appProofs: res.appProofs,
        });
      }
      return res;
    },
    [client, callbacks, handlePostAuth, masterConfig],
  );

  const loginWithOauth = useCallback(
    async (params: LoginWithOauthParams): Promise<BaseAuthResult> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }

      const res = await withTurnkeyErrorHandling(
        () => client.loginWithOauth(params),
        undefined,
        callbacks,
        "Failed to login with OAuth",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Oauth,
          action: AuthAction.LOGIN,
          identifier: params.oidcToken,
          appProofs: res.appProofs,
        });
      }
      return res;
    },
    [client, callbacks, handlePostAuth],
  );

  const signUpWithOauth = useCallback(
    async (params: SignUpWithOauthParams): Promise<BaseAuthResult> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      if (!masterConfig) {
        throw new TurnkeyError(
          "Config is not ready yet!",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }
      // If createSubOrgParams is not provided, use the default from masterConfig
      let createSubOrgParams =
        params.createSubOrgParams ??
        masterConfig.auth?.createSuborgParams?.oauth;
      params =
        createSubOrgParams !== undefined
          ? { ...params, createSubOrgParams }
          : { ...params };

      const res = await withTurnkeyErrorHandling(
        () => client.signUpWithOauth(params),
        undefined,
        callbacks,
        "Failed to sign up with OAuth",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Oauth,
          action: AuthAction.SIGNUP,
          identifier: params.oidcToken,
          appProofs: res.appProofs,
        });
      }
      return res;
    },
    [client, callbacks, handlePostAuth, masterConfig],
  );

  const completeOauth = useCallback(
    async (
      params: CompleteOauthParams,
    ): Promise<BaseAuthResult & { action: AuthAction }> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      if (!masterConfig) {
        throw new TurnkeyError(
          "Config is not ready yet!",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }

      // If createSubOrgParams is not provided, use the default from masterConfig
      const createSubOrgParams =
        params.createSubOrgParams ??
        masterConfig.auth?.createSuborgParams?.oauth;

      params =
        createSubOrgParams !== undefined
          ? { ...params, createSubOrgParams }
          : { ...params };

      const res = await withTurnkeyErrorHandling(
        () => client.completeOauth(params),
        undefined,
        callbacks,
        "Failed to complete OAuth",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Oauth,
          action: res.action,
          identifier: params.oidcToken,
          appProofs: res.appProofs,
        });
      }
      return res;
    },
    [client, callbacks, masterConfig, handlePostAuth],
  );

  const fetchWalletAccounts = useCallback(
    async (params: FetchWalletAccountsParams): Promise<WalletAccount[]> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      return withTurnkeyErrorHandling(
        () => client.fetchWalletAccounts(params),
        () => logout(),
        callbacks,
        "Failed to fetch wallet accounts",
      );
    },
    [client, callbacks, logout],
  );

  const fetchPrivateKeys = useCallback(
    async (params?: FetchPrivateKeysParams): Promise<v1PrivateKey[]> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      return withTurnkeyErrorHandling(
        () => client.fetchPrivateKeys(params),
        () => logout(),
        callbacks,
        "Failed to fetch private keys",
      );
    },
    [client, callbacks, logout],
  );

  const signMessage = useCallback(
    async (params: SignMessageParams): Promise<v1SignRawPayloadResult> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.signMessage(params),
        () => logout(),
        callbacks,
        "Failed to sign message",
      );
    },
    [client, callbacks, logout],
  );

  const handleSignMessage = useCallback(
    async (
      params: HandleSignMessageParams,
    ): Promise<v1SignRawPayloadResult> => {
      const { successPageDuration = 2000 } = params;
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );

      return new Promise((resolve, reject) => {
        pushPage({
          key: "Sign message",
          content: (
            <SignMessageModal
              message={params.message}
              subText={params?.subText}
              walletAccount={params.walletAccount}
              stampWith={params.stampWith}
              successPageDuration={successPageDuration}
              onSuccess={(result) => {
                resolve(result);
              }}
              onError={(error) => {
                reject(error);
              }}
              {...(params?.encoding && { encoding: params.encoding })}
              {...(params?.hashFunction && {
                hashFunction: params.hashFunction,
              })}
              {...(params?.addEthereumPrefix && {
                addEthereumPrefix: params.addEthereumPrefix,
              })}
              {...(params?.organizationId && {
                organizationId: params.organizationId,
              })}
            />
          ),
          onClose: () =>
            reject(
              new TurnkeyError(
                "User canceled the signing process.",
                TurnkeyErrorCodes.USER_CANCELED,
              ),
            ),
        });
      });
    },
    [client, callbacks, pushPage],
  );

  const signTransaction = useCallback(
    async (params: SignTransactionParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.signTransaction(params),
        () => logout(),
        callbacks,
        "Failed to sign transaction",
      );
    },
    [client, callbacks, logout],
  );

  const ethSendTransaction = useCallback(
    async (params: EthSendTransactionParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.ethSendTransaction(params),
        () => logout(),
        callbacks,
        "Failed to send eth transaction",
      );
    },
    [client, callbacks, logout],
  );

  const signAndSendTransaction = useCallback(
    async (params: SignAndSendTransactionParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.signAndSendTransaction(params),
        () => logout(),
        callbacks,
        "Failed to sign and send transaction",
      );
    },
    [client, callbacks, logout],
  );
  const pollTransactionStatus = useCallback(
    async (
      params: PollTransactionStatusParams,
    ): Promise<TGetSendTransactionStatusResponse> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.pollTransactionStatus(params),
        () => logout(),
        callbacks,
        "Failed to poll transaction status",
      );
    },
    [client, callbacks],
  );

  const fetchOrCreateP256ApiKeyUser = useCallback(
    async (params: FetchOrCreateP256ApiKeyUserParams): Promise<v1User> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.fetchOrCreateP256ApiKeyUser(params),
        () => logout(),
        callbacks,
        "Failed to fetch or create delegated access user",
      );
    },
    [client, callbacks, logout],
  );

  const fetchOrCreatePolicies = useCallback(
    async (
      params: FetchOrCreatePoliciesParams,
    ): Promise<FetchOrCreatePoliciesResult> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.fetchOrCreatePolicies(params),
        () => logout(),
        callbacks,
        "Failed to fetch or create delegated access user",
      );
    },
    [client, callbacks, logout],
  );

  const updateUserEmail = useCallback(
    async (params: UpdateUserEmailParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.updateUserEmail(params),
        () => logout(),
        callbacks,
        "Failed to update user email",
      );
      if (res)
        await maybeRefreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks, logout, maybeRefreshUser],
  );

  const removeUserEmail = useCallback(
    async (params?: RemoveUserEmailParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.removeUserEmail(params),
        () => logout(),
        callbacks,
        "Failed to remove user email",
      );
      if (res)
        await maybeRefreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks, logout, maybeRefreshUser],
  );

  const updateUserPhoneNumber = useCallback(
    async (params: UpdateUserPhoneNumberParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.updateUserPhoneNumber(params),
        () => logout(),
        callbacks,
        "Failed to update user phone number",
      );
      if (res)
        await maybeRefreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks, logout, maybeRefreshUser],
  );

  const removeUserPhoneNumber = useCallback(
    async (params?: RemoveUserPhoneNumberParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.removeUserPhoneNumber(params),
        () => logout(),
        callbacks,
        "Failed to remove user phone number",
      );
      if (res)
        await maybeRefreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks, logout, maybeRefreshUser],
  );

  const updateUserName = useCallback(
    async (params: UpdateUserNameParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.updateUserName(params),
        () => logout(),
        callbacks,
        "Failed to update user name",
      );
      if (res)
        await maybeRefreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks, logout, maybeRefreshUser],
  );

  const addOauthProvider = useCallback(
    async (params: AddOauthProviderParams): Promise<string[]> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.addOauthProvider(params),
        () => logout(),
        callbacks,
        "Failed to add OAuth provider",
      );
      if (res)
        await maybeRefreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks, logout, maybeRefreshUser],
  );

  const removeOauthProviders = useCallback(
    async (params: RemoveOauthProvidersParams): Promise<string[]> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.removeOauthProviders(params),
        () => logout(),
        callbacks,
        "Failed to remove OAuth providers",
      );
      if (res)
        await maybeRefreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks, logout, maybeRefreshUser],
  );

  const addPasskey = useCallback(
    async (params?: AddPasskeyParams): Promise<string[]> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.addPasskey(params),
        () => logout(),
        callbacks,
        "Failed to add passkey",
      );
      if (res)
        await maybeRefreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks, logout, maybeRefreshUser],
  );

  const removePasskeys = useCallback(
    async (params: RemovePasskeyParams): Promise<string[]> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.removePasskeys(params),
        () => logout(),
        callbacks,
        "Failed to remove passkeys",
      );
      if (res)
        await maybeRefreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks, logout, maybeRefreshUser],
  );

  const createWallet = useCallback(
    async (params: CreateWalletParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.createWallet(params),
        () => logout(),
        callbacks,
        "Failed to create wallet",
      );
      const s = await getSession();
      if (res && s)
        await maybeRefreshWallets({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
        });
      return res;
    },
    [client, session, callbacks, logout, maybeRefreshWallets, getSession],
  );

  const createWalletAccounts = useCallback(
    async (params: CreateWalletAccountsParams): Promise<string[]> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.createWalletAccounts(params),
        () => logout(),
        callbacks,
        "Failed to create wallet accounts",
      );
      const s = await getSession();
      if (res && s)
        await maybeRefreshWallets({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
        });
      return res;
    },
    [client, session, callbacks, logout, getSession, maybeRefreshWallets],
  );

  const exportWallet = useCallback(
    async (params: ExportWalletParams): Promise<ExportBundle> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.exportWallet(params),
        () => logout(),
        callbacks,
        "Failed to export wallet",
      );
      const s = await getSession();
      if (res && s)
        await maybeRefreshWallets({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
        });
      return res;
    },
    [client, session, callbacks, logout, getSession, maybeRefreshWallets],
  );

  const exportPrivateKey = useCallback(
    async (params: ExportPrivateKeyParams): Promise<ExportBundle> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.exportPrivateKey(params),
        () => logout(),
        callbacks,
        "Failed to export private key",
      );
      return res;
    },
    [client, callbacks, logout],
  );

  const exportWalletAccount = useCallback(
    async (params: ExportWalletAccountParams): Promise<ExportBundle> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.exportWalletAccount(params),
        () => logout(),
        callbacks,
        "Failed to export wallet accounts",
      );
      const s = await getSession();
      if (res && s)
        await maybeRefreshWallets({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
        });
      return res;
    },
    [client, callbacks, logout, getSession, maybeRefreshWallets],
  );

  const importWallet = useCallback(
    async (params: ImportWalletParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.importWallet(params),
        () => logout(),
        callbacks,
        "Failed to import wallet",
      );
      const s = await getSession();
      if (res && s)
        await maybeRefreshWallets({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks, logout, getSession, maybeRefreshWallets],
  );

  const importPrivateKey = useCallback(
    async (params: ImportPrivateKeyParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const res = await withTurnkeyErrorHandling(
        () => client.importPrivateKey(params),
        () => logout(),
        callbacks,
        "Failed to import private key",
      );
      return res;
    },
    [client, callbacks, logout],
  );

  const deleteSubOrganization = useCallback(
    async (
      params?: DeleteSubOrganizationParams,
    ): Promise<TDeleteSubOrganizationResponse> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.deleteSubOrganization(params),
        () => logout(),
        callbacks,
        "Failed to delete sub-organization",
      );
    },
    [client, callbacks, logout],
  );

  const storeSession = useCallback(
    async (params: StoreSessionParams): Promise<void> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      await withTurnkeyErrorHandling(
        () => client.storeSession(params),
        () => logout(),
        callbacks,
        "Failed to store session",
      );
      const sessionKey = await getActiveSessionKey();
      const session = await getSession({
        ...(sessionKey && { sessionKey }),
      });

      if (session && sessionKey)
        await scheduleSessionExpiration({ sessionKey, expiry: session.expiry });

      const allSessions = await getAllSessions();

      setSession(session);
      setAllSessions(allSessions);

      await Promise.all([maybeRefreshWallets(), maybeRefreshUser()]);
    },
    [
      client,
      callbacks,
      logout,
      getActiveSessionKey,
      getSession,
      scheduleSessionExpiration,
      getAllSessions,
      maybeRefreshWallets,
      maybeRefreshUser,
    ],
  );

  const clearAllSessions = useCallback(async (): Promise<void> => {
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    setSession(undefined);
    setAllSessions(undefined);
    clearSessionTimeouts();
    return await withTurnkeyErrorHandling(
      () => client.clearAllSessions(),
      () => logout(),
      callbacks,
      "Failed to clear all sessions",
    );
  }, [client, callbacks, logout, clearSessionTimeouts]);

  const setActiveSession = useCallback(
    async (params: SetActiveSessionParams): Promise<void> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const session = await withTurnkeyErrorHandling(
        () => client.getSession({ sessionKey: params.sessionKey }),
        () => logout(),
        callbacks,
        "Failed to get session",
      );
      const s = await getSession();
      if (!s) {
        throw new TurnkeyError(
          "Session not found.",
          TurnkeyErrorCodes.NOT_FOUND,
        );
      }
      await withTurnkeyErrorHandling(
        () => client.setActiveSession(params),
        () => logout(),
        callbacks,
        "Failed to set active session",
      );
      setSession(session);
      await withTurnkeyErrorHandling(
        async () => {
          await Promise.all([maybeRefreshWallets(), maybeRefreshUser()]);
        },
        () => logout(),
        callbacks,
        "Failed to refresh data after setting active session",
      );
      return;
    },
    [
      client,
      callbacks,
      logout,
      getSession,
      maybeRefreshWallets,
      maybeRefreshUser,
    ],
  );

  const clearUnusedKeyPairs = useCallback(async (): Promise<void> => {
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    return withTurnkeyErrorHandling(
      () => client.clearUnusedKeyPairs(),
      undefined,
      callbacks,
      "Failed to clear unused key pairs",
    );
  }, [client, callbacks]);

  const createApiKeyPair = useCallback(
    async (params?: CreateApiKeyPairParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.createApiKeyPair(params),
        undefined,
        callbacks,
        "Failed to create API key pair",
      );
    },
    [client, callbacks],
  );

  const getProxyAuthConfig =
    useCallback(async (): Promise<ProxyTGetWalletKitConfigResponse> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.getProxyAuthConfig(),
        undefined,
        callbacks,
        "Failed to get proxy auth config",
      );
    }, [client, callbacks]);

  const fetchBootProofForAppProof = useCallback(
    async (params: FetchBootProofForAppProofParams): Promise<v1BootProof> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.fetchBootProofForAppProof(params),
        () => logout(),
        callbacks,
        "Failed to fetch or create delegated access user",
      );
    },
    [client, callbacks, logout],
  );

  const verifyAppProofs = useCallback(
    async (params: VerifyAppProofsParams): Promise<void> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.verifyAppProofs(params),
        () => logout(),
        callbacks,
        "Failed to verify app proofs",
      );
    },
    [client, callbacks, logout],
  );

  const handleDiscordOauth = useCallback(
    async (params?: HandleDiscordOauthParams): Promise<void> => {
      const {
        clientId = masterConfig?.auth?.oauthConfig?.discordClientId,
        openInPage = masterConfig?.auth?.oauthConfig?.openOauthInPage ?? false,
        additionalState: additionalParameters,
      } = params || {};

      const provider = OAuthProviders.DISCORD;

      if (!masterConfig) {
        throw new TurnkeyError(
          "Config is not ready yet!",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }
      if (!clientId) {
        throw new TurnkeyError(
          "Discord Client ID is not configured.",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }
      if (!masterConfig.auth?.oauthConfig?.oauthRedirectUri) {
        throw new TurnkeyError(
          "OAuth Redirect URI is not configured.",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }

      const flow = openInPage ? "redirect" : "popup";
      const redirectUri = masterConfig.auth?.oauthConfig.oauthRedirectUri;

      // Create key pair and generate nonce
      const publicKey = await createApiKeyPair();
      if (!publicKey) {
        throw new Error("Failed to create public key for OAuth.");
      }
      const nonce = bytesToHex(sha256(publicKey));

      // Generate PKCE challenge pair and store verifier
      const { verifier, codeChallenge } = await generateChallengePair();
      storePKCEVerifier(provider, verifier);

      // Build OAuth URL
      const authUrl = buildOAuthUrl({
        provider,
        clientId,
        redirectUri,
        publicKey,
        nonce,
        flow,
        codeChallenge,
        additionalState: additionalParameters,
      });

      if (openInPage) {
        // Remainder of logic will occur in completeRedirectOauth
        return redirectToOAuthProvider(authUrl);
      }

      // Popup flow
      const authWindow = openOAuthPopup();
      if (!authWindow) {
        throw new Error(
          `Failed to open ${capitalizeProviderName(provider)} login window.`,
        );
      }
      authWindow.location.href = authUrl;

      return new Promise<void>((resolve, reject) => {
        const interval = setInterval(() => {
          try {
            if (authWindow.closed) {
              clearInterval(interval);
              reject(new Error("Authentication window was closed."));
              return;
            }

            const url = authWindow.location.href || "";
            if (url.startsWith(window.location.origin)) {
              const result = parseOAuthResponse(url, provider);
              if (result) {
                authWindow.close();
                clearInterval(interval);

                completeOAuthPopup({
                  provider,
                  publicKey,
                  result,
                  callbacks,
                  completeOauth,
                  onOauthSuccess: params?.onOauthSuccess,
                  exchangeCodeForToken: async (codeVerifier) => {
                    const resp =
                      await client?.httpClient.proxyOAuth2Authenticate({
                        provider: "OAUTH2_PROVIDER_DISCORD",
                        authCode: result.authCode!,
                        redirectUri,
                        codeVerifier,
                        clientId,
                        nonce,
                      });
                    return resp?.oidcToken ?? "";
                  },
                })
                  .then(() => resolve())
                  .catch(reject);
              }
            }
          } catch {
            // ignore cross-origin
          }
        }, 500);

        if (authWindow.closed) {
          clearInterval(interval);
        }
      });
    },
    [client, callbacks, completeOauth, createApiKeyPair, masterConfig],
  );

  const handleXOauth = useCallback(
    async (params?: HandleXOauthParams): Promise<void> => {
      const {
        clientId = masterConfig?.auth?.oauthConfig?.xClientId,
        openInPage = masterConfig?.auth?.oauthConfig?.openOauthInPage ?? false,
        additionalState: additionalParameters,
      } = params || {};

      const provider = OAuthProviders.X;

      if (!masterConfig) {
        throw new TurnkeyError(
          "Config is not ready yet!",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }
      if (!clientId) {
        throw new TurnkeyError(
          "Twitter Client ID is not configured.",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }
      if (!masterConfig.auth?.oauthConfig?.oauthRedirectUri) {
        throw new TurnkeyError(
          "OAuth Redirect URI is not configured.",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }

      const flow = openInPage ? "redirect" : "popup";
      const redirectUri = masterConfig.auth?.oauthConfig.oauthRedirectUri;

      // Create key pair and generate nonce
      const publicKey = await createApiKeyPair();
      if (!publicKey) {
        throw new Error("Failed to create public key for OAuth.");
      }
      const nonce = bytesToHex(sha256(publicKey));

      // Generate PKCE challenge pair and store verifier
      const { verifier, codeChallenge } = await generateChallengePair();
      storePKCEVerifier(provider, verifier);

      // Build OAuth URL
      const authUrl = buildOAuthUrl({
        provider,
        clientId,
        redirectUri,
        publicKey,
        nonce,
        flow,
        codeChallenge,
        additionalState: additionalParameters,
      });

      if (openInPage) {
        // Remainder of logic will occur in completeRedirectOauth
        return redirectToOAuthProvider(authUrl);
      }

      // Popup flow
      const authWindow = openOAuthPopup();
      if (!authWindow) {
        throw new Error(
          `Failed to open ${capitalizeProviderName(provider)} login window.`,
        );
      }
      authWindow.location.href = authUrl;

      return new Promise<void>((resolve, reject) => {
        const interval = setInterval(() => {
          try {
            if (authWindow.closed) {
              clearInterval(interval);
              reject(new Error("Authentication window was closed."));
              return;
            }

            const url = authWindow.location.href || "";
            if (url.startsWith(window.location.origin)) {
              const result = parseOAuthResponse(url, provider);
              if (result) {
                authWindow.close();
                clearInterval(interval);

                completeOAuthPopup({
                  provider,
                  publicKey,
                  result,
                  callbacks,
                  completeOauth,
                  onOauthSuccess: params?.onOauthSuccess,
                  exchangeCodeForToken: async (codeVerifier) => {
                    const resp =
                      await client?.httpClient.proxyOAuth2Authenticate({
                        provider: "OAUTH2_PROVIDER_X",
                        authCode: result.authCode!,
                        redirectUri,
                        codeVerifier,
                        clientId,
                        nonce,
                      });
                    return resp?.oidcToken ?? "";
                  },
                })
                  .then(() => resolve())
                  .catch(reject);
              }
            }
          } catch {
            // ignore cross-origin
          }
        }, 500);

        if (authWindow.closed) {
          clearInterval(interval);
        }
      });
    },
    [client, callbacks, completeOauth, createApiKeyPair, masterConfig],
  );

  const handleGoogleOauth = useCallback(
    async (params?: HandleGoogleOauthParams): Promise<void> => {
      const {
        clientId = masterConfig?.auth?.oauthConfig?.googleClientId,
        openInPage = masterConfig?.auth?.oauthConfig?.openOauthInPage ?? false,
        additionalState: additionalParameters,
      } = params || {};

      const provider = OAuthProviders.GOOGLE;

      if (!masterConfig) {
        throw new TurnkeyError(
          "Config is not ready yet!",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }
      if (!clientId) {
        throw new TurnkeyError(
          "Google Client ID is not configured.",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }
      if (!masterConfig.auth?.oauthConfig?.oauthRedirectUri) {
        throw new TurnkeyError(
          "OAuth Redirect URI is not configured.",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }

      const flow = openInPage ? "redirect" : "popup";
      // Google requires no trailing slash
      const redirectUri =
        masterConfig.auth?.oauthConfig.oauthRedirectUri.replace(/\/$/, "");

      // Create key pair and generate nonce
      const publicKey = await createApiKeyPair();
      if (!publicKey) {
        throw new Error("Failed to create public key for OAuth.");
      }
      const nonce = bytesToHex(sha256(publicKey));

      // Build OAuth URL
      const authUrl = buildOAuthUrl({
        provider,
        clientId,
        redirectUri,
        publicKey,
        nonce,
        flow,
        additionalState: additionalParameters,
      });

      if (openInPage) {
        // Remainder of logic will occur in completeRedirectOauth
        return redirectToOAuthProvider(authUrl);
      }

      // Popup flow
      const authWindow = openOAuthPopup();
      if (!authWindow) {
        throw new Error(
          `Failed to open ${capitalizeProviderName(provider)} login window.`,
        );
      }
      authWindow.location.href = authUrl;

      return new Promise<void>((resolve, reject) => {
        const interval = setInterval(() => {
          try {
            if (authWindow.closed) {
              clearInterval(interval);
              reject(new Error("Authentication window was closed."));
              return;
            }

            const url = authWindow.location.href || "";
            if (url.startsWith(window.location.origin)) {
              const result = parseOAuthResponse(url, provider);
              if (result) {
                authWindow.close();
                clearInterval(interval);

                completeOAuthPopup({
                  provider,
                  publicKey,
                  result,
                  callbacks,
                  completeOauth,
                  onOauthSuccess: params?.onOauthSuccess,
                })
                  .then(() => resolve())
                  .catch(reject);
              }
            }
          } catch {
            // Ignore cross-origin errors
          }
        }, 500);

        if (authWindow.closed) {
          clearInterval(interval);
        }
      });
    },
    [callbacks, completeOauth, createApiKeyPair, masterConfig],
  );

  const handleAppleOauth = useCallback(
    async (params?: HandleAppleOauthParams): Promise<void> => {
      const {
        clientId = masterConfig?.auth?.oauthConfig?.appleClientId,
        openInPage = masterConfig?.auth?.oauthConfig?.openOauthInPage ?? false,
        additionalState: additionalParameters,
      } = params || {};

      const provider = OAuthProviders.APPLE;

      if (!masterConfig) {
        throw new TurnkeyError(
          "Config is not ready yet!",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }
      if (!clientId) {
        throw new TurnkeyError(
          "Apple Client ID is not configured.",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }
      if (!masterConfig.auth?.oauthConfig?.oauthRedirectUri) {
        throw new TurnkeyError(
          "OAuth Redirect URI is not configured.",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }

      const flow = openInPage ? "redirect" : "popup";
      // TODO (Amir): Apple needs the '/' at the end. Maybe we should add it if not there?
      const redirectUri = masterConfig.auth?.oauthConfig.oauthRedirectUri;

      // Create key pair and generate nonce
      const publicKey = await createApiKeyPair();
      if (!publicKey) {
        throw new Error("Failed to create public key for OAuth.");
      }
      const nonce = bytesToHex(sha256(publicKey));

      // Build OAuth URL
      const authUrl = buildOAuthUrl({
        provider,
        clientId,
        redirectUri,
        publicKey,
        nonce,
        flow,
        additionalState: additionalParameters,
      });

      if (openInPage) {
        // Remainder of logic will occur in completeRedirectOauth
        return redirectToOAuthProvider(authUrl);
      }

      // Popup flow
      const authWindow = openOAuthPopup();
      if (!authWindow) {
        throw new Error(
          `Failed to open ${capitalizeProviderName(provider)} login window.`,
        );
      }
      authWindow.location.href = authUrl;

      return new Promise<void>((resolve, reject) => {
        const interval = setInterval(() => {
          try {
            if (authWindow.closed) {
              clearInterval(interval);
              reject(new Error("Authentication window was closed."));
              return;
            }

            const url = authWindow.location.href || "";
            if (url.startsWith(window.location.origin)) {
              const result = parseOAuthResponse(url, provider);
              if (result) {
                authWindow.close();
                clearInterval(interval);

                completeOAuthPopup({
                  provider,
                  publicKey,
                  result,
                  callbacks,
                  completeOauth,
                  onOauthSuccess: params?.onOauthSuccess,
                })
                  .then(() => resolve())
                  .catch(reject);
              }
            }
          } catch {
            // Ignore cross-origin errors
          }
        }, 500);

        if (authWindow.closed) {
          clearInterval(interval);
        }
      });
    },
    [callbacks, completeOauth, createApiKeyPair, masterConfig],
  );

  const handleFacebookOauth = useCallback(
    async (params?: HandleFacebookOauthParams): Promise<void> => {
      const {
        clientId = masterConfig?.auth?.oauthConfig?.facebookClientId,
        openInPage = masterConfig?.auth?.oauthConfig?.openOauthInPage ?? false,
        additionalState: additionalParameters,
      } = params || {};

      const provider = OAuthProviders.FACEBOOK;

      if (!masterConfig) {
        throw new TurnkeyError(
          "Config is not ready yet!",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }
      if (!clientId) {
        throw new TurnkeyError(
          "Facebook Client ID is not configured.",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }
      if (!masterConfig.auth?.oauthConfig?.oauthRedirectUri) {
        throw new TurnkeyError(
          "OAuth Redirect URI is not configured.",
          TurnkeyErrorCodes.INVALID_CONFIGURATION,
        );
      }

      const flow = openInPage ? "redirect" : "popup";
      const redirectUri = masterConfig.auth?.oauthConfig.oauthRedirectUri;

      // Create key pair and generate nonce
      const publicKey = await createApiKeyPair();
      if (!publicKey) {
        throw new Error("Failed to create public key for OAuth.");
      }
      const nonce = bytesToHex(sha256(publicKey));

      // Generate PKCE challenge pair and store verifier
      const { verifier, codeChallenge } = await generateChallengePair();
      storePKCEVerifier(provider, verifier);

      // Build OAuth URL
      const authUrl = buildOAuthUrl({
        provider,
        clientId,
        redirectUri,
        publicKey,
        nonce,
        flow,
        codeChallenge,
        additionalState: additionalParameters,
      });

      if (openInPage) {
        // Remainder of logic will occur in completeRedirectOauth
        return redirectToOAuthProvider(authUrl);
      }

      // Popup flow
      const authWindow = openOAuthPopup();
      if (!authWindow) {
        throw new Error(
          `Failed to open ${capitalizeProviderName(provider)} login window.`,
        );
      }
      authWindow.location.href = authUrl;

      return new Promise<void>((resolve, reject) => {
        const interval = setInterval(() => {
          try {
            if (authWindow.closed) {
              clearInterval(interval);
              reject(new Error("Authentication window was closed."));
              return;
            }

            const url = authWindow.location.href || "";
            if (url.startsWith(window.location.origin)) {
              const result = parseOAuthResponse(url, provider);
              if (result) {
                authWindow.close();
                clearInterval(interval);

                completeOAuthPopup({
                  provider,
                  publicKey,
                  result,
                  callbacks,
                  completeOauth,
                  onOauthSuccess: params?.onOauthSuccess,
                  exchangeCodeForToken: async (codeVerifier) => {
                    const tokenData = await exchangeFacebookCodeForToken(
                      clientId,
                      redirectUri,
                      result.authCode!,
                      codeVerifier,
                    );
                    return tokenData.id_token;
                  },
                })
                  .then(() => resolve())
                  .catch(reject);
              }
            }
          } catch {
            // Ignore cross-origin errors
          }
        }, 500);

        if (authWindow.closed) {
          clearInterval(interval);
        }
      });
    },
    [callbacks, completeOauth, createApiKeyPair, masterConfig],
  );

  const handleLogin = useCallback(
    async (params?: HandleLoginParams) => {
      const logo = masterConfig?.ui?.darkMode
        ? (params?.logoDark ?? masterConfig?.ui?.logoDark)
        : (params?.logoLight ?? masterConfig?.ui?.logoLight);
      pushPage({
        key: params?.title ?? "Log in or sign up",
        content: (
          <AuthComponent
            sessionKey={params?.sessionKey}
            logo={logo}
            logoClassName={params?.logoClassName}
            title={params?.title}
          />
        ),
        showTitle: logo ? false : true,
      });
    },
    [pushPage, masterConfig],
  );

  const handleExportWallet = useCallback(
    async (params: HandleExportWalletParams): Promise<void> => {
      const { walletId, targetPublicKey, stampWith, organizationId } = params;

      return new Promise<void>((resolve, reject) =>
        pushPage({
          key: "Export wallet",
          content: (
            <ExportComponent
              target={walletId}
              exportType={ExportType.Wallet}
              {...(targetPublicKey !== undefined && { targetPublicKey })}
              {...(stampWith !== undefined && { stampWith })}
              {...(organizationId !== undefined && { organizationId })}
              onSuccess={() => resolve()}
              onError={(error: any) => reject(error)}
            />
          ),
          onClose: () =>
            reject(
              new TurnkeyError(
                "User canceled the export wallet process.",
                TurnkeyErrorCodes.USER_CANCELED,
              ),
            ),
        }),
      );
    },
    [pushPage],
  );

  const handleExportPrivateKey = useCallback(
    async (params: HandleExportPrivateKeyParams): Promise<void> => {
      const {
        privateKeyId,
        targetPublicKey,
        keyFormat,
        stampWith,
        organizationId,
      } = params;
      return new Promise<void>((resolve, reject) =>
        pushPage({
          key: "Export private key",
          content: (
            <ExportComponent
              target={privateKeyId}
              exportType={ExportType.PrivateKey}
              {...(keyFormat !== undefined && { keyFormat })}
              {...(targetPublicKey !== undefined && { targetPublicKey })}
              {...(stampWith !== undefined && { stampWith })}
              {...(organizationId !== undefined && { organizationId })}
              onSuccess={() => resolve()}
              onError={(error: any) => reject(error)}
            />
          ),
          onClose: () =>
            reject(
              new TurnkeyError(
                "User canceled the export private key process.",
                TurnkeyErrorCodes.USER_CANCELED,
              ),
            ),
        }),
      );
    },
    [pushPage],
  );

  const handleExportWalletAccount = useCallback(
    async (params: HandleExportWalletAccountParams): Promise<void> => {
      const { address, targetPublicKey, keyFormat, stampWith, organizationId } =
        params;

      return new Promise<void>((resolve, reject) =>
        pushPage({
          key: "Export wallet account",
          content: (
            <ExportComponent
              target={address}
              exportType={ExportType.WalletAccount}
              {...(keyFormat !== undefined && { keyFormat })}
              {...(targetPublicKey !== undefined && { targetPublicKey })}
              {...(stampWith !== undefined && { stampWith })}
              {...(organizationId !== undefined && { organizationId })}
              onSuccess={() => resolve()}
              onError={(error: any) => reject(error)}
            />
          ),
          onClose: () =>
            reject(
              new TurnkeyError(
                "User canceled the export wallet account process.",
                TurnkeyErrorCodes.USER_CANCELED,
              ),
            ),
        }),
      );
    },
    [pushPage],
  );

  const handleImportWallet = useCallback(
    async (params?: HandleImportWalletParams): Promise<string> => {
      const {
        defaultWalletAccounts,
        successPageDuration = 2000,
        stampWith,
        walletName,
        clearClipboardOnPaste,
        organizationId,
        userId,
      } = params || {};
      try {
        return withTurnkeyErrorHandling(
          () =>
            new Promise<string>((resolve, reject) =>
              pushPage({
                key: "Import wallet",
                content: (
                  <ImportComponent
                    importType={ImportType.Wallet}
                    onError={(error: unknown) => {
                      reject(error);
                    }}
                    onSuccess={(walletId: string) => resolve(walletId)}
                    {...(defaultWalletAccounts !== undefined && {
                      defaultWalletAccounts,
                    })}
                    {...(successPageDuration !== undefined && {
                      successPageDuration,
                    })}
                    {...(clearClipboardOnPaste !== undefined && {
                      clearClipboardOnPaste, // Note: This is defaulted to true in the IframeStamper
                    })}
                    {...(stampWith !== undefined && { stampWith })}
                    {...(walletName !== undefined && { name: walletName })}
                    {...(organizationId !== undefined && { organizationId })}
                    {...(userId !== undefined && { userId })}
                  />
                ),
              }),
            ),
          () => logout(),
        );
      } catch (error) {
        if (error instanceof TurnkeyError) {
          throw error;
        }
        throw new TurnkeyError(
          "Failed to import wallet.",
          TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
          error,
        );
      }
    },
    [pushPage, logout],
  );

  const handleImportPrivateKey = useCallback(
    async (params?: HandleImportPrivateKeyParams): Promise<string> => {
      const {
        curve,
        addressFormats,
        successPageDuration = 2000,
        stampWith,
        keyName,
        keyFormat,
        clearClipboardOnPaste,
        organizationId,
      } = params || {};
      try {
        return withTurnkeyErrorHandling(
          () =>
            new Promise<string>((resolve, reject) =>
              pushPage({
                key: "Import private key",
                content: (
                  <ImportComponent
                    importType={ImportType.PrivateKey}
                    curve={curve}
                    addressFormats={addressFormats}
                    keyFormat={keyFormat}
                    onError={(error: unknown) => {
                      reject(error);
                    }}
                    onSuccess={(privateKeyId: string) => resolve(privateKeyId)}
                    {...(successPageDuration !== undefined && {
                      successPageDuration,
                    })}
                    {...(clearClipboardOnPaste !== undefined && {
                      clearClipboardOnPaste, // Note: This is defaulted to true in the IframeStamper
                    })}
                    {...(stampWith !== undefined && { stampWith })}
                    {...(keyName !== undefined && { name: keyName })}
                    {...(organizationId !== undefined && { organizationId })}
                  />
                ),
              }),
            ),
          () => logout(),
        );
      } catch (error) {
        if (error instanceof TurnkeyError) {
          throw error;
        }
        throw new TurnkeyError(
          "Failed to import private key.",
          TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
          error,
        );
      }
    },
    [pushPage, logout],
  );

  const handleUpdateUserName = useCallback(
    async (params?: HandleUpdateUserNameParams): Promise<string> => {
      const {
        successPageDuration = 2000,
        subTitle,
        title,
        stampWith,
      } = params || {};

      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );

      const s = await getSession();
      const organizationId = params?.organizationId || s?.organizationId;
      if (!organizationId) {
        throw new TurnkeyError(
          "A session or passed in organization ID is required.",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }
      const userId = params?.userId || user?.userId;
      if (!userId) {
        throw new TurnkeyError(
          "A user ID is required to update a user name.",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }

      const onSuccess = () => {
        if (!successPageDuration) return;
        pushPage({
          key: "success",
          content: (
            <SuccessPage
              text="User name changed successfully!"
              duration={successPageDuration}
              onComplete={() => {
                closeModal();
              }}
            />
          ),
          preventBack: true,
          showTitle: false,
        });
      };

      try {
        if (!params?.userName && params?.userName !== "") {
          return withTurnkeyErrorHandling(
            () =>
              new Promise((resolve, reject) => {
                pushPage({
                  key: "Update User Name",
                  content: (
                    <UpdateUserName
                      onSuccess={(userId: string) => {
                        resolve(userId);
                      }}
                      onError={(error: unknown) => {
                        reject(error);
                      }}
                      successPageDuration={successPageDuration}
                      stampWith={stampWith}
                      {...(title !== undefined && { title })}
                      {...(subTitle !== undefined && { subTitle })}
                      organizationId={organizationId}
                      userId={userId}
                    />
                  ),
                  showTitle: false,
                });
              }),
            () => logout(),
          );
        } else {
          const res = await updateUserName({
            userName: params.userName!,
            userId: params.userId ?? user!.userId,
            stampWith,
            ...(organizationId !== undefined && { organizationId }),
          });
          onSuccess();
          return res;
        }
      } catch (error) {
        if (error instanceof TurnkeyError) {
          throw error;
        }
        throw new TurnkeyError(
          "Failed to update user name.",
          TurnkeyErrorCodes.UPDATE_USER_NAME_ERROR,
          error,
        );
      }
    },
    [client, getSession, user, pushPage, closeModal, updateUserName, logout],
  );

  const handleUpdateUserPhoneNumber = useCallback(
    async (params?: HandleUpdateUserPhoneNumberParams): Promise<string> => {
      const {
        successPageDuration = 2000,
        subTitle,
        title,
        stampWith,
      } = params || {};

      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );

      if (!masterConfig) {
        throw new TurnkeyError(
          "Config is not ready yet!",
          TurnkeyErrorCodes.CONFIG_NOT_INITIALIZED,
        );
      }

      if (!masterConfig.auth?.methods?.smsOtpAuthEnabled) {
        throw new TurnkeyError(
          "SMS OTP authentication is not enabled in the configuration.",
          TurnkeyErrorCodes.AUTH_METHOD_NOT_ENABLED,
        );
      }

      const s = await getSession();
      const organizationId = params?.organizationId || s?.organizationId;
      if (!organizationId) {
        throw new TurnkeyError(
          "A session or passed in organization ID is required.",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }
      const userId = params?.userId || s?.userId;
      if (!userId) {
        throw new TurnkeyError(
          "A user ID is required to update a phone number.",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }

      const onSuccess = () => {
        if (!successPageDuration) return;
        pushPage({
          key: "success",
          content: (
            <SuccessPage
              text="Phone number changed successfully!"
              duration={successPageDuration}
              onComplete={() => {
                closeModal();
              }}
            />
          ),
          preventBack: true,
          showTitle: false,
        });
      };

      try {
        if (!params?.phoneNumber && params?.phoneNumber !== "") {
          return withTurnkeyErrorHandling(
            () =>
              new Promise((resolve, reject) => {
                pushPage({
                  key: "Update Phone Number",
                  content: (
                    <UpdatePhoneNumber
                      successPageDuration={successPageDuration}
                      onSuccess={(userId: string) => resolve(userId)}
                      onError={(error) => reject(error)}
                      organizationId={organizationId}
                      userId={userId}
                      {...(title !== undefined && { title })}
                      {...(subTitle !== undefined && { subTitle })}
                      {...(stampWith !== undefined && { stampWith })}
                    />
                  ),
                  showTitle: false,
                });
              }),
            () => logout(),
          );
        } else {
          const otpId = await initOtp({
            otpType: OtpType.Sms,
            contact: params.phoneNumber,
          });
          return withTurnkeyErrorHandling(
            () =>
              new Promise((resolve, reject) => {
                pushPage({
                  key: "Update Phone Number",
                  content: (
                    <OtpVerification
                      otpType={OtpType.Sms}
                      contact={params.phoneNumber!}
                      otpId={otpId}
                      otpLength={
                        masterConfig.auth?.otpLength !== undefined
                          ? Number(masterConfig.auth.otpLength)
                          : undefined
                      }
                      alphanumeric={masterConfig.auth?.otpAlphanumeric}
                      onContinue={async (otpCode: string) => {
                        try {
                          const { verificationToken } = await verifyOtp({
                            otpId,
                            otpCode,
                            contact: params.phoneNumber!,
                            otpType: OtpType.Sms,
                          });
                          const res = await updateUserPhoneNumber({
                            phoneNumber: params.phoneNumber!,
                            verificationToken,
                            userId,
                            organizationId,
                            ...(stampWith !== undefined && { stampWith }),
                          });
                          onSuccess();
                          resolve(res);
                        } catch (error) {
                          reject(error);
                        }
                      }}
                      {...(!user?.userPhoneNumber && {
                        title: title ?? "Connect a phone number",
                      })}
                      {...(subTitle !== undefined && { subTitle })}
                      {...(params!.formattedPhone && {
                        formattedPhone: params.formattedPhone,
                      })}
                    />
                  ),
                  showTitle: false,
                });
              }),
            () => logout(),
            callbacks,
            "Failed to update phone number",
          );
        }
      } catch (error) {
        if (error instanceof TurnkeyError) {
          throw error;
        }
        throw new TurnkeyError(
          "Failed to initialize OTP for sms verification.",
          TurnkeyErrorCodes.INIT_OTP_ERROR,
          error,
        );
      }
    },
    [
      client,
      masterConfig,
      getSession,
      pushPage,
      closeModal,
      logout,
      initOtp,
      verifyOtp,
      updateUserPhoneNumber,
      user,
      callbacks,
    ],
  );

  const handleUpdateUserEmail = useCallback(
    async (params?: HandleUpdateUserEmailParams): Promise<string> => {
      const {
        successPageDuration = 2000,
        subTitle,
        title,
        stampWith,
      } = params || {};

      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );

      const s = await getSession();
      const organizationId = params?.organizationId || s?.organizationId;
      if (!organizationId) {
        throw new TurnkeyError(
          "A session or passed in organization ID is required.",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }
      const userId = params?.userId || s?.userId;
      if (!userId) {
        throw new TurnkeyError(
          "A user ID is required to update an email.",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }

      const onSuccess = () => {
        if (!successPageDuration) return;
        pushPage({
          key: "success",
          content: (
            <SuccessPage
              text="Email changed successfully!"
              duration={successPageDuration}
              onComplete={() => {
                closeModal();
              }}
            />
          ),
          preventBack: true,
          showTitle: false,
        });
      };

      try {
        if (!params?.email && params?.email !== "") {
          return withTurnkeyErrorHandling(
            () =>
              new Promise((resolve, reject) => {
                pushPage({
                  key: "Update Email",
                  content: (
                    <UpdateEmail
                      successPageDuration={successPageDuration}
                      onSuccess={(userId: string) => {
                        resolve(userId);
                      }}
                      onError={(error) => reject(error)}
                      organizationId={organizationId}
                      userId={userId}
                      {...(title !== undefined && { title })}
                      {...(subTitle !== undefined && { subTitle })}
                      {...(stampWith !== undefined && { stampWith })}
                    />
                  ),
                  showTitle: false,
                });
              }),
            () => logout(),
          );
        } else {
          const otpId = await initOtp({
            otpType: OtpType.Email,
            contact: params.email,
          });
          return withTurnkeyErrorHandling(
            () =>
              new Promise((resolve, reject) => {
                pushPage({
                  key: "Update Email",
                  content: (
                    <OtpVerification
                      otpType={OtpType.Email}
                      contact={params.email!}
                      otpId={otpId}
                      otpLength={
                        masterConfig?.auth?.otpLength !== undefined
                          ? Number(masterConfig.auth.otpLength)
                          : undefined
                      }
                      alphanumeric={masterConfig?.auth?.otpAlphanumeric}
                      onContinue={async (otpCode: string) => {
                        try {
                          const { verificationToken } = await verifyOtp({
                            otpId,
                            otpCode,
                            contact: params.email!,
                            otpType: OtpType.Email,
                          });
                          const res = await updateUserEmail({
                            email: params.email!,
                            verificationToken,
                            userId,
                            organizationId,
                            ...(stampWith !== undefined && { stampWith }),
                          });
                          onSuccess();
                          resolve(res);
                        } catch (error) {
                          reject(error);
                        }
                      }}
                      {...(!user?.userEmail && {
                        title: title ?? "Connect an email",
                      })}
                      {...(subTitle !== undefined && { subTitle })}
                    />
                  ),
                  showTitle: false,
                });
              }),
            () => logout(),
            callbacks,
            "Failed to update email",
          );
        }
      } catch (error) {
        if (error instanceof TurnkeyError) {
          throw error;
        }
        throw new TurnkeyError(
          "Failed to initialize OTP for email verification.",
          TurnkeyErrorCodes.INIT_OTP_ERROR,
          error,
        );
      }
    },
    [
      client,
      getSession,
      pushPage,
      closeModal,
      logout,
      initOtp,
      masterConfig,
      verifyOtp,
      updateUserEmail,
      user,
      callbacks,
    ],
  );

  const handleAddEmail = useCallback(
    async (params?: HandleAddEmailParams): Promise<string> => {
      const {
        successPageDuration = 2000,
        subTitle,
        title,
        stampWith,
      } = params || {};
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }

      const s = await getSession();
      const organizationId = params?.organizationId || s?.organizationId;
      if (!organizationId) {
        throw new TurnkeyError(
          "A session or passed in organization ID is required.",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }
      const userId = params?.userId || s?.userId;
      if (!userId) {
        throw new TurnkeyError(
          "A user ID is required to add an email.",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }

      const onSuccess = () => {
        if (!successPageDuration) return;
        pushPage({
          key: "success",
          content: (
            <SuccessPage
              text="Email added successfully!"
              duration={successPageDuration}
              onComplete={() => {
                closeModal();
              }}
            />
          ),
          preventBack: true,
          showTitle: false,
        });
      };

      try {
        if (!params?.email && params?.email !== "") {
          return withTurnkeyErrorHandling(
            () =>
              new Promise((resolve, reject) => {
                pushPage({
                  key: "Add Email",
                  content: (
                    <UpdateEmail
                      successPageDuration={successPageDuration}
                      onSuccess={(userId: string) => {
                        resolve(userId);
                      }}
                      onError={(error) => reject(error)}
                      {...(!user?.userEmail
                        ? { title: title ?? "Connect an email" }
                        : {})}
                      {...(subTitle !== undefined ? { subTitle } : {})}
                      organizationId={organizationId}
                      userId={userId}
                      stampWith={stampWith}
                    />
                  ),
                  showTitle: false,
                });
              }),
            () => logout(),
          );
        } else {
          const otpId = await initOtp({
            otpType: OtpType.Email,
            contact: params.email,
          });
          return withTurnkeyErrorHandling(
            () =>
              new Promise((resolve, reject) => {
                pushPage({
                  key: "Add Email",
                  content: (
                    <OtpVerification
                      otpType={OtpType.Email}
                      contact={params.email!}
                      otpId={otpId}
                      otpLength={
                        masterConfig?.auth?.otpLength !== undefined
                          ? Number(masterConfig.auth.otpLength)
                          : undefined
                      }
                      alphanumeric={masterConfig?.auth?.otpAlphanumeric}
                      onContinue={async (otpCode: string) => {
                        try {
                          const { verificationToken } = await verifyOtp({
                            otpId,
                            otpCode,
                            contact: params.email!,
                            otpType: OtpType.Email,
                          });
                          const res = await updateUserEmail({
                            email: params.email!,
                            verificationToken,
                            userId,
                            organizationId,
                            stampWith,
                          });
                          onSuccess();
                          resolve(res);
                        } catch (error) {
                          reject(error);
                        }
                      }}
                      {...(!user?.userEmail && {
                        title: title ?? "Connect an email",
                      })}
                      {...(subTitle !== undefined && { subTitle })}
                    />
                  ),
                  showTitle: false,
                });
              }),
            () => logout(),
            callbacks,
            "Failed to add email",
          );
        }
      } catch (error) {
        if (error instanceof TurnkeyError) {
          throw error;
        }
        throw new TurnkeyError(
          "Failed to initialize OTP for email verification.",
          TurnkeyErrorCodes.INIT_OTP_ERROR,
          error,
        );
      }
    },
    [
      client,
      getSession,
      pushPage,
      closeModal,
      user,
      logout,
      initOtp,
      masterConfig,
      verifyOtp,
      updateUserEmail,
      callbacks,
    ],
  );

  const handleAddPhoneNumber = useCallback(
    async (params?: HandleAddPhoneNumberParams): Promise<string> => {
      const {
        successPageDuration = 2000,
        subTitle,
        title,
        stampWith,
      } = params || {};

      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );

      if (!masterConfig) {
        throw new TurnkeyError(
          "Config is not ready yet!",
          TurnkeyErrorCodes.CONFIG_NOT_INITIALIZED,
        );
      }

      if (!masterConfig.auth?.methods?.smsOtpAuthEnabled) {
        throw new TurnkeyError(
          "SMS OTP authentication is not enabled in the configuration.",
          TurnkeyErrorCodes.AUTH_METHOD_NOT_ENABLED,
        );
      }

      const s = await getSession();
      const organizationId = params?.organizationId || s?.organizationId;
      if (!organizationId) {
        throw new TurnkeyError(
          "A session or passed in organization ID is required.",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }
      const userId = params?.userId || s?.userId;
      if (!userId) {
        throw new TurnkeyError(
          "A user ID is required to add a phone number.",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }

      const onSuccess = () => {
        if (!successPageDuration) return;
        pushPage({
          key: "success",
          content: (
            <SuccessPage
              text="Phone number updated successfully!"
              duration={successPageDuration}
              onComplete={() => {
                closeModal();
              }}
            />
          ),
          preventBack: true,
          showTitle: false,
        });
      };

      try {
        if (!params?.phoneNumber && params?.phoneNumber !== "") {
          return withTurnkeyErrorHandling(
            () =>
              new Promise((resolve, reject) => {
                pushPage({
                  key: "Add Phone Number",
                  content: (
                    <UpdatePhoneNumber
                      successPageDuration={successPageDuration}
                      onSuccess={(userId: string) => {
                        resolve(userId);
                      }}
                      onError={(error) => {
                        reject(error);
                      }}
                      {...(!user?.userPhoneNumber && {
                        title: title ?? "Connect a phone number",
                      })}
                      {...(subTitle !== undefined && { subTitle })}
                      organizationId={organizationId}
                      userId={userId}
                      stampWith={stampWith}
                    />
                  ),
                  showTitle: false,
                });
              }),
            () => logout(),
            callbacks,
            "Failed to add phone number",
          );
        } else {
          const otpId = await initOtp({
            otpType: OtpType.Sms,
            contact: params.phoneNumber,
          });
          return withTurnkeyErrorHandling(
            () =>
              new Promise((resolve, reject) => {
                pushPage({
                  key: "Add Phone Number",
                  content: (
                    <OtpVerification
                      otpType={OtpType.Sms}
                      contact={params.phoneNumber!}
                      otpId={otpId}
                      otpLength={
                        masterConfig.auth?.otpLength !== undefined
                          ? Number(masterConfig.auth.otpLength)
                          : undefined
                      }
                      alphanumeric={masterConfig?.auth?.otpAlphanumeric}
                      onContinue={async (otpCode: string) => {
                        try {
                          const { verificationToken } = await verifyOtp({
                            otpId,
                            otpCode,
                            contact: params.phoneNumber!,
                            otpType: OtpType.Sms,
                          });
                          const res = await updateUserPhoneNumber({
                            phoneNumber: params.phoneNumber!,
                            verificationToken,
                            userId,
                            organizationId,
                            stampWith,
                          });
                          onSuccess();
                          resolve(res);
                        } catch (error) {
                          reject(error);
                        }
                      }}
                      {...(!user?.userPhoneNumber && {
                        title: title ?? "Connect a phone number",
                      })}
                      {...(subTitle !== undefined && { subTitle })}
                      {...(params!.formattedPhone && {
                        formattedPhone: params.formattedPhone,
                      })}
                    />
                  ),
                  showTitle: false,
                });
              }),
            () => logout(),
            callbacks,
            "Failed to add phone number",
          );
        }
      } catch (error) {
        if (error instanceof TurnkeyError) {
          throw error;
        }
        throw new TurnkeyError(
          "Failed to initialize OTP for sms verification.",
          TurnkeyErrorCodes.INIT_OTP_ERROR,
          error,
        );
      }
    },
    [
      client,
      masterConfig,
      getSession,
      pushPage,
      closeModal,
      user,
      logout,
      callbacks,
      initOtp,
      verifyOtp,
      updateUserPhoneNumber,
    ],
  );

  const handleRemovePasskey = useCallback(
    async (params: HandleRemovePasskeyParams): Promise<string[]> => {
      const {
        authenticatorId,
        successPageDuration = 2000,
        subTitle,
        title,
        stampWith,
        userId,
      } = params;

      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );

      const s = await getSession();
      const organizationId = params?.organizationId || s?.organizationId;
      if (!organizationId) {
        throw new TurnkeyError(
          "A session or passed in organization ID is required.",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }

      return withTurnkeyErrorHandling(
        () =>
          new Promise((resolve, reject) => {
            pushPage({
              key: "Remove Passkey",
              content: (
                <RemovePasskey
                  authenticatorId={authenticatorId}
                  successPageDuration={successPageDuration}
                  onSuccess={(authenticatorIds: string[]) => {
                    resolve(authenticatorIds);
                  }}
                  onError={(error) => {
                    reject(error);
                  }}
                  stampWith={stampWith}
                  {...(userId && { userId })}
                  {...(title !== undefined && { title })}
                  {...(subTitle !== undefined && { subTitle })}
                  {...(organizationId !== undefined && { organizationId })}
                />
              ),
              showTitle: false,
              preventBack: true,
            });
          }),
        () => logout(),
        callbacks,
        "Failed to remove passkey",
      );
    },
    [client, getSession, pushPage, logout, callbacks],
  );

  const handleAddPasskey = useCallback(
    async (params?: HandleAddPasskeyParams): Promise<string[]> => {
      const {
        name,
        displayName,
        successPageDuration = 2000,
        stampWith,
      } = params || {};

      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );

      const s = await getSession();
      const organizationId = params?.organizationId || s?.organizationId;
      if (!organizationId) {
        throw new TurnkeyError(
          "A session or passed in organization ID is required.",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }
      const userId = params?.userId || s?.userId;
      if (!userId) {
        throw new TurnkeyError(
          "A user ID or a valid session is required to add a passkey.",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }
      try {
        const resPromise = addPasskey({
          ...(name && { name }),
          ...(displayName && { displayName }),
          userId,
          stampWith,
          ...(organizationId && { organizationId }),
        });
        resPromise.then(() => {
          pushPage({
            key: "Passkey Added",
            content: (
              <SuccessPage
                text="Successfully added passkey!"
                duration={successPageDuration}
                onComplete={() => {
                  closeModal();
                }}
              />
            ),
            preventBack: true,
            showTitle: false,
          });
        });
        return await resPromise;
      } catch (error) {
        if (error instanceof TurnkeyError) {
          throw error;
        }
        throw new TurnkeyError(
          "Failed to add passkey in handler.",
          TurnkeyErrorCodes.ADD_PASSKEY_ERROR,
          error,
        );
      }
    },
    [client, getSession, addPasskey, pushPage, closeModal],
  );

  const handleRemoveOauthProvider = useCallback(
    async (params: HandleRemoveOauthProviderParams): Promise<string[]> => {
      const {
        providerId,
        successPageDuration = 2000,
        subTitle,
        title,
        stampWith,
      } = params;

      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const s = await getSession();
      const organizationId = params?.organizationId || s?.organizationId;
      if (!organizationId) {
        throw new TurnkeyError(
          "A session or passed in organization ID is required.",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }
      try {
        return new Promise((resolve, reject) => {
          pushPage({
            key: "Remove OAuth Provider",
            content: (
              <RemoveOAuthProvider
                providerId={providerId}
                stampWith={stampWith}
                successPageDuration={successPageDuration}
                onSuccess={(providerIds: string[]) => {
                  resolve(providerIds);
                }}
                onError={(error: unknown) => {
                  reject(error);
                }}
                {...(title !== undefined && { title })}
                {...(subTitle !== undefined && { subTitle })}
                {...(organizationId !== undefined && { organizationId })}
              />
            ),
            showTitle: false,
            preventBack: true,
            onClose: () =>
              reject(
                new TurnkeyError(
                  "User canceled the remove OAuth provider process.",
                  TurnkeyErrorCodes.USER_CANCELED,
                ),
              ),
          });
        });
      } catch (error) {
        if (error instanceof TurnkeyError) {
          throw error;
        }
        throw new TurnkeyError(
          "Failed to remove OAuth provider in handler.",
          TurnkeyErrorCodes.REMOVE_OAUTH_PROVIDER_ERROR,
          error,
        );
      }
    },
    [client, getSession, pushPage],
  );

  const handleAddOauthProvider = useCallback(
    async (params: HandleAddOauthProviderParams): Promise<void> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const {
        providerName,
        stampWith,
        successPageDuration = 2000,
        openInPage = masterConfig?.auth?.oauthConfig?.openOauthInPage ?? false,
      } = params;
      const s = await getSession();
      const organizationId = params?.organizationId || s?.organizationId;
      if (!organizationId) {
        throw new TurnkeyError(
          "A session or passed in organization ID is required.",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }
      const userId = params?.userId || s?.userId;
      if (!userId) {
        throw new TurnkeyError(
          "A user ID is required to add an OAuth provider.",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }
      return new Promise<void>(async (resolve, reject) => {
        try {
          const onOauthSuccess = async (params: {
            providerName: string;
            oidcToken: string;
          }) => {
            await addOauthProvider({
              providerName: params.providerName,
              oidcToken: params.oidcToken,
              stampWith,
              organizationId,
              userId,
            });
            resolve();
            pushPage({
              key: "OAuth Provider Added",
              content: (
                <SuccessPage
                  text={`Successfully added ${params.providerName} OAuth provider!`}
                  duration={successPageDuration}
                  onComplete={() => {
                    closeModal();
                  }}
                />
              ),
              preventBack: true,
              showTitle: false,
            });
          };

          if (openInPage) {
            storeOAuthAddProviderMetadata({
              organizationId,
              userId,
              ...(stampWith && { stampWith: stampWith as string }),
              successPageDuration,
            });
          }

          const additionalState = openInPage
            ? {
                oauthIntent: OAUTH_INTENT_ADD_PROVIDER,
                ...(successPageDuration > 0 && { openModal: "true" }),
              }
            : undefined;

          switch (providerName) {
            case OAuthProviders.DISCORD: {
              return await handleDiscordOauth({
                openInPage,
                ...(additionalState && { additionalState }),
                ...(!openInPage && { onOauthSuccess }),
              });
            }
            case OAuthProviders.X: {
              return await handleXOauth({
                openInPage,
                ...(additionalState && { additionalState }),
                ...(!openInPage && { onOauthSuccess }),
              });
            }
            case OAuthProviders.GOOGLE: {
              return await handleGoogleOauth({
                openInPage,
                ...(additionalState && { additionalState }),
                ...(!openInPage && { onOauthSuccess }),
              });
            }
            case OAuthProviders.APPLE: {
              return await handleAppleOauth({
                openInPage,
                ...(additionalState && { additionalState }),
                ...(!openInPage && { onOauthSuccess }),
              });
            }
            case OAuthProviders.FACEBOOK: {
              return await handleFacebookOauth({
                openInPage,
                ...(additionalState && { additionalState }),
                ...(!openInPage && { onOauthSuccess }),
              });
            }
            default: {
              throw new TurnkeyError(
                `Unsupported OAuth provider: ${providerName}`,
                TurnkeyErrorCodes.NOT_FOUND,
              );
            }
          }
        } catch (error) {
          reject(error);
        }
      });
    },
    [
      client,
      getSession,
      addOauthProvider,
      pushPage,
      closeModal,
      handleDiscordOauth,
      handleXOauth,
      handleGoogleOauth,
      handleAppleOauth,
      handleFacebookOauth,
    ],
  );

  const handleConnectExternalWallet = useCallback(
    async (
      params?: HandleConnectExternalWalletParams,
    ): Promise<{ type: "connect" | "disconnect"; account: WalletAccount }> => {
      const { successPageDuration = 2000 } = params || {};
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      if (!masterConfig?.walletConfig?.features?.connecting) {
        throw new TurnkeyError(
          "Wallet connecting is not enabled.",
          TurnkeyErrorCodes.FEATURE_NOT_ENABLED,
        );
      }

      return new Promise((resolve, reject) => {
        pushPage({
          key: "Connect wallet",
          content: (
            <ConnectWalletModal
              successPageDuration={successPageDuration}
              onSuccess={(
                type: "connect" | "disconnect",
                account: WalletAccount,
              ) => {
                resolve({ type, account });
              }}
            />
          ),
          onClose: () =>
            reject(
              new TurnkeyError(
                "User canceled the connect wallet process.",
                TurnkeyErrorCodes.USER_CANCELED,
              ),
            ),
        });
      });
    },
    [client, masterConfig, fetchWalletProviders, pushPage],
  );

  const handleRemoveUserEmail = useCallback(
    async (params?: HandleRemoveUserEmailParams): Promise<string> => {
      const { successPageDuration = 2000, stampWith, userId } = params || {};
      const s = await getSession();
      const organizationId = params?.organizationId || s?.organizationId;
      if (!organizationId) {
        throw new TurnkeyError(
          "A session or passed in organization ID is required.",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }

      try {
        return new Promise((resolve, reject) => {
          pushPage({
            key: "Remove Email",
            content: (
              <RemoveEmail
                successPageDuration={successPageDuration}
                {...(userId && { userId })}
                {...(stampWith && { stampWith })}
                onSuccess={(userId: string) => {
                  resolve(userId);
                }}
                onError={(error: unknown) => {
                  reject(error);
                }}
                {...(organizationId !== undefined && { organizationId })}
              />
            ),
            showTitle: false,
            preventBack: true,
            onClose: () =>
              reject(
                new TurnkeyError(
                  "User canceled the remove email process.",
                  TurnkeyErrorCodes.USER_CANCELED,
                ),
              ),
          });
        });
      } catch (error) {
        if (error instanceof TurnkeyError) {
          throw error;
        }
        throw new TurnkeyError(
          "Failed to remove user email.",
          TurnkeyErrorCodes.UPDATE_USER_EMAIL_ERROR,
          error,
        );
      }
    },
    [getSession, pushPage],
  );

  const handleRemoveUserPhoneNumber = useCallback(
    async (params?: HandleRemoveUserPhoneNumberParams): Promise<string> => {
      const { successPageDuration = 2000, stampWith, userId } = params || {};
      const s = await getSession();
      const organizationId = params?.organizationId || s?.organizationId;
      if (!organizationId) {
        throw new TurnkeyError(
          "A session or passed in organization ID is required.",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }

      try {
        return new Promise((resolve, reject) => {
          pushPage({
            key: "Remove Phone Number",
            content: (
              <RemovePhoneNumber
                successPageDuration={successPageDuration}
                {...(userId && { userId })}
                {...(stampWith && { stampWith })}
                onSuccess={(userId: string) => {
                  resolve(userId);
                }}
                onError={(error: unknown) => {
                  reject(error);
                }}
                {...(organizationId !== undefined && { organizationId })}
              />
            ),
            showTitle: false,
            preventBack: true,
            onClose: () =>
              reject(
                new TurnkeyError(
                  "User canceled the remove phone number process.",
                  TurnkeyErrorCodes.USER_CANCELED,
                ),
              ),
          });
        });
      } catch (error) {
        if (error instanceof TurnkeyError) {
          throw error;
        }
        throw new TurnkeyError(
          "Failed to remove user phone number.",
          TurnkeyErrorCodes.UPDATE_USER_PHONE_NUMBER_ERROR,
          error,
        );
      }
    },
    [getSession, pushPage],
  );

  const handleSendTransaction = useCallback(
    async (params: HandleSendTransactionParams): Promise<void> => {
      const session = await getSession();
      const organizationId = params.organizationId || session?.organizationId;

      if (!organizationId) {
        throw new TurnkeyError(
          "A session or passed in organization ID is required.",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }

      const {
        transaction,
        icon,
        stampWith,
        successPageDuration = 2000,
      } = params;

      const {
        from,
        to,
        caip2,
        value,
        data,
        nonce,
        gasLimit,
        maxFeePerGas,
        maxPriorityFeePerGas,
        sponsor,
      } = transaction;

      const cleanedData =
        data && data !== "0x" && data !== "" ? data : undefined;

      return new Promise((resolve, reject) => {
        const action = async () => {
          const tx: EthTransaction = {
            from,
            to,
            caip2,
            sponsor: sponsor ?? false,
            ...(value ? { value } : {}),
            ...(cleanedData ? { data: cleanedData } : {}),
            ...(nonce ? { nonce } : {}),
            ...(gasLimit ? { gasLimit } : {}),
            ...(maxFeePerGas ? { maxFeePerGas } : {}),
            ...(maxPriorityFeePerGas ? { maxPriorityFeePerGas } : {}),
          };

          const sendTransactionStatusId = await ethSendTransaction({
            organizationId,
            transaction: tx,
            stampWith,
          });

          if (!sendTransactionStatusId) {
            throw new TurnkeyError(
              "Missing sendTransactionStatusId",
              TurnkeyErrorCodes.ETH_SEND_TRANSACTION_ERROR,
            );
          }

          const pollResult = await pollTransactionStatus({
            organizationId,
            sendTransactionStatusId,
          });

          const txHash = pollResult?.eth?.txHash;
          if (!txHash) {
            throw new TurnkeyError(
              "Missing txHash in transaction result",
              TurnkeyErrorCodes.POLL_TRANSACTION_STATUS_ERROR,
            );
          }

          return { txHash };
        };

        pushPage({
          key: "Send Transaction",
          showTitle: false,
          preventBack: true,
          onClose: () =>
            reject(
              new TurnkeyError(
                "User canceled the transaction.",
                TurnkeyErrorCodes.USER_CANCELED,
              ),
            ),
          content: (
            <SendTransactionPage
              icon={icon ?? getChainLogo(caip2)}
              action={action}
              caip2={caip2}
              successPageDuration={successPageDuration}
              onSuccess={() => resolve()}
              onError={(err) => reject(err)}
            />
          ),
        });
      });
    },
    [pushPage, client],
  );

  const handleOnRamp = useCallback(
    async (params: HandleOnRampParams): Promise<void> => {
      const {
        walletAccount,
        fiatCurrencyAmount,
        fiatCurrencyCode,
        paymentMethod,
        countrySubdivisionCode,
        urlForSignature,
        countryCode,
        onrampProvider = "FIAT_ON_RAMP_PROVIDER_MOONPAY",
        sandboxMode = true,
        successPageDuration = 2000,
        openInNewTab = false,
      } = params;

      const s = await getSession();
      const organizationId = params?.organizationId || s?.organizationId;
      if (!organizationId) {
        throw new TurnkeyError(
          "A session or passed in organization ID is required.",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }

      let cryptoCurrencyCode;
      let network;

      switch (true) {
        case walletAccount.addressFormat === "ADDRESS_FORMAT_ETHEREUM":
          cryptoCurrencyCode = FiatOnRampCryptoCurrency.ETHEREUM;
          network = FiatOnRampBlockchainNetwork.ETHEREUM;
          break;

        case walletAccount.addressFormat?.includes("ADDRESS_FORMAT_BITCOIN"):
          cryptoCurrencyCode = FiatOnRampCryptoCurrency.BITCOIN;
          network = FiatOnRampBlockchainNetwork.BITCOIN;
          break;

        case walletAccount.addressFormat === "ADDRESS_FORMAT_SOLANA":
          cryptoCurrencyCode = FiatOnRampCryptoCurrency.SOLANA;
          network = FiatOnRampBlockchainNetwork.SOLANA;
          break;

        default:
          cryptoCurrencyCode = FiatOnRampCryptoCurrency.ETHEREUM;
          network = FiatOnRampBlockchainNetwork.ETHEREUM;
          break;
      }
      const openNewTab = openInNewTab || isMobile;
      cryptoCurrencyCode = params.cryptoCurrencyCode || cryptoCurrencyCode;
      network = params.network || network;

      return new Promise((resolve, reject) => {
        const OnRampContainer = () => {
          const [completed, setCompleted] = useState(false);
          const pollingRef = useRef<NodeJS.Timeout | null>(null);

          const cleanup = () => {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
          };
          useEffect(() => {
            return () => {
              cleanup();
            };
          }, []);
          const action = async () => {
            try {
              let onRampWindow: Window | null = null;
              if (openNewTab) {
                onRampWindow = window.open("", "_blank");
                if (!onRampWindow)
                  throw new Error("Failed to open On Ramp tab.");
              }

              const result = await client?.httpClient?.initFiatOnRamp({
                onrampProvider,
                walletAddress: walletAccount.address,
                network,
                cryptoCurrencyCode,
                sandboxMode,
                organizationId,
                ...(fiatCurrencyCode ? { fiatCurrencyCode } : {}),
                ...(fiatCurrencyAmount ? { fiatCurrencyAmount } : {}),
                ...(paymentMethod ? { paymentMethod } : {}),
                ...(countryCode ? { countryCode } : {}),
                ...(countrySubdivisionCode ? { countrySubdivisionCode } : {}),
                ...(sandboxMode !== undefined ? { sandboxMode } : {}),
                ...(urlForSignature ? { urlForSignature } : {}),
              });

              if (!result?.onRampUrl) throw new Error("Missing onRampUrl");

              if (openNewTab && onRampWindow) {
                onRampWindow.location.href = result.onRampUrl.toString();
              } else {
                const popupWidth = 500;
                const popupHeight = 600;
                const left =
                  window.screenX + (window.innerWidth - popupWidth) / 2;
                const top =
                  window.screenY + (window.innerHeight - popupHeight) / 2;
                onRampWindow = window.open(
                  result.onRampUrl.toString(),
                  "_blank",
                  `width=${popupWidth},height=${popupHeight},top=${top},left=${left},scrollbars=yes,resizable=yes`,
                );
                if (!onRampWindow)
                  throw new Error("Failed to open On Ramp window.");
              }

              const onRampTransactionId = result.onRampTransactionId;
              if (!onRampTransactionId)
                throw new Error("No onRampTransactionId returned");

              return new Promise<void>((resolveAction, rejectAction) => {
                pollingRef.current = setInterval(async () => {
                  try {
                    if (
                      onrampProvider === "FIAT_ON_RAMP_PROVIDER_COINBASE" &&
                      onRampWindow?.closed
                    ) {
                      cleanup();
                      rejectAction(new Error("On-ramp popup closed by user"));
                      return;
                    }

                    let currentUrl = "";
                    try {
                      currentUrl = onRampWindow?.location.href || "";
                    } catch {}

                    if (
                      currentUrl &&
                      currentUrl.startsWith(window.location.origin)
                    ) {
                      cleanup();
                      onRampWindow?.close();
                      setCompleted(true);
                      resolveAction();
                      return;
                    }

                    const resp =
                      await client?.httpClient?.getOnRampTransactionStatus({
                        transactionId: onRampTransactionId,
                        refresh: true,
                      });

                    const status = resp?.transactionStatus;
                    if (
                      ["COMPLETED", "FAILED", "CANCELLED"].includes(
                        status ?? "",
                      )
                    ) {
                      cleanup();
                      try {
                        onRampWindow?.close();
                      } catch {}
                      setCompleted(true);
                      resolveAction();
                    }
                  } catch (error) {
                    console.warn("Polling error (ignored):", error);
                  }
                }, 3000);
              });
            } catch (err) {
              cleanup();
              throw err;
            }
          };

          return (
            <OnRampPage
              icon={
                onrampProvider === "FIAT_ON_RAMP_PROVIDER_COINBASE" ? (
                  <CoinbaseLogo className="w-12 h-12" />
                ) : (
                  <MoonPayLogo className="w-12 h-12" />
                )
              }
              onrampProvider={onrampProvider}
              action={action}
              sandboxMode={sandboxMode}
              completed={completed}
              successPageDuration={successPageDuration}
              onSuccess={() => resolve()}
              onError={(err) => reject(err)}
            />
          );
        };

        pushPage({
          key: "Fiat OnRamp",
          content: <OnRampContainer />,
          showTitle: false,
          preventBack: true,
          onClose: () =>
            reject(
              new TurnkeyError(
                "User canceled the onramp process.",
                TurnkeyErrorCodes.USER_CANCELED,
              ),
            ),
        });
      });
    },
    [getSession, client, pushPage],
  );

  const handleVerifyAppProofs = useCallback(
    async (params: HandleVerifyAppProofsParams): Promise<void> => {
      const { appProofs, successPageDuration = 3000, stampWith } = params || {};
      const s = await getSession();
      const organizationId = params?.organizationId || s?.organizationId;
      if (!organizationId) {
        throw new TurnkeyError(
          "A session or passed in organization ID is required.",
          TurnkeyErrorCodes.INVALID_REQUEST,
        );
      }

      try {
        return new Promise((resolve, reject) => {
          pushPage({
            key: "Verify app proofs",
            showTurnkeyBranding: false,
            content: (
              <VerifyPage
                appProofs={appProofs}
                onSuccess={() => {
                  resolve();
                }}
                onError={(error: unknown) => {
                  reject(error);
                }}
                successPageDuration={successPageDuration}
                {...(stampWith && { stampWith })}
                {...(organizationId !== undefined && { organizationId })}
              />
            ),
            showTitle: false,
            preventBack: true,
            onClose: () =>
              reject(
                new TurnkeyError(
                  "User canceled the verify app proofs process.",
                  TurnkeyErrorCodes.USER_CANCELED,
                ),
              ),
          });
        });
      } catch (error) {
        if (error instanceof TurnkeyError) {
          throw error;
        }
        throw new TurnkeyError(
          "Failed to verify app proofs.",
          TurnkeyErrorCodes.VERIFY_APP_PROOFS_ERROR,
          error,
        );
      }
    },
    [getSession, pushPage],
  );

  useEffect(() => {
    if (proxyAuthConfigRef.current) return;

    // Only fetch the proxy auth config once. Use that to build the master config.
    const fetchProxyAuthConfig = async () => {
      try {
        let proxyAuthConfig: ProxyTGetWalletKitConfigResponse | undefined;

        if (shouldFetchWalletKitConfig) {
          // Only fetch the proxy auth config if we have an authProxyId and the autoFetchWalletKitConfig param is enabled or not passed in.
          proxyAuthConfig = await getAuthProxyConfig(
            config.authProxyConfigId!, // Can assert safely. See shouldFetchWalletKitConfig definition.
            config.authProxyUrl,
          );
          proxyAuthConfigRef.current = proxyAuthConfig;
        }

        setMasterConfig(buildConfig(proxyAuthConfig));
      } catch {
        setClientState(ClientState.Error);
      }
    };

    fetchProxyAuthConfig();
  }, []);

  useEffect(() => {
    // Start the client initialization process once we have the master config.
    if (!masterConfig) return;
    initializeClient();
  }, [masterConfig]);

  useEffect(() => {
    // Handle changes to the passed in config prop -- update the master config
    // Rebuild the master config with the updated config and stored proxyAuthConfig
    // If we don't have a stored proxyAuthConfig and we need to fetch it, we wait until that fetch is done in the other useEffect.
    // If shouldFetchWalletKitConfig is false, we'll never have a proxyAuthConfig to build the master config with, so this useEffect should always run.
    if (!proxyAuthConfigRef.current && shouldFetchWalletKitConfig) return;

    setMasterConfig(buildConfig(proxyAuthConfigRef.current ?? undefined));
  }, [config, proxyAuthConfigRef.current]);

  /**
   * @internal
   * We create `debouncedRefreshWallets()` so that multiple rapid wallet events
   * (for example, on Solana a single disconnect can emit several events we listen for)
   * only trigger `maybeRefreshWallets()` once.
   *
   * Defining the debounced function outside of the `useEffect` ensures all event
   * listeners in `initializeWalletProviderListeners` share the same instance, instead of creating
   * a new one on every render.
   */
  const debouncedRefreshWallets = useDebouncedCallback(
    maybeRefreshWallets,
    100,
  );
  const debouncedFetchWalletProviders = useDebouncedCallback(
    fetchWalletProviders,
    100,
  );

  useEffect(() => {
    const handleUpdateState = async () => {
      // we only refresh the wallets if there is an active session
      // this is needed because a disconnect event can occur
      // while the user is unauthenticated
      //
      // WalletProviders state is updated regardless of session state
      const currentSession = await getSession();
      if (currentSession) {
        // this updates both the wallets and walletProviders state
        await debouncedRefreshWallets();
      } else {
        // this updates only the walletProviders state
        await debouncedFetchWalletProviders();
      }
    };

    let cleanup = () => {};
    initializeWalletProviderListeners(walletProviders, handleUpdateState)
      .then((fn) => {
        cleanup = fn;
      })
      .catch((err) => {
        console.error("Failed to init providers:", err);
      });

    return () => {
      cleanup();
    };
  }, [
    walletProviders,
    getSession,
    debouncedRefreshWallets,
    debouncedFetchWalletProviders,
  ]);

  useEffect(() => {
    // authState must be consistent with session state. We found during testing that there are cases where the session and authState can be out of sync in very rare edge cases.
    // This will ensure that they are always in sync and remove the need to setAuthState manually in other places.
    if (session && isValidSession(session)) {
      setAuthState(AuthState.Authenticated);
    } else {
      setAuthState(AuthState.Unauthenticated);
    }
  }, [session]);

  useEffect(() => {
    // This will handle any redirect based oAuth. It then initializes the session. This is the last step before client is considered "ready"
    if (!client || !masterConfig) return;
    completeRedirectOauth().finally(() => {
      clearSessionTimeouts();

      // if auth or wallet connecting features are enabled, we want to fetch
      // the wallet providers to set the state
      if (
        masterConfig.walletConfig?.features?.auth ||
        masterConfig.walletConfig?.features?.connecting
      ) {
        fetchWalletProviders();
      }

      initializeSessions().finally(() => {
        // Set the client state to ready only after all initializations are done.
        setClientState(ClientState.Ready);
      });
    });

    return () => {
      clearSessionTimeouts();
    };
  }, [client]);

  return (
    <ClientContext.Provider
      value={{
        session,
        allSessions,
        clientState,
        authState,
        user,
        wallets,
        walletProviders,
        config: masterConfig,
        httpClient: client?.httpClient,
        createHttpClient,
        createPasskey,
        logout,
        loginWithPasskey,
        signUpWithPasskey,
        fetchWalletProviders,
        connectWalletAccount,
        disconnectWalletAccount,
        switchWalletAccountChain,
        buildWalletLoginRequest,
        loginWithWallet,
        signUpWithWallet,
        loginOrSignupWithWallet,
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
        fetchPrivateKeys,
        refreshWallets,
        signMessage,
        signTransaction,
        ethSendTransaction,
        signAndSendTransaction,
        pollTransactionStatus,
        fetchUser,
        fetchOrCreateP256ApiKeyUser,
        fetchOrCreatePolicies,
        refreshUser,
        updateUserEmail,
        removeUserEmail,
        updateUserPhoneNumber,
        removeUserPhoneNumber,
        updateUserName,
        addOauthProvider,
        removeOauthProviders,
        addPasskey,
        removePasskeys,
        createWallet,
        createWalletAccounts,
        exportWallet,
        exportPrivateKey,
        exportWalletAccount,
        importWallet,
        importPrivateKey,
        deleteSubOrganization,
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
        getProxyAuthConfig,
        fetchBootProofForAppProof,
        verifyAppProofs,
        handleLogin,
        handleGoogleOauth,
        handleXOauth,
        handleDiscordOauth,
        handleAppleOauth,
        handleFacebookOauth,
        handleExportWallet,
        handleExportPrivateKey,
        handleExportWalletAccount,
        handleImportWallet,
        handleImportPrivateKey,
        handleUpdateUserEmail,
        handleUpdateUserPhoneNumber,
        handleUpdateUserName,
        handleAddOauthProvider,
        handleRemoveOauthProvider,
        handleAddPasskey,
        handleRemovePasskey,
        handleAddEmail,
        handleAddPhoneNumber,
        handleSignMessage,
        handleConnectExternalWallet,
        handleRemoveUserEmail,
        handleRemoveUserPhoneNumber,
        handleVerifyAppProofs,
        handleOnRamp,
        handleSendTransaction,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
};
