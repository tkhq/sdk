import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faApple,
  faDiscord,
  faFacebook,
  faGoogle,
  faXTwitter,
} from "@fortawesome/free-brands-svg-icons";
import { OtpType, type WalletProvider } from "@turnkey/core";
import { faEllipsisH, faFingerprint } from "@fortawesome/free-solid-svg-icons";
import clsx from "clsx";
import { OAuthButton } from "./OAuth";
import { EmailInput } from "./Email";
import { OrSeparator } from "./OrSeparator";
import { OtpVerification } from "./OTP";
import { PhoneNumberInput } from "./Phone";
import { ActionPage } from "./Action";
import { PasskeyButtons } from "./Passkey";
import { Spinner } from "../design/Spinners";
import {
  ExternalWalletSelector,
  WalletAuthButton,
  WalletConnectScreen,
} from "./Wallet";
import { DeveloperError } from "../design/Failure";
import { useModal } from "../../providers/modal/Hook";
import { useTurnkey } from "../../providers/client/Hook";
import { ClientState } from "../../types/base";
import { isWalletConnect } from "../../utils/utils";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useRef, useState } from "react";
import { consumeCaptchaToken } from "../../utils/captcha";

type AuthComponentProps = {
  sessionKey?: string | undefined;
  logo?: string | undefined;
  logoClassName?: string | undefined;
  title?: string | undefined;
};

export function AuthComponent({
  sessionKey,
  logo,
  logoClassName,
  title,
}: AuthComponentProps) {
  const {
    config,
    clientState,
    handleGoogleOauth,
    handleAppleOauth,
    handleFacebookOauth,
    handleXOauth,
    handleDiscordOauth,
    initOtp,
    loginWithPasskey,
    signUpWithPasskey,
    loginOrSignupWithWallet,
    disconnectWalletAccount,
    getTurnstileToken,
    setTurnstileToken,
  } = useTurnkey();
  const { pushPage, isMobile, openSheet } = useModal();

  const turnstileRef = useRef<TurnstileInstance>(null);
  const [showTurnstilePrompt, setShowTurnstilePrompt] = useState(false);
  // If a token already existed when the component mounted, we don't need to show the widget at all
  const [hadTokenOnMount] = useState(() => !!getTurnstileToken());
  // Auth is enabled immediately if no turnstile is configured, or if the Provider already has a token

  const [showTurnstileError, setShowTurnstileError] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(
    !config?.turnstileSiteKey || hadTokenOnMount,
  );

  if (!config || clientState === ClientState.Loading) {
    // Don't check ClientState.Error here. We already check in the modal root
    return (
      <div className="flex flex-col items-center w-96 py-5">
        <Spinner strokeWidth={2} className="w-48 h-48" />
      </div>
    );
  }

  const { methods = {}, methodOrder = [], oauthOrder = [] } = config.auth || {};

  const consumeToken = () =>
    consumeCaptchaToken(getTurnstileToken, setTurnstileToken, turnstileRef);

  const handleEmailSubmit = async (email: string) => {
    try {
      const otpId = await initOtp({
        otpType: OtpType.Email,
        contact: email,
        ...(await consumeToken()),
      });
      pushPage({
        key: "Verify OTP",
        content: (
          <OtpVerification
            contact={email}
            otpId={otpId}
            otpType={OtpType.Email}
            otpLength={
              config.auth?.otpLength !== undefined
                ? Number(config.auth.otpLength)
                : undefined
            }
            alphanumeric={config.auth?.otpAlphanumeric}
            {...(sessionKey && { sessionKey })}
          />
        ),
        showTitle: false,
      });
    } catch (error) {
      throw new Error(`Error initializing OTP: ${error}`);
    }
  };

  const handlePhoneSubmit = async (phone: string, formattedPhone: string) => {
    try {
      const otpId = await initOtp({
        otpType: OtpType.Sms,
        contact: phone,
        ...(await consumeToken()),
      });
      pushPage({
        key: "Verify OTP",
        content: (
          <OtpVerification
            contact={phone}
            // Pass in the formatted phone number seperately. In the case that some weird formatting occurs, we don't want to send it into the initOtp request
            formattedContact={formattedPhone}
            otpId={otpId}
            otpType={OtpType.Sms}
            otpLength={
              config.auth?.otpLength !== undefined
                ? Number(config.auth.otpLength)
                : undefined
            }
            alphanumeric={config.auth?.otpAlphanumeric}
            {...(sessionKey && { sessionKey })}
          />
        ),
        showTitle: false,
      });
    } catch (error) {
      throw new Error(`Error initializing OTP: ${error}`);
    }
  };

  const handlePasskeyLogin = () => {
    pushPage({
      key: "Passkey Login",
      content: (
        <ActionPage
          title="Authenticating with passkey..."
          action={async () => {
            await loginWithPasskey({
              ...(sessionKey && { sessionKey: sessionKey }),
            });
          }}
          icon={<FontAwesomeIcon size="3x" icon={faFingerprint} />}
        />
      ),
      showTitle: false,
    });
  };

  const handlePasskeySignUp = () => {
    pushPage({
      key: "Passkey Sign Up",
      content: (
        <ActionPage
          title="Creating account with passkey..."
          action={async () => {
            await signUpWithPasskey({
              ...(sessionKey && { sessionKey: sessionKey }),
              ...(await consumeToken()),
            });
          }}
          icon={<FontAwesomeIcon size="3x" icon={faFingerprint} />}
        />
      ),
      showTitle: false,
    });
  };

  const handleGoogle = async () => {
    pushPage({
      key: "Google OAuth",
      content: (
        <ActionPage
          title="Authenticating with Google..."
          action={async () =>
            handleGoogleOauth({
              additionalState: {
                openModal: "true",
                ...(sessionKey && { sessionKey }),
              }, // Tell the provider to reopen the auth modal and show the loading state
              ...(await consumeToken()),
            })
          }
          icon={<FontAwesomeIcon size="3x" icon={faGoogle} />}
        />
      ),
      showTitle: false,
    });
  };

  const handleApple = async () => {
    pushPage({
      key: "Apple OAuth",
      content: (
        <ActionPage
          title="Authenticating with Apple..."
          action={async () =>
            handleAppleOauth({
              additionalState: {
                openModal: "true",
                ...(sessionKey && { sessionKey }),
              }, // Tell the provider to reopen the auth modal and show the loading state
              ...(await consumeToken()),
            })
          }
          icon={<FontAwesomeIcon size="3x" icon={faApple} />}
        />
      ),
      showTitle: false,
    });
  };

  const handleFacebook = async () => {
    pushPage({
      key: "Facebook OAuth",
      content: (
        <ActionPage
          title="Authenticating with Facebook..."
          action={async () =>
            handleFacebookOauth({
              additionalState: {
                openModal: "true",
                ...(sessionKey && { sessionKey }),
              }, // Tell the provider to reopen the auth modal and show the loading state
              ...(await consumeToken()),
            })
          }
          icon={<FontAwesomeIcon size="3x" icon={faFacebook} />}
        />
      ),
      showTitle: false,
    });
  };

  const handleX = async () => {
    pushPage({
      key: "X OAuth",
      content: (
        <ActionPage
          title="Authenticating with X..."
          action={async () =>
            handleXOauth({
              additionalState: {
                openModal: "true",
                ...(sessionKey && { sessionKey }),
              }, // Tell the provider to reopen the auth modal and show the loading state
              ...(await consumeToken()),
            })
          }
          icon={<FontAwesomeIcon size="3x" icon={faXTwitter} />}
        />
      ),
      showTitle: false,
    });
  };

  const handleDiscord = async () => {
    pushPage({
      key: "Discord OAuth",
      content: (
        <ActionPage
          title="Authenticating with Discord..."
          action={async () =>
            handleDiscordOauth({
              additionalState: {
                openModal: "true",
                ...(sessionKey && { sessionKey }),
              }, // Tell the provider to reopen the auth modal and show the loading state
              ...(await consumeToken()),
            })
          }
          icon={<FontAwesomeIcon size="3x" icon={faDiscord} />}
        />
      ),
      showTitle: false,
    });
  };

  const handleWalletLoginOrSignup = async (provider: WalletProvider) => {
    pushPage({
      key: "Wallet Login/Signup",
      content: (
        <ActionPage
          title={`Authenticating with ${provider.info.name}...`}
          action={async () => {
            await loginOrSignupWithWallet({
              walletProvider: provider,
              ...(sessionKey && { sessionKey: sessionKey }),
              ...(await consumeToken()),
            });
          }}
          icon={
            <img
              className="size-11 rounded-full"
              src={provider.info.icon || ""}
            />
          }
        />
      ),
      showTitle: false,
    });
  };

  const handleSelect = async (provider: WalletProvider) => {
    // this is a wallet connect provider, so we need to show the WalletConnect screen
    if (isWalletConnect(provider)) {
      // for WalletConnect we route to a dedicated screen
      // to handle the connection process, as it requires a different flow (pairing via QR code or deep link)
      pushPage({
        key: "Connect WalletConnect",
        content: (
          <WalletConnectScreen
            provider={provider}
            onAction={async (provider) => {
              await loginOrSignupWithWallet({
                walletProvider: provider,
                ...(sessionKey && { sessionKey: sessionKey }),
                ...(await consumeToken()),
              });
            }}
            onDisconnect={async (provider) => {
              await disconnectWalletAccount(provider);
            }}
            successPageDuration={undefined}
          />
        ),
      });
      return;
    }

    // this is a regular wallet provider, so we can just select it
    await handleWalletLoginOrSignup(provider);
  };

  const handleShowWalletSelector = async () => {
    try {
      pushPage({
        key: "Select wallet provider",
        content: <ExternalWalletSelector onSelect={handleSelect} />,
      });
    } catch (error) {
      throw new Error(`Error fetching wallet providers: ${error}`);
    }
  };

  const oauthButtonMap: Record<string, JSX.Element | null> = {
    google: methods.googleOauthEnabled ? (
      <OAuthButton
        key="google"
        name="Google"
        icon={<FontAwesomeIcon icon={faGoogle} />}
        onClick={handleGoogle}
      />
    ) : null,
    apple: methods.appleOauthEnabled ? (
      <OAuthButton
        key="apple"
        name="Apple"
        icon={<FontAwesomeIcon icon={faApple} />}
        onClick={handleApple}
      />
    ) : null,
    facebook: methods.facebookOauthEnabled ? (
      <OAuthButton
        key="facebook"
        name="Facebook"
        icon={<FontAwesomeIcon icon={faFacebook} />}
        onClick={handleFacebook}
      />
    ) : null,
    x: methods.xOauthEnabled ? (
      <OAuthButton
        key="x"
        name="X"
        icon={<FontAwesomeIcon icon={faXTwitter} />}
        onClick={handleX}
      />
    ) : null,
    discord: methods.discordOauthEnabled ? (
      <OAuthButton
        key="discord"
        name="Discord"
        icon={<FontAwesomeIcon icon={faDiscord} />}
        onClick={handleDiscord}
      />
    ) : null,
  };

  const oauthButtons = oauthOrder
    .map((provider) => oauthButtonMap[provider])
    .filter(Boolean);

  const oauthBlock =
    oauthButtons.length > 0 && oauthButtons.length <= 5 ? (
      <div
        key="socials"
        className="w-full h-11 flex flex-row justify-center items-center gap-2"
      >
        {oauthButtons}
      </div>
    ) : oauthButtons.length > 0 ? (
      <div
        key="socials"
        className="w-full h-11 flex flex-row justify-center items-center gap-2"
      >
        {oauthButtons.slice(0, 4)}
        <OAuthButton
          key="more"
          name="More"
          icon={<FontAwesomeIcon icon={faEllipsisH} />}
          onClick={() =>
            openSheet({
              key: "Select a social method",
              content: (
                <div className="w-full h-full flex flex-wrap justify-center items-center gap-2">
                  {oauthButtons.map((button) => (
                    <div key={button?.key} className="w-16 h-11">
                      {button}
                    </div>
                  ))}
                </div>
              ),
            })
          }
        />
      </div>
    ) : null;

  // -- Individual Auth Method Components --
  const methodComponents: Record<string, JSX.Element | null> = {
    socials: oauthBlock,
    email: methods.emailOtpAuthEnabled ? (
      <EmailInput onContinue={handleEmailSubmit} disabled={!authEnabled} />
    ) : null,
    sms: methods.smsOtpAuthEnabled ? (
      <PhoneNumberInput onContinue={handlePhoneSubmit} disabled={!authEnabled} />
    ) : null,
    passkey: methods.passkeyAuthEnabled ? (
      <PasskeyButtons
        onLogin={handlePasskeyLogin}
        onSignUp={handlePasskeySignUp}
        disabled={!authEnabled}
      />
    ) : null,
    wallet: methods.walletAuthEnabled ? (
      <WalletAuthButton onContinue={handleShowWalletSelector} disabled={!authEnabled} />
    ) : null,
  };

  // -- Final Rendering Order --
  const rendered = methodOrder
    .map((key) => methodComponents[key])
    .filter(Boolean);

  return (
    <div
      className={clsx(
        "flex flex-col items-center ",
        isMobile ? "w-full" : "w-96",
      )}
    >
      {config.authProxyConfigId ? (
        rendered.length > 0 ? (
          <>
            {logo ? (
              <div className="mt-3 mb-4 flex flex-col items-center">
                <img
                  src={logo}
                  className={`max-w-32 mt-3 w-fit max-h-16 h-fit object-contain ${logoClassName}`}
                />
                <h2 className="text-lg font-medium mb-4 text-center">
                  {title ?? "Log in or sign up"}
                </h2>
              </div>
            ) : (
              <div className="mt-12" />
            )}
            {rendered.map((component, index) => (
              <div key={index} className="w-full">
                {index > 0 && <OrSeparator />}
                {component}
              </div>
            ))}
          </>
        ) : (
          <DeveloperError
            developerTitle="No Auth Methods Enabled"
            developerMessages={[
              "You are using Turnkey's Auth Proxy, but no auth methods are enabled.",
              "To use this modal, you must enable auth methods within the Turnkey dashboard.",
              "If you disabled autoFetchWalletKitConfig in the TurnkeyProvider, please ensure that you are passing in the correct auth methods in the TurnkeyProvider's auth config.",
            ]}
            userMessages={["No authentication methods are available."]}
          />
        )
      ) : (
        <DeveloperError
          developerTitle="Proxy not Enabled"
          developerMessages={[
            "You have not passed in authProxyConfigId into the TurnkeyProvider.",
            "To use this modal, you must be using Turnkey's Auth Proxy.",
            "Please enable it in the Turnkey dashboard and pass in the authProxyConfigId into the TurnkeyProvider.",
          ]}
          // Users should never see this message ever. We should give a reward for anyone who does see this.
          userMessages={["You touched fuzzy.... and got dizzy."]}
        />
      )}

      {config.turnstileSiteKey && (!hadTokenOnMount || showTurnstileError) && (
          <div className="mt-3 flex flex-col text-left w-full">
            {showTurnstilePrompt && (
              <p className="text-icon-text-light/70 dark:text-icon-text-dark/70 text-sm mb-0.5">
                Let us know you're human
              </p>
            )}
            <Turnstile
              ref={turnstileRef}
              id="auth-component-turnstile"
              siteKey={config.turnstileSiteKey}
              className="!w-full !block [&>iframe]:!w-full [&>iframe]:!bg-transparent"
              onSuccess={(token) => {
                setTurnstileToken(token);
                setAuthEnabled(true);
              }}
              onError={() => {
                console.error("Turnstile error occurred");
                setTurnstileToken(null);
                setShowTurnstileError(true);
              }}
              onExpire={() => {
                setTurnstileToken(null);
                setAuthEnabled(false);
              }}
              onBeforeInteractive={() => {
                setShowTurnstilePrompt(true);
              }}
              options={{
                theme: config.ui?.darkMode ? "dark" : "light",
                appearance: "interaction-only",
                size: "flexible",
              }}
            />
          </div>
        )}

      <div className="text-icon-text-light/70 dark:text-icon-text-dark/70 text-xs mt-4 text-center">
        <span>
          By continuing, you agree to our{" "}
          <a
            href="https://www.turnkey.com/legal/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold no-underline text-icon-text-light/80 dark:text-icon-text-dark/80"
          >
            Terms of Service
          </a>{" "}
          &{" "}
          <a
            href="https://www.turnkey.com/legal/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold no-underline text-icon-text-light/80 dark:text-icon-text-dark/80"
          >
            Privacy Policy
          </a>
          {"."}
        </span>
      </div>
    </div>
  );
}
