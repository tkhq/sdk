"use client";

import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import {
  APPLE_AUTH_URL,
  DISCORD_AUTH_URL,
  exchangeCodeForToken,
  FACEBOOK_AUTH_URL,
  generateChallengePair,
  GOOGLE_AUTH_URL,
  handleFacebookPKCEFlow,
  isValidSession,
  parseOAuthRedirect,
  popupHeight,
  popupWidth,
  SESSION_WARNING_THRESHOLD_MS,
  useDebouncedCallback,
  useWalletProviderState,
  withTurnkeyErrorHandling,
  X_AUTH_URL,
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
  TurnkeyClient,
  WalletInterfaceType,
  WalletProvider,
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
  type SignAndSendTransactionParams,
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
  VerifyOtpResult,
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
import {
  faApple,
  faDiscord,
  faFacebook,
  faGoogle,
  faXTwitter,
} from "@fortawesome/free-brands-svg-icons";
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
  HandleRemoveOauthProviderParams,
  HandleRemovePasskeyParams,
  HandleRemoveUserEmailParams,
  HandleRemoveUserPhoneNumberParams,
  HandleSignMessageParams,
  HandleUpdateUserEmailParams,
  HandleUpdateUserNameParams,
  HandleUpdateUserPhoneNumberParams,
  HandleXOauthParams,
  RefreshUserParams,
  RefreshWalletsParams,
} from "../../types/method-types";

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
 * - Passkey, Wallet, OTP (Email/SMS), and OAuth (Google, Apple, Facebook) authentication and sign-up flows.
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
  const { isMobile, pushPage, closeModal } = useModal();

  const completeRedirectOauth = async () => {
    // Check for either hash or search parameters that could indicate an OAuth redirect
    if (window.location.hash || window.location.search) {
      // Handle Facebook redirect (uses search params with code)
      if (
        window.location.search &&
        window.location.search.includes("code=") &&
        window.location.search.includes("state=")
      ) {
        const searchParams = new URLSearchParams(
          window.location.search.substring(1),
        );
        const code = searchParams.get("code");
        const state = searchParams.get("state");

        // Parse state parameter
        if (state && code) {
          const stateParams = new URLSearchParams(state);
          const provider = stateParams.get("provider");
          const flow = stateParams.get("flow");
          const publicKey = stateParams.get("publicKey");
          const openModal = stateParams.get("openModal");
          const sessionKey = stateParams.get("sessionKey");

          if (provider === "facebook" && flow === "redirect" && publicKey) {
            // We have all the required parameters for a Facebook PKCE flow
            const clientId = masterConfig?.auth?.oauthConfig?.facebookClientId;
            const redirectURI =
              masterConfig?.auth?.oauthConfig?.oauthRedirectUri;

            if (clientId && redirectURI) {
              await handleFacebookPKCEFlow({
                code,
                publicKey,
                openModal,
                clientId,
                redirectURI,
                callbacks,
                completeOauth,
                onPushPage: (oidcToken) => {
                  return new Promise((resolve, reject) => {
                    pushPage({
                      key: `Facebook OAuth`,
                      content: (
                        <ActionPage
                          title={`Authenticating with Facebook...`}
                          action={async () => {
                            try {
                              await completeOauth({
                                oidcToken,
                                publicKey,
                                providerName: "facebook",
                                ...(sessionKey && { sessionKey }),
                              });
                              // Clean up the URL after processing
                              window.history.replaceState(
                                null,
                                document.title,
                                window.location.pathname,
                              );
                              resolve();
                            } catch (err) {
                              reject(err);
                            }
                          }}
                          icon={<FontAwesomeIcon size="3x" icon={faFacebook} />}
                        />
                      ),
                      showTitle: false,
                    });
                  });
                },
              }).catch((error) => {
                // Handle errors
                if (callbacks?.onError) {
                  callbacks.onError(
                    error instanceof TurnkeyError
                      ? error
                      : new TurnkeyError(
                          "Facebook authentication failed",
                          TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
                          error,
                        ),
                  );
                }
              });
            }
          }

          if (provider === "discord" && flow === "redirect" && publicKey) {
            const clientId = masterConfig?.auth?.oauthConfig?.discordClientId;
            const redirectURI =
              masterConfig?.auth?.oauthConfig?.oauthRedirectUri;
            const verifier = sessionStorage.getItem("discord_verifier");
            const nonce = stateParams.get("nonce");
            const sessionKey = stateParams.get("sessionKey");

            if (clientId && redirectURI && verifier && nonce) {
              await new Promise((resolve, reject) => {
                pushPage({
                  key: `Discord OAuth`,
                  content: (
                    <ActionPage
                      title={`Authenticating with Discord...`}
                      action={async () => {
                        try {
                          const resp =
                            await client?.httpClient.proxyOAuth2Authenticate({
                              provider: "OAUTH2_PROVIDER_DISCORD",
                              authCode: code,
                              redirectUri: redirectURI,
                              codeVerifier: verifier,
                              clientId,
                              nonce: nonce,
                            });

                          sessionStorage.removeItem("discord_verifier");

                          const oidcToken = resp?.oidcToken;
                          if (!oidcToken) {
                            throw new TurnkeyError(
                              "Missing OIDC token",
                              TurnkeyErrorCodes.OAUTH_LOGIN_ERROR,
                            );
                          }
                          await completeOauth({
                            oidcToken,
                            publicKey,
                            providerName: "discord",
                            ...(sessionKey && { sessionKey }),
                          });
                          // Clean up the URL after processing
                          window.history.replaceState(
                            null,
                            document.title,
                            window.location.pathname,
                          );
                          resolve(null);
                        } catch (err) {
                          reject(err);
                          if (callbacks?.onError) {
                            callbacks.onError(
                              err instanceof TurnkeyError
                                ? err
                                : new TurnkeyError(
                                    "Discord authentication failed",
                                    TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
                                    err,
                                  ),
                            );
                          }
                        }
                      }}
                      icon={<FontAwesomeIcon size="3x" icon={faDiscord} />}
                    />
                  ),
                  showTitle: false,
                });
              });
            }
          }
          if (provider === "twitter" && flow === "redirect" && publicKey) {
            const clientId = masterConfig?.auth?.oauthConfig?.xClientId;
            const redirectURI =
              masterConfig?.auth?.oauthConfig?.oauthRedirectUri;
            const verifier = sessionStorage.getItem("twitter_verifier");
            const nonce = stateParams.get("nonce");
            const sessionKey = stateParams.get("sessionKey");

            if (clientId && redirectURI && verifier && nonce) {
              await new Promise((resolve, reject) => {
                pushPage({
                  key: `Twitter OAuth`,
                  content: (
                    <ActionPage
                      title={`Authenticating with Twitter...`}
                      action={async () => {
                        try {
                          const resp =
                            await client?.httpClient.proxyOAuth2Authenticate({
                              provider: "OAUTH2_PROVIDER_X",
                              authCode: code,
                              redirectUri: redirectURI,
                              codeVerifier: verifier,
                              clientId,
                              nonce: nonce,
                            });

                          sessionStorage.removeItem("twitter_verifier");

                          const oidcToken = resp?.oidcToken;
                          if (!oidcToken) {
                            throw new TurnkeyError(
                              "Missing OIDC token",
                              TurnkeyErrorCodes.OAUTH_LOGIN_ERROR,
                            );
                          }
                          await completeOauth({
                            oidcToken,
                            publicKey,
                            providerName: "twitter",
                            ...(sessionKey && { sessionKey }),
                          });
                          // Clean up the URL after processing
                          window.history.replaceState(
                            null,
                            document.title,
                            window.location.pathname,
                          );
                          resolve(null);
                        } catch (err) {
                          reject(err);
                          if (callbacks?.onError) {
                            callbacks.onError(
                              err instanceof TurnkeyError
                                ? err
                                : new TurnkeyError(
                                    "Twitter authentication failed",
                                    TurnkeyErrorCodes.OAUTH_SIGNUP_ERROR,
                                    err,
                                  ),
                            );
                          }
                        }
                      }}
                      icon={<FontAwesomeIcon size="3x" icon={faXTwitter} />}
                    />
                  ),
                  showTitle: false,
                });
              });
            }
          }
        }
      }
      // Handle Google/Apple redirects (uses hash with id_token)
      else if (window.location.hash) {
        const hash = window.location.hash.substring(1);

        // Parse the hash using our helper functions
        const { idToken, provider, flow, publicKey, openModal, sessionKey } =
          parseOAuthRedirect(hash);

        if (idToken && flow === "redirect" && publicKey) {
          if (openModal === "true") {
            const providerName = provider
              ? provider.charAt(0).toUpperCase() + provider.slice(1)
              : "Provider";

            // Determine which icon to show based on the provider
            let icon;
            if (provider === "apple") {
              icon = <FontAwesomeIcon size="3x" icon={faApple} />;
            } else {
              // Default to Google icon
              icon = <FontAwesomeIcon size="3x" icon={faGoogle} />;
            }

            // This state is set when the OAuth flow comes from the AuthComponent
            await new Promise((resolve, reject) => {
              pushPage({
                key: `${providerName} OAuth`,
                content: (
                  <ActionPage
                    title={`Authenticating with ${providerName}...`}
                    action={async () => {
                      try {
                        await completeOauth({
                          oidcToken: idToken,
                          publicKey,
                          ...(provider ? { providerName: provider } : {}),
                          ...(sessionKey && { sessionKey }),
                        });
                        resolve(null);
                      } catch (err) {
                        reject(err);
                      }
                    }}
                    icon={icon}
                  />
                ),
                showTitle: false,
              });
            });
          } else if (callbacks?.onOauthRedirect) {
            callbacks.onOauthRedirect({ idToken, publicKey });
          } else {
            completeOauth({
              oidcToken: idToken,
              publicKey,
              ...(provider ? { providerName: provider } : {}),
            });
          }
          // Clean up the URL after processing
          window.history.replaceState(
            null,
            document.title,
            window.location.pathname + window.location.search,
          );
        }
      }
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
    // These are settings that can only be set via the auth proxy config
    const authProxyOnlySettings = {
      sessionExpirationSeconds: proxyAuthConfig?.sessionExpirationSeconds,
      otpAlphanumeric: proxyAuthConfig?.otpAlphanumeric ?? true, // This fallback will never be hit. This is purely for the tests to pass before mono is released
      otpLength: proxyAuthConfig?.otpLength ?? "6", // This fallback will never be hit. This is purely for the tests to pass before mono is released
    };

    return {
      ...config,

      // Overrides:
      auth: {
        ...config.auth,
        ...authProxyOnlySettings,
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
        await refreshUser();
        await refreshWallets();

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
  async function scheduleSessionExpiration(params: {
    sessionKey: string;
    expiry: number; // seconds since epoch
  }) {
    const { sessionKey, expiry } = params;

    try {
      const warnKey = `${sessionKey}-warning`;

      // Replace any prior timers for this session
      clearKey(expiryTimeoutsRef.current, sessionKey);
      clearKey(expiryTimeoutsRef.current, warnKey);

      const now = Date.now();
      const expiryMs = expiry * 1000;
      const timeUntilExpiry = expiryMs - now;

      const beforeExpiry = async () => {
        const activeSession = await getSession();

        if (!activeSession && expiryTimeoutsRef.current[warnKey]) {
          // Keep nudging until session materializes (short 10s timer is fine)
          setTimeoutInMap(
            expiryTimeoutsRef.current,
            warnKey,
            beforeExpiry,
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
        void beforeExpiry(); // fire-and-forget is fine
      } else {
        setCappedTimeoutInMap(
          expiryTimeoutsRef.current,
          warnKey,
          beforeExpiry,
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
  }) => {
    const { method, action, identifier } = params;
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

      await refreshWallets();
      await refreshUser();

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
        () => logout(),
        callbacks,
        "Failed to create passkey",
      );
    },
    [client, callbacks],
  );

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
        () => logout(),
        callbacks,
        "Failed to logout",
      );

      return;
    },
    [client, callbacks],
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
        });
      }
      return res;
    },
    [client, callbacks],
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
        });
      }
      return res;
    },
    [client, callbacks],
  );

  const fetchWalletProviders = useCallback(
    async (chain?: Chain): Promise<WalletProvider[]> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      const newProviders = await client.fetchWalletProviders(chain);

      // we update state with the latest providers
      // we keep this state so that initializeWalletProviderListeners() re-runs
      // whenever the list of connected providers changes
      // this ensures we attach disconnect listeners for each connected provider
      setWalletProviders(newProviders);

      return newProviders;
    },
    [client, callbacks],
  );

  const connectWalletAccount = useCallback(
    async (walletProvider: WalletProvider): Promise<void> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      await client.connectWalletAccount(walletProvider);

      // this will update our walletProvider state
      await refreshWallets();
    },
    [client, callbacks],
  );

  const disconnectWalletAccount = useCallback(
    async (walletProvider: WalletProvider): Promise<void> => {
      if (!client) {
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      }
      await client.disconnectWalletAccount(walletProvider);
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
      await client.switchWalletAccountChain({ ...params, walletProviders });
    },
    [client, callbacks],
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
        masterConfig?.auth?.sessionExpirationSeconds ??
        DEFAULT_SESSION_EXPIRATION_IN_SECONDS;
      const res = await withTurnkeyErrorHandling(
        () => client.loginWithWallet({ ...params, expirationSeconds }),
        () => logout(),
        callbacks,
        "Failed to login with wallet",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Wallet,
          action: AuthAction.LOGIN,
          identifier: res.address,
        });
      }
      return res;
    },
    [client, callbacks],
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
        masterConfig?.auth?.sessionExpirationSeconds ??
        DEFAULT_SESSION_EXPIRATION_IN_SECONDS;
      const res = await withTurnkeyErrorHandling(
        () => client.signUpWithWallet({ ...params, expirationSeconds }),
        () => logout(),
        callbacks,
        "Failed to sign up with wallet",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Wallet,
          action: AuthAction.SIGNUP,
          identifier: res.address,
        });
      }
      return res;
    },
    [client, callbacks, masterConfig],
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
        masterConfig?.auth?.sessionExpirationSeconds ??
        DEFAULT_SESSION_EXPIRATION_IN_SECONDS;
      const res = await withTurnkeyErrorHandling(
        () => client.loginOrSignupWithWallet({ ...params, expirationSeconds }),
        () => logout(),
        callbacks,
        "Failed to login or sign up with wallet",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Wallet,
          action: res.action,
          identifier: res.address,
        });
      }
      return res;
    },
    [client, callbacks, masterConfig],
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
        () => logout(),
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
        () => logout(),
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
        () => logout(),
        callbacks,
        "Failed to login with OTP",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Otp,
          action: AuthAction.LOGIN,
          identifier: params.verificationToken,
        });
      }
      return res;
    },
    [client, callbacks],
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
        () => logout(),
        callbacks,
        "Failed to sign up with OTP",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Otp,
          action: AuthAction.SIGNUP,
          identifier: params.verificationToken,
        });
      }
      return res;
    },
    [client, callbacks, masterConfig],
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
        () => logout(),
        callbacks,
        "Failed to complete OTP",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Otp,
          action: res.action,
          identifier: res.verificationToken,
        });
      }
      return res;
    },
    [client, callbacks, masterConfig],
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
        () => logout(),
        callbacks,
        "Failed to login with OAuth",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Oauth,
          action: AuthAction.LOGIN,
          identifier: params.oidcToken,
        });
      }
      return res;
    },
    [client, callbacks],
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
        () => logout(),
        callbacks,
        "Failed to sign up with OAuth",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Oauth,
          action: AuthAction.SIGNUP,
          identifier: params.oidcToken,
        });
      }
      return res;
    },
    [client, callbacks, masterConfig],
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
        () => logout(),
        callbacks,
        "Failed to complete OAuth",
      );
      if (res) {
        await handlePostAuth({
          method: AuthMethod.Oauth,
          action: res.action,
          identifier: params.oidcToken,
        });
      }
      return res;
    },
    [client, callbacks, masterConfig],
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
    [client, callbacks],
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
    [client, callbacks],
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
    [client, callbacks],
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
    [client, callbacks],
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
        });
      });
    },
    [client, callbacks],
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
    [client, callbacks],
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
        "Failed to sign transaction",
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
    [client, callbacks],
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
    [client, callbacks],
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
        await refreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks],
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
        await refreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks],
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
        await refreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks],
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
        await refreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks],
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
        await refreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks],
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
        await refreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks],
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
        await refreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks],
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
        await refreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks],
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
        await refreshUser({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks],
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
        await refreshWallets({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
        });
      return res;
    },
    [client, session, callbacks],
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
        await refreshWallets({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
        });
      return res;
    },
    [client, session, callbacks],
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
        await refreshWallets({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
        });
      return res;
    },
    [client, session, callbacks],
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
    [client, callbacks],
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
        await refreshWallets({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
        });
      return res;
    },
    [client, callbacks, masterConfig, session, user],
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
        await refreshWallets({
          stampWith: params?.stampWith,
          ...(params?.organizationId && {
            organizationId: params.organizationId,
          }),
          ...(params?.userId && { userId: params.userId }),
        });
      return res;
    },
    [client, callbacks, masterConfig, session, user],
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
    [client, callbacks, masterConfig, session, user],
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
    [client, callbacks, masterConfig, session, user],
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
      return;
    },
    [client, callbacks, masterConfig, session, user],
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
        () => logout(),
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
    [client, callbacks, session, user, masterConfig],
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
  }, [client, callbacks, session, user, masterConfig]);

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
          ...(params?.expirationSeconds && {
            expirationSeconds: params?.expirationSeconds,
          }),
        });
      }

      const allSessions = await getAllSessions();
      setSession(session);
      setAllSessions(allSessions);
      return res;
    },
    [client, callbacks, scheduleSessionExpiration, session, user, masterConfig],
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
        () => logout(),
        callbacks,
        "Failed to get session",
      );
    },
    [client, callbacks, masterConfig, session, user],
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
      () => logout(),
      callbacks,
      "Failed to get all sessions",
    );
  }, [client, callbacks, masterConfig, session, user]);

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
          await refreshWallets();
          await refreshUser();
        },
        () => logout(),
        callbacks,
        "Failed to refresh data after setting active session",
      );
      return;
    },
    [client, callbacks, session, user, masterConfig],
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
      () => logout(),
      callbacks,
      "Failed to get active session key",
    );
  }, [client, callbacks, masterConfig, session, user]);

  const clearUnusedKeyPairs = useCallback(async (): Promise<void> => {
    if (!client)
      throw new TurnkeyError(
        "Client is not initialized.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    return withTurnkeyErrorHandling(
      () => client.clearUnusedKeyPairs(),
      () => logout(),
      callbacks,
      "Failed to clear unused key pairs",
    );
  }, [client, callbacks, masterConfig, session, user]);

  const createApiKeyPair = useCallback(
    async (params?: CreateApiKeyPairParams): Promise<string> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      return withTurnkeyErrorHandling(
        () => client.createApiKeyPair(params),
        () => logout(),
        callbacks,
        "Failed to create API key pair",
      );
    },
    [client, callbacks, session, user, masterConfig],
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
        () => logout(),
        callbacks,
        "Failed to get proxy auth config",
      );
    }, [client, callbacks, masterConfig, session, user]);

  const refreshUser = useCallback(
    async (params?: RefreshUserParams): Promise<void> => {
      if (!masterConfig?.autoRefreshManagedState) return;
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
    [client, callbacks, fetchUser, masterConfig, session, user],
  );

  const refreshWallets = useCallback(
    async (params?: RefreshWalletsParams): Promise<void> => {
      if (!masterConfig?.autoRefreshManagedState) return;
      const { stampWith, organizationId, userId } = params || {};
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const walletProviders = await withTurnkeyErrorHandling(
        () => fetchWalletProviders(),
        () => logout(),
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
    },
    [
      client,
      callbacks,
      fetchWalletProviders,
      fetchWallets,
      masterConfig,
      session,
      user,
    ],
  );

  const handleDiscordOauth = useCallback(
    async (params?: HandleDiscordOauthParams): Promise<void> => {
      const {
        clientId = masterConfig?.auth?.oauthConfig?.discordClientId,
        openInPage = masterConfig?.auth?.oauthConfig?.openOauthInPage ?? false,
        additionalState: additionalParameters,
      } = params || {};
      try {
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
        const redirectURI = masterConfig.auth?.oauthConfig.oauthRedirectUri;

        // Create key pair and generate nonce
        const publicKey = await createApiKeyPair();
        if (!publicKey) {
          throw new Error("Failed to create public key for OAuth.");
        }
        const nonce = bytesToHex(sha256(publicKey));

        // Generate PKCE challenge pair
        const { verifier, codeChallenge } = await generateChallengePair();
        sessionStorage.setItem("discord_verifier", verifier);

        // Construct Discord Auth URL
        const discordAuthUrl = new URL(DISCORD_AUTH_URL);
        discordAuthUrl.searchParams.set("client_id", clientId);
        discordAuthUrl.searchParams.set("redirect_uri", redirectURI);
        discordAuthUrl.searchParams.set("response_type", "code");
        discordAuthUrl.searchParams.set("code_challenge", codeChallenge);
        discordAuthUrl.searchParams.set("code_challenge_method", "S256");
        discordAuthUrl.searchParams.set("scope", "identify email");
        discordAuthUrl.searchParams.set(
          "state",
          `provider=discord&flow=${flow}&publicKey=${encodeURIComponent(publicKey)}&nonce=${nonce}`,
        );

        if (additionalParameters) {
          const extra = Object.entries(additionalParameters)
            .map(
              ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
            )
            .join("&");
          if (extra) {
            discordAuthUrl.searchParams.set(
              "state",
              discordAuthUrl.searchParams.get("state")! + `&${extra}`,
            );
          }
        }

        if (openInPage) {
          window.location.href = discordAuthUrl.toString();
          return new Promise((_, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error("Authentication timed out."));
            }, 300000);
            window.addEventListener("beforeunload", () =>
              clearTimeout(timeout),
            );
          });
        } else {
          const width = popupWidth;
          const height = popupHeight;
          const left = window.screenX + (window.innerWidth - width) / 2;
          const top = window.screenY + (window.innerHeight - height) / 2;

          const authWindow = window.open(
            "about:blank",
            "_blank",
            `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`,
          );

          if (!authWindow) {
            throw new Error("Failed to open Discord login window.");
          }

          authWindow.location.href = discordAuthUrl.toString();

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
                  const urlParams = new URLSearchParams(new URL(url).search);
                  const authCode = urlParams.get("code");
                  const stateParam = urlParams.get("state");
                  const sessionKey = stateParam
                    ?.split("&")
                    .find((param) => param.startsWith("sessionKey="))
                    ?.split("=")[1];
                  if (
                    authCode &&
                    stateParam &&
                    stateParam.includes("provider=discord")
                  ) {
                    authWindow.close();
                    clearInterval(interval);

                    const verifier = sessionStorage.getItem("discord_verifier");
                    if (!verifier) {
                      reject(new Error("Missing PKCE verifier"));
                      return;
                    }

                    client?.httpClient
                      .proxyOAuth2Authenticate({
                        provider: "OAUTH2_PROVIDER_DISCORD",
                        authCode,
                        redirectUri: redirectURI,
                        codeVerifier: verifier,
                        clientId,
                        nonce: nonce,
                      })
                      .then((resp) => {
                        sessionStorage.removeItem("discord_verifier");

                        const oidcToken = resp.oidcToken;
                        if (params?.onOauthSuccess) {
                          params.onOauthSuccess({
                            oidcToken,
                            providerName: "discord",
                            ...(sessionKey && { sessionKey }),
                          });
                        } else if (callbacks?.onOauthRedirect) {
                          callbacks.onOauthRedirect({
                            idToken: oidcToken,
                            publicKey,
                            ...(sessionKey && { sessionKey }),
                          });
                        } else {
                          completeOauth({
                            oidcToken,
                            publicKey,
                            providerName: "discord",
                            ...(sessionKey && { sessionKey }),
                          })
                            .then(() => resolve())
                            .catch(reject);
                          return;
                        }
                        resolve();
                      })
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
        }
      } catch (error) {
        throw error;
      }
    },
    [
      client,
      callbacks,
      completeOauth,
      createApiKeyPair,
      masterConfig,
      session,
      user,
    ],
  );

  const handleXOauth = useCallback(
    async (params?: HandleXOauthParams): Promise<void> => {
      const {
        clientId = masterConfig?.auth?.oauthConfig?.xClientId,
        openInPage = masterConfig?.auth?.oauthConfig?.openOauthInPage ?? false,
        additionalState: additionalParameters,
      } = params || {};
      try {
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
        const redirectURI = masterConfig.auth?.oauthConfig.oauthRedirectUri;

        // Create key pair and generate nonce
        const publicKey = await createApiKeyPair();
        if (!publicKey) {
          throw new Error("Failed to create public key for OAuth.");
        }
        const nonce = bytesToHex(sha256(publicKey));

        // Generate PKCE challenge pair
        const { verifier, codeChallenge } = await generateChallengePair();
        sessionStorage.setItem("twitter_verifier", verifier);

        // Construct Twitter Auth URL
        const twitterAuthUrl = new URL(X_AUTH_URL);
        twitterAuthUrl.searchParams.set("client_id", clientId);
        twitterAuthUrl.searchParams.set("redirect_uri", redirectURI);
        twitterAuthUrl.searchParams.set("response_type", "code");
        twitterAuthUrl.searchParams.set("code_challenge", codeChallenge);
        twitterAuthUrl.searchParams.set("code_challenge_method", "S256");
        twitterAuthUrl.searchParams.set("scope", "tweet.read users.read");
        twitterAuthUrl.searchParams.set(
          "state",
          `provider=twitter&flow=${flow}&publicKey=${encodeURIComponent(publicKey)}&nonce=${nonce}`,
        );

        if (additionalParameters) {
          const extra = Object.entries(additionalParameters)
            .map(
              ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
            )
            .join("&");
          if (extra) {
            twitterAuthUrl.searchParams.set(
              "state",
              twitterAuthUrl.searchParams.get("state")! + `&${extra}`,
            );
          }
        }

        if (openInPage) {
          window.location.href = twitterAuthUrl.toString();
          return new Promise((_, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error("Authentication timed out."));
            }, 300000);
            window.addEventListener("beforeunload", () =>
              clearTimeout(timeout),
            );
          });
        } else {
          const width = popupWidth;
          const height = popupHeight;
          const left = window.screenX + (window.innerWidth - width) / 2;
          const top = window.screenY + (window.innerHeight - height) / 2;

          const authWindow = window.open(
            "about:blank",
            "_blank",
            `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`,
          );

          if (!authWindow) {
            throw new Error("Failed to open Twitter login window.");
          }

          authWindow.location.href = twitterAuthUrl.toString();

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
                  const urlParams = new URLSearchParams(new URL(url).search);
                  const authCode = urlParams.get("code");
                  const stateParam = urlParams.get("state");
                  const sessionKey = stateParam
                    ?.split("&")
                    .find((param) => param.startsWith("sessionKey="))
                    ?.split("=")[1];
                  if (
                    authCode &&
                    stateParam &&
                    stateParam.includes("provider=twitter")
                  ) {
                    authWindow.close();
                    clearInterval(interval);

                    const verifier = sessionStorage.getItem("twitter_verifier");
                    if (!verifier) {
                      reject(new Error("Missing PKCE verifier"));
                      return;
                    }

                    client?.httpClient
                      .proxyOAuth2Authenticate({
                        provider: "OAUTH2_PROVIDER_X",
                        authCode,
                        redirectUri: redirectURI,
                        codeVerifier: verifier,
                        clientId,
                        nonce,
                      })
                      .then((resp) => {
                        sessionStorage.removeItem("twitter_verifier");

                        const oidcToken = resp.oidcToken;
                        if (params?.onOauthSuccess) {
                          params.onOauthSuccess({
                            oidcToken,
                            providerName: "twitter",
                            ...(sessionKey && { sessionKey }),
                          });
                        } else if (callbacks?.onOauthRedirect) {
                          callbacks.onOauthRedirect({
                            idToken: oidcToken,
                            publicKey,
                            ...(sessionKey && { sessionKey }),
                          });
                        } else {
                          completeOauth({
                            oidcToken,
                            publicKey,
                            providerName: "twitter",
                            ...(sessionKey && { sessionKey }),
                          })
                            .then(() => resolve())
                            .catch(reject);
                          return;
                        }
                        resolve();
                      })
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
        }
      } catch (error) {
        throw error;
      }
    },
    [client, callbacks, masterConfig, session, user],
  );

  const handleGoogleOauth = useCallback(
    async (params?: HandleGoogleOauthParams): Promise<void> => {
      const {
        clientId = masterConfig?.auth?.oauthConfig?.googleClientId,
        openInPage = masterConfig?.auth?.oauthConfig?.openOauthInPage ?? false,
        additionalState: additionalParameters,
      } = params || {};
      try {
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
        const redirectURI =
          masterConfig.auth?.oauthConfig.oauthRedirectUri.replace(/\/$/, "");

        // Create key pair and generate nonce
        const publicKey = await createApiKeyPair();
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
                `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
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
            window.addEventListener("beforeunload", () =>
              clearTimeout(timeout),
            );
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
            `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`,
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
                  const stateParams = hashParams.get("state");
                  const sessionKey = stateParams
                    ?.split("&")
                    .find((param) => param.startsWith("sessionKey="))
                    ?.split("=")[1];
                  if (idToken) {
                    authWindow.close();
                    clearInterval(interval);

                    if (params?.onOauthSuccess) {
                      params.onOauthSuccess({
                        oidcToken: idToken,
                        providerName: "google",
                        ...(sessionKey && { sessionKey }),
                      });
                    } else if (callbacks?.onOauthRedirect) {
                      callbacks.onOauthRedirect({
                        idToken,
                        publicKey,
                        ...(sessionKey && { sessionKey }),
                      });
                    } else {
                      completeOauth({
                        oidcToken: idToken,
                        publicKey,
                        providerName: "google",
                        ...(sessionKey && { sessionKey }),
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

            if (authWindow.closed) {
              clearInterval(interval);
            }
          });
        }
      } catch (error) {
        throw error;
      }
    },
    [client, callbacks, masterConfig, session, user],
  );

  const handleAppleOauth = useCallback(
    async (params?: HandleAppleOauthParams): Promise<void> => {
      const {
        clientId = masterConfig?.auth?.oauthConfig?.appleClientId,
        openInPage = masterConfig?.auth?.oauthConfig?.openOauthInPage ?? false,
        additionalState: additionalParameters,
      } = params || {};
      try {
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
        const redirectURI = masterConfig.auth?.oauthConfig.oauthRedirectUri; // TODO (Amir): Apple needs the '/' at the end. Maybe we should add it if not there?

        // Create key pair and generate nonce
        const publicKey = await createApiKeyPair();
        if (!publicKey) {
          throw new Error("Failed to create public key for OAuth.");
        }
        const nonce = bytesToHex(sha256(publicKey));

        // Construct Apple Auth URL
        const appleAuthUrl = new URL(APPLE_AUTH_URL);
        appleAuthUrl.searchParams.set("client_id", clientId);
        appleAuthUrl.searchParams.set("redirect_uri", redirectURI);
        appleAuthUrl.searchParams.set("response_type", "code id_token");
        appleAuthUrl.searchParams.set("response_mode", "fragment");
        appleAuthUrl.searchParams.set("nonce", nonce);

        // Create state parameter
        let state = `provider=apple&flow=${flow}&publicKey=${encodeURIComponent(publicKey)}`;
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
        appleAuthUrl.searchParams.set("state", state);

        if (openInPage) {
          // Redirect current page to Apple Auth
          window.location.href = appleAuthUrl.toString();
          return new Promise((_, reject) => {
            // Set a timeout just in case the redirect doesn't happen
            const timeout = setTimeout(() => {
              reject(new Error("Authentication timed out."));
            }, 300000); // 5 minutes

            // If the page is unloaded (user navigates away), clear the timeout
            window.addEventListener("beforeunload", () =>
              clearTimeout(timeout),
            );
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
            `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`,
          );

          if (!authWindow) {
            throw new Error("Failed to open Apple login window.");
          }

          authWindow.location.href = appleAuthUrl.toString();

          // Return a promise that resolves when the OAuth flow completes
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
                  const stateParams = hashParams.get("state");
                  const sessionKey = stateParams
                    ?.split("&")
                    .find((param) => param.startsWith("sessionKey="))
                    ?.split("=")[1];
                  if (idToken) {
                    authWindow.close();
                    clearInterval(interval);

                    if (params?.onOauthSuccess) {
                      params.onOauthSuccess({
                        oidcToken: idToken,
                        providerName: "apple",
                        ...(sessionKey && { sessionKey }),
                      });
                    } else if (callbacks?.onOauthRedirect) {
                      callbacks.onOauthRedirect({
                        idToken,
                        publicKey,
                        ...(sessionKey && { sessionKey }),
                      });
                    } else {
                      completeOauth({
                        oidcToken: idToken,
                        publicKey,
                        providerName: "apple",
                        ...(sessionKey && { sessionKey }),
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

            if (authWindow.closed) {
              clearInterval(interval);
            }
          });
        }
      } catch (error) {
        throw error;
      }
    },
    [client, callbacks, masterConfig, session, user],
  );

  const handleFacebookOauth = useCallback(
    async (params?: HandleFacebookOauthParams): Promise<void> => {
      const {
        clientId = masterConfig?.auth?.oauthConfig?.facebookClientId,
        openInPage = masterConfig?.auth?.oauthConfig?.openOauthInPage ?? false,
        additionalState: additionalParameters,
      } = params || {};
      try {
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
        const redirectURI = masterConfig.auth?.oauthConfig.oauthRedirectUri;

        // Create key pair and generate nonce
        const publicKey = await createApiKeyPair();
        if (!publicKey) {
          throw new Error("Failed to create public key for OAuth.");
        }
        const nonce = bytesToHex(sha256(publicKey));

        // Generate PKCE challenge pair
        const { verifier, codeChallenge } = await generateChallengePair();
        // Store verifier for later token exchange
        sessionStorage.setItem("facebook_verifier", verifier);

        // Construct Facebook Auth URL
        const facebookAuthUrl = new URL(FACEBOOK_AUTH_URL);
        facebookAuthUrl.searchParams.set("client_id", clientId);
        facebookAuthUrl.searchParams.set("redirect_uri", redirectURI);
        facebookAuthUrl.searchParams.set("response_type", "code");
        facebookAuthUrl.searchParams.set("code_challenge", codeChallenge);
        facebookAuthUrl.searchParams.set("code_challenge_method", "S256");
        facebookAuthUrl.searchParams.set("nonce", nonce);
        facebookAuthUrl.searchParams.set("scope", "openid");

        // Create state parameter
        let state = `provider=facebook&flow=${flow}&publicKey=${encodeURIComponent(publicKey)}`;
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
        facebookAuthUrl.searchParams.set("state", state);

        if (openInPage) {
          // Redirect current page to Facebook Auth
          window.location.href = facebookAuthUrl.toString();
          return new Promise((_, reject) => {
            // Set a timeout just in case the redirect doesn't happen
            const timeout = setTimeout(() => {
              reject(new Error("Authentication timed out."));
            }, 300000); // 5 minutes

            // If the page is unloaded (user navigates away), clear the timeout
            window.addEventListener("beforeunload", () =>
              clearTimeout(timeout),
            );
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
            `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`,
          );

          if (!authWindow) {
            throw new Error("Failed to open Facebook login window.");
          }

          authWindow.location.href = facebookAuthUrl.toString();

          // Return a promise that resolves when the OAuth flow completes
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
                  const urlParams = new URLSearchParams(new URL(url).search);
                  const authCode = urlParams.get("code");
                  const stateParam = urlParams.get("state");
                  if (
                    authCode &&
                    stateParam &&
                    stateParam.includes("provider=facebook")
                  ) {
                    const sessionKey = stateParam
                      ?.split("&")
                      .find((param) => param.startsWith("sessionKey="))
                      ?.split("=")[1];
                    authWindow.close();
                    clearInterval(interval);

                    // Exchange code for token
                    const verifier =
                      sessionStorage.getItem("facebook_verifier");
                    if (!verifier) {
                      reject(new Error("Missing PKCE verifier"));
                      return;
                    }

                    exchangeCodeForToken(
                      clientId,
                      redirectURI,
                      authCode,
                      verifier,
                    )
                      .then((tokenData) => {
                        sessionStorage.removeItem("facebook_verifier");

                        if (params?.onOauthSuccess) {
                          params.onOauthSuccess({
                            oidcToken: tokenData.id_token,
                            providerName: "facebook",
                            ...(sessionKey && { sessionKey }),
                          });
                        } else if (callbacks?.onOauthRedirect) {
                          callbacks.onOauthRedirect({
                            idToken: tokenData.id_token,
                            publicKey,
                            ...(sessionKey && { sessionKey }),
                          });
                        } else {
                          completeOauth({
                            oidcToken: tokenData.id_token,
                            publicKey,
                            providerName: "facebook",
                            ...(sessionKey && { sessionKey }),
                          })
                            .then(() => resolve())
                            .catch(reject);
                          return;
                        }
                        resolve();
                      })
                      .catch(reject);
                  }
                }
              } catch (error) {
                // Ignore cross-origin errors
              }
            }, 500);

            if (authWindow.closed) {
              clearInterval(interval);
            }
          });
        }
      } catch (error) {
        throw error;
      }
    },
    [client, callbacks, masterConfig, client, session, user],
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
    [pushPage, masterConfig, client, session, user],
  );

  const handleExportWallet = useCallback(
    async (params: HandleExportWalletParams) => {
      const { walletId, targetPublicKey, stampWith, organizationId } = params;
      pushPage({
        key: "Export wallet",
        content: (
          <ExportComponent
            target={walletId}
            exportType={ExportType.Wallet}
            {...(targetPublicKey !== undefined && { targetPublicKey })}
            {...(stampWith !== undefined && { stampWith })}
            {...(organizationId !== undefined && { organizationId })}
          />
        ),
      });
    },
    [pushPage, masterConfig, client, session, user],
  );

  const handleExportPrivateKey = useCallback(
    async (params: HandleExportPrivateKeyParams) => {
      const {
        privateKeyId,
        targetPublicKey,
        keyFormat,
        stampWith,
        organizationId,
      } = params;
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
          />
        ),
      });
    },
    [pushPage, masterConfig, client, session, user],
  );

  const handleExportWalletAccount = useCallback(
    async (params: HandleExportWalletAccountParams) => {
      const { address, targetPublicKey, keyFormat, stampWith, organizationId } =
        params;
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
          />
        ),
      });
    },
    [pushPage, masterConfig, client, session, user],
  );

  const handleImportWallet = useCallback(
    async (params?: HandleImportWalletParams): Promise<string> => {
      const {
        defaultWalletAccounts,
        successPageDuration = 2000,
        stampWith,
        walletName,
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
    [pushPage, masterConfig, client, session, user],
  );

  const handleImportPrivateKey = useCallback(
    async (params?: HandleImportPrivateKeyParams): Promise<string> => {
      const {
        curve,
        addressFormats,
        successPageDuration = 2000,
        stampWith,
        keyName,
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
                    onError={(error: unknown) => {
                      reject(error);
                    }}
                    onSuccess={(privateKeyId: string) => resolve(privateKeyId)}
                    {...(successPageDuration !== undefined && {
                      successPageDuration,
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
    [pushPage, masterConfig, client, session, user],
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
            userId: user!.userId,
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
    [pushPage, masterConfig, client, session, user],
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
    [pushPage, masterConfig, client, session, user],
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
    [pushPage, masterConfig, client, session, user],
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
    [pushPage, client, session, user],
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
                            userId: user!.userId,
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
    [pushPage, masterConfig, client, session, user],
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
    [pushPage, masterConfig, client, session, user],
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
    [pushPage, masterConfig, client, session, user],
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
    [pushPage, masterConfig, client, session, user],
  );

  const handleAddOauthProvider = useCallback(
    async (params: HandleAddOauthProviderParams): Promise<void> => {
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const { providerName, stampWith, successPageDuration = 2000 } = params;
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

      switch (providerName) {
        case OAuthProviders.DISCORD: {
          await handleDiscordOauth({
            openInPage: false,
            onOauthSuccess,
          });
          break;
        }
        case OAuthProviders.X: {
          await handleXOauth({
            openInPage: false,
            onOauthSuccess,
          });
          break;
        }
        case OAuthProviders.GOOGLE: {
          await handleGoogleOauth({
            openInPage: false,
            onOauthSuccess,
          });
          break;
        }
        case OAuthProviders.APPLE: {
          await handleAppleOauth({
            openInPage: false,
            onOauthSuccess,
          });
          break;
        }
        case OAuthProviders.FACEBOOK: {
          await handleFacebookOauth({
            openInPage: false,
            onOauthSuccess,
          });
          break;
        }
        default: {
          throw new TurnkeyError(
            `Unsupported OAuth provider: ${providerName}`,
            TurnkeyErrorCodes.NOT_FOUND,
          );
        }
      }
    },
    [pushPage, masterConfig, client, session, user],
  );

  const handleConnectExternalWallet = useCallback(
    async (params?: HandleConnectExternalWalletParams): Promise<void> => {
      const { successPageDuration = 2000 } = params || {};
      if (!client)
        throw new TurnkeyError(
          "Client is not initialized.",
          TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
        );
      const s = await getSession();
      if (!s) {
        throw new TurnkeyError(
          "No active session found.",
          TurnkeyErrorCodes.NO_SESSION_FOUND,
        );
      }
      if (!masterConfig?.walletConfig?.features?.connecting) {
        throw new TurnkeyError(
          "Wallet connecting is not enabled.",
          TurnkeyErrorCodes.FEATURE_NOT_ENABLED,
        );
      }

      const providers = await fetchWalletProviders();

      return new Promise((resolve, reject) => {
        pushPage({
          key: "Connect wallet",
          content: (
            <ConnectWalletModal
              providers={providers}
              successPageDuration={successPageDuration}
              onSuccess={() => {
                resolve();
              }}
              onError={(error) => {
                reject(error);
              }}
            />
          ),
        });
      });
    },
    [pushPage, masterConfig, client, session, user],
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
    [pushPage, masterConfig, client, session, user],
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
    [pushPage, masterConfig, client, session, user],
  );

  useEffect(() => {
    if (proxyAuthConfigRef.current) return;

    // Only fetch the proxy auth config once. Use that to build the master config.
    const fetchProxyAuthConfig = async () => {
      try {
        let proxyAuthConfig: ProxyTGetWalletKitConfigResponse | undefined;
        if (config.authProxyConfigId) {
          // Only fetch the proxy auth config if we have an authProxyId. This is a way for devs to explicitly disable the proxy auth.
          proxyAuthConfig = await getAuthProxyConfig(
            config.authProxyConfigId,
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
    // If the proxyAuthConfigRef is already set, we don't need to fetch it again. Rebuild the master config with the updated config and stored proxyAuthConfig
    if (!proxyAuthConfigRef.current && config.authProxyConfigId) return;

    setMasterConfig(buildConfig(proxyAuthConfigRef.current ?? undefined));
  }, [config, proxyAuthConfigRef.current]);

  /**
   * @internal
   * We create `debouncedRefreshWallets()` so that multiple rapid wallet events
   * (for example, on Solana a single disconnect can emit several events we listen for)
   * only trigger `refreshWallets()` once.
   *
   * Defining the debounced function outside of the `useEffect` ensures all event
   * listeners in `initializeWalletProviderListeners` share the same instance, instead of creating
   * a new one on every render.
   */
  const debouncedRefreshWallets = useDebouncedCallback(refreshWallets, 100);
  const debouncedFetchWalletProviders = useDebouncedCallback(
    fetchWalletProviders,
    100,
  );

  useEffect(() => {
    if (!client) return;

    const handleUpdateState = async () => {
      // we only refresh the wallets if there is an active session
      // this is needed because a disconnect event can occur
      // while the user is unauthenticated
      //
      // WalletProviders state is updated regardless of session state
      if (session) {
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
  }, [client, walletProviders, session]);

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
        createPasskey,
        logout,
        loginWithPasskey,
        signUpWithPasskey,
        fetchWalletProviders,
        connectWalletAccount,
        disconnectWalletAccount,
        switchWalletAccountChain,
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
        signAndSendTransaction,
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
      }}
    >
      {children}
    </ClientContext.Provider>
  );
};
