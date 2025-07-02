import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { OAuthButton } from "./OAuth";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { useModal, useTurnkey } from "../../providers";
import { EmailInput } from "./Email";
import { OrSeparator } from "./OrSeparator";
import { OtpVerification } from "./OTP";
import { OtpType } from "@turnkey/sdk-js";
import { PhoneNumberInput } from "./Phone";
import { ActionPage } from "./Action";
import { PasskeyButtons } from "./Passkey";
import { faFingerprint } from "@fortawesome/free-solid-svg-icons";

export function AuthComponent() {
  const { handleGoogleOauth, initOtp, loginWithPasskey, signUpWithPasskey } =
    useTurnkey();
  const { pushPage } = useModal();

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
            const passkeyDisplayName = `${websiteName}-${timestamp}`;

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

  return (
    <div className="flex flex-col items-center w-96">
      <div className="w-full h-11 flex flex-row justify-center items-center gap-2 mt-12">
        <OAuthButton
          name={"Google"}
          icon={<FontAwesomeIcon icon={faGoogle} />}
          onClick={async () => {
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
          }}
        />
      </div>
      <OrSeparator />
      <EmailInput onContinue={handleEmailSubmit} />
      <OrSeparator />
      <PhoneNumberInput onContinue={handlePhoneSubmit} />
      <OrSeparator />
      <PasskeyButtons
        onLogin={handlePasskeyLogin}
        onSignUp={handlePasskeySignUp}
      />
    </div>
  );
}
