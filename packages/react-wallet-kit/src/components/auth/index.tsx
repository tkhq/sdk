import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { OAuthButton, OAuthLoading } from "./OAuth";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { useModal, useTurnkey } from "../../providers";
import { EmailInput } from "./Email";
import { OrSeparator } from "./OrSeparator";
import { OtpVerification } from "./OTP";
import { OtpType } from "@turnkey/sdk-js";

export function AuthComponent() {
  const { handleGoogleOauth, initOtp } = useTurnkey();
  const { pushPage } = useModal();

  const handleEmailSubmit = async (email: string) => {
    try {
      const otpId = await initOtp({ otpType: OtpType.Email, contact: email });
      pushPage({
        key: "Verify Email",
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

  return (
    <div className="flex flex-col items-center w-96 h-[500px]">
      <div className="w-full h-11 flex flex-row justify-center items-center gap-2 mt-12">
        <OAuthButton
          name={"Google"}
          icon={<FontAwesomeIcon icon={faGoogle} />}
          onClick={async () => {
            pushPage({
              key: "Google OAuth",
              content: (
                <OAuthLoading
                  name="Google"
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
    </div>
  );
}
