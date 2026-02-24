import { faPhone } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useModal } from "../../providers/modal/Hook";
import { useTurnkey } from "../../providers/client/Hook";
import { ActionButton } from "../design/Buttons";
import { useState } from "react";
import { PhoneInputBox } from "../design/Inputs";
import clsx from "clsx";
import { OtpVerification } from "../auth/OTP";
import { SuccessPage } from "../design/Success";
import { OtpType, StamperType } from "@turnkey/core";

export function UpdatePhoneNumber(params: {
  successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  organizationId: string;
  userId: string;
  onSuccess: (userId: string) => void;
  onError: (error: any) => void;
  title?: string;
  subTitle?: string;
  stampWith?: StamperType | undefined;
}) {
  const { config, user, initOtp, verifyOtp, updateUserPhoneNumber } =
    useTurnkey();
  const { isMobile, pushPage, closeModal } = useModal();
  const phone = user?.userPhoneNumber || "";
  const [phoneInput, setPhoneInput] = useState(phone);
  const [loading, setLoading] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [formattedPhone, setFormattedPhone] = useState("");

  const {
    onSuccess,
    onError,
    successPageDuration,
    organizationId,
    stampWith,
    userId,
  } = params;

  const handleContinue = async () => {
    if (isValid) {
      try {
        const { otpId, otpEncryptionTargetBundle } = await initOtp({
          otpType: OtpType.Sms,
          contact: phoneInput,
        });
        pushPage({
          key: "Verify OTP",
          content: (
            <OtpVerification
              contact={phoneInput}
              {...(formattedPhone && { formattedPhone })}
              otpId={otpId}
              otpEncryptionTargetBundle={otpEncryptionTargetBundle}
              otpType={OtpType.Sms}
              otpLength={
                config?.auth?.otpLength !== undefined
                  ? Number(config.auth.otpLength)
                  : undefined
              }
              alphanumeric={config?.auth?.otpAlphanumeric}
              onContinue={async (otpCode: string) => {
                const { verificationToken } = await verifyOtp({
                  otpId,
                  otpCode,
                  otpEncryptionTargetBundle,
                  contact: phoneInput,
                  otpType: OtpType.Sms,
                });
                const res = await updateUserPhoneNumber({
                  phoneNumber: phoneInput,
                  verificationToken,
                  userId,
                  organizationId,
                  ...(params.stampWith && { stampWith }),
                });
                handleSuccess(res);
              }}
            />
          ),
          showTitle: false,
        });
      } catch (error) {
        onError(error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSuccess = (res: string) => {
    onSuccess(res);

    if (!successPageDuration) {
      closeModal();
      return;
    }

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

  return (
    <div className={clsx("mt-8", isMobile ? "w-full" : "w-72")}>
      <div className="my-6 flex flex-col items-center">
        <FontAwesomeIcon icon={faPhone} size={"2xl"} />
        <div className="text-2xl font-bold py-2 text-center">
          {params?.title ? params.title : "Update your phone number"}
        </div>
        {params?.subTitle && (
          <div className="text-sm text-icon-text-light dark:text-icon-text-dark text-center !p-0">
            {params.subTitle}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-4 my-3">
        <PhoneInputBox
          value={phone}
          onChange={(raw, formatted, valid) => {
            setPhoneInput(raw);
            setFormattedPhone(formatted);
            setIsValid(valid);
          }}
          onEnter={handleContinue}
        />
        <ActionButton
          onClick={handleContinue}
          disabled={!isValid}
          loading={loading}
          className="w-full md:max-w-md bg-primary-light dark:bg-primary-dark text-primary-text-light dark:text-primary-text-dark"
          spinnerClassName="text-primary-text-light dark:text-primary-text-dark"
        >
          Continue
        </ActionButton>
      </div>
    </div>
  );
}
