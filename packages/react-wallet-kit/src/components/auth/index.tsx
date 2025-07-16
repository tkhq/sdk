import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { OAuthButton } from "./OAuth";
import {
  faApple,
  faFacebook,
  faGoogle,
} from "@fortawesome/free-brands-svg-icons";
import { useModal, useTurnkey } from "../../providers";
import { EmailInput } from "./Email";
import { OrSeparator } from "./OrSeparator";
import { OtpVerification } from "./OTP";
import { OtpType } from "@turnkey/sdk-js";
import { PhoneNumberInput } from "./Phone";
import { ActionPage } from "./Action";
import { PasskeyButtons } from "./Passkey";
import { faFingerprint } from "@fortawesome/free-solid-svg-icons";
import { Spinner } from "../design/Spinners";
import { ExternalWalletSelector, WalletAuthButton } from "./Wallet";
import { WalletProvider } from "@turnkey/wallet-stamper";

export function AuthComponent() {
  const {
    config,
    handleGoogleOauth,
    handleAppleOauth,
    handleFacebookOauth,
    initOtp,
    loginWithPasskey,
    signUpWithPasskey,
    getWalletProviders,
    loginOrSignupWithWallet,
  } = useTurnkey();
  const { pushPage } = useModal();

  if (!config)
    return (
      <div className="flex flex-col items-center w-96 py-5">
        <Spinner strokeWidth={2} className="w-48 h-48" />
      </div>
    );

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
            const websiteName = window.location.hostname;
            const timestamp = Date.now();

            // The default passkey name is just "A Passkey" from the core signUpWithPasskey method.
            // Since we know we are on a website, default it to the website name if not provided in the conifg
            const passkeyDisplayName =
              config.auth?.createSuborgParams?.passkey?.passkeyName ??
              `${websiteName}-${timestamp}`;

            await signUpWithPasskey({
              passkeyDisplayName,
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

  const handleShowWalletSelector = async () => {
    try {
      const walletProviders = await getWalletProviders();

      pushPage({
        key: "Select wallet provider",
        content: (
          <ExternalWalletSelector
            providers={walletProviders}
            onSelect={handleWalletLoginOrSignup}
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
    <div className="flex flex-col items-center w-96">
      <div className="mt-12" />
      {rendered.map((component, index) => (
        <div key={index} className="w-full">
          {index > 0 && <OrSeparator />}
          {component}
        </div>
      ))}
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
