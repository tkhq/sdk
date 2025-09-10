import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faApple,
  faDiscord,
  faFacebook,
  faGoogle,
  faXTwitter,
} from "@fortawesome/free-brands-svg-icons";
import { OtpType, type WalletProvider } from "@turnkey/core";
import { faFingerprint } from "@fortawesome/free-solid-svg-icons";
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

type AuthComponentProps = {
  sessionKey?: string | undefined;
};

export function AuthComponent({ sessionKey }: AuthComponentProps) {
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
    fetchWalletProviders,
    loginOrSignupWithWallet,
    disconnectWalletAccount,
  } = useTurnkey();
  const { pushPage, isMobile } = useModal();

  if (!config || clientState === ClientState.Loading) {
    // Don't check ClientState.Error here. We already check in the modal root
    return (
      <div className="flex flex-col items-center w-96 py-5">
        <Spinner strokeWidth={2} className="w-48 h-48" />
      </div>
    );
  }

  const { methods = {}, methodOrder = [], oauthOrder = [] } = config.auth || {};

  const handleEmailSubmit = async (email: string) => {
    try {
      const otpId = await initOtp({ otpType: OtpType.Email, contact: email });
      pushPage({
        key: "Verify OTP",
        content: (
          <OtpVerification
            contact={email}
            otpId={otpId}
            otpType={OtpType.Email}
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
          action={() =>
            handleGoogleOauth({
              additionalState: {
                openModal: "true",
                ...(sessionKey && { sessionKey }),
              }, // Tell the provider to reopen the auth modal and show the loading state
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
          action={() =>
            handleAppleOauth({
              additionalState: {
                openModal: "true",
                ...(sessionKey && { sessionKey }),
              }, // Tell the provider to reopen the auth modal and show the loading state
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
          action={() =>
            handleFacebookOauth({
              additionalState: {
                openModal: "true",
                ...(sessionKey && { sessionKey }),
              }, // Tell the provider to reopen the auth modal and show the loading state
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
          action={() =>
            handleXOauth({
              additionalState: {
                openModal: "true",
                ...(sessionKey && { sessionKey }),
              }, // Tell the provider to reopen the auth modal and show the loading state
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
          action={() =>
            handleDiscordOauth({
              additionalState: {
                openModal: "true",
                ...(sessionKey && { sessionKey }),
              }, // Tell the provider to reopen the auth modal and show the loading state
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
      const walletProviders = await fetchWalletProviders();

      pushPage({
        key: "Select wallet provider",
        content: (
          <ExternalWalletSelector
            providers={walletProviders}
            onSelect={handleSelect}
          />
        ),
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
    oauthButtons.length > 0 ? (
      <div
        key="socials"
        className="w-full h-11 flex flex-row justify-center items-center gap-2"
      >
        {oauthButtons}
      </div>
    ) : null;

  // -- Individual Auth Method Components --
  const methodComponents: Record<string, JSX.Element | null> = {
    socials: oauthBlock,
    email: methods.emailOtpAuthEnabled ? (
      <EmailInput onContinue={handleEmailSubmit} />
    ) : null,
    sms: methods.smsOtpAuthEnabled ? (
      <PhoneNumberInput onContinue={handlePhoneSubmit} />
    ) : null,
    passkey: methods.passkeyAuthEnabled ? (
      <PasskeyButtons
        onLogin={handlePasskeyLogin}
        onSignUp={handlePasskeySignUp}
      />
    ) : null,
    wallet: methods.walletAuthEnabled ? (
      <WalletAuthButton onContinue={handleShowWalletSelector} />
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
            <div className="mt-12" />
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
              "If you disabled all auth methods within the TurnkeyProvider config, you will also see this error.",
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
