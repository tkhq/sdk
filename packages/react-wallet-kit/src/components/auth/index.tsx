import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faApple,
  faFacebook,
  faGoogle,
} from "@fortawesome/free-brands-svg-icons";
import { OtpType, type WalletProvider } from "@turnkey/sdk-js";
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

export function AuthComponent() {
  const {
    config,
    clientState,
    handleGoogleOauth,
    handleAppleOauth,
    handleFacebookOauth,
    initOtp,
    loginWithPasskey,
    signUpWithPasskey,
    getWalletProviders,
    loginOrSignupWithWallet,
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
            await loginWithPasskey({});
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
            await signUpWithPasskey({});
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
              additionalState: { openModal: "true" }, // Tell the provider to reopen the auth modal and show the loading state
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
              additionalState: { openModal: "true" }, // Tell the provider to reopen the auth modal and show the loading state
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
              additionalState: { openModal: "true" }, // Tell the provider to reopen the auth modal and show the loading state
            })
          }
          icon={<FontAwesomeIcon size="3x" icon={faFacebook} />}
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
    if (provider.type === WalletType.EthereumWalletConnect) {
      // for WalletConnect we route to a dedicated screen
      // to handle the connection process, as it requires a different flow (pairing via QR code or deep link)
      pushPage({
        key: "WalletConnect",
        content: (
          <WalletConnectScreen
            provider={provider}
            onConnect={async (provider) => {
              await loginOrSignupWithWallet({ walletProvider: provider });
            }}
            successPageDuration={undefined}
          />
        ),
        showTitle: false,
      });
      return;
    }

    // this is a regular wallet provider, so we can just select it
    await handleWalletLoginOrSignup(provider);
  };

  const handleShowWalletSelector = async () => {
    try {
      const walletProviders = await getWalletProviders();

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
    google: methods.googleOAuthEnabled ? (
      <OAuthButton
        key="google"
        name="Google"
        icon={<FontAwesomeIcon icon={faGoogle} />}
        onClick={handleGoogle}
      />
    ) : null,
    apple: methods.appleOAuthEnabled ? (
      <OAuthButton
        key="apple"
        name="Apple"
        icon={<FontAwesomeIcon icon={faApple} />}
        onClick={handleApple}
      />
    ) : null,
    facebook: methods.facebookOAuthEnabled ? (
      <OAuthButton
        key="facebook"
        name="Facebook"
        icon={<FontAwesomeIcon icon={faFacebook} />}
        onClick={handleFacebook}
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
      {config.authProxyId ? (
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
          // TODO (Amir / Ethan): We will probably change the auth proxy name and authProxyId field. Make sure to update this!
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
            "You have not passed in authProxyId into the TurnkeyProvider.",
            "To use this modal, you must be using Turnkey's Auth Proxy.",
            "Please enable it in the Turnkey dashboard and pass in the authProxyId into the TurnkeyProvider.",
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
