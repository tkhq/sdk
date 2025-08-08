import { faEnvelope } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Input } from "@headlessui/react";
import { useModal } from "../../providers/modal/Hook";
import { useTurnkey } from "../../providers/client/Hook";
import { ActionButton } from "../design/Buttons";
import { useState } from "react";
import clsx from "clsx";
import { OtpVerification } from "../auth/OTP";
import { SuccessPage } from "../design/Success";
import { OtpType } from "@turnkey/sdk-js";

export function UpdateEmail(params: {
  onSuccess: (userId: string) => void;
  onError: (error: any) => void;
  successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show
  title?: string;
  subTitle?: string;
}) {
  const { onSuccess, onError, successPageDuration } = params;
  const { user, updateUserEmail, initOtp, verifyOtp } = useTurnkey();
  const { isMobile, pushPage, closeModal } = useModal();
  const email = user?.userEmail || "";
  const [emailInput, setEmailInput] = useState(email);
  const [isLoading, setIsLoading] = useState(false);

  const isValidEmail = (e: string): boolean => {
    return e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e !== email;
  };

  const handleContinue = async () => {
    if (isValidEmail(emailInput)) {
      try {
        setIsLoading(true);
        const otpId = await initOtp({
          otpType: OtpType.Email,
          contact: emailInput,
        });
        pushPage({
          key: "Verify OTP",
          content: (
            <OtpVerification
              contact={emailInput}
              otpId={otpId}
              otpType={OtpType.Email}
              onContinue={async (otpCode: string) => {
                const { verificationToken } = await verifyOtp({
                  otpId,
                  otpCode,
                  contact: emailInput,
                  otpType: OtpType.Email,
                });
                const res = await updateUserEmail({
                  email: emailInput,
                  verificationToken,
                  userId: user!.userId,
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
        setIsLoading(false);
      }
    }
  };

  const handleSuccess = (userId: string) => {
    onSuccess(userId);

    if (!successPageDuration) {
      closeModal();
      return;
    }

    pushPage({
      key: "success",
      content: (
        <SuccessPage
          text="Email updated successfully!"
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleContinue();
    }
  };

  return (
    <div className={clsx("mt-8", isMobile ? "w-full" : "w-72")}>
      <div className="my-6 flex flex-col items-center">
        <FontAwesomeIcon icon={faEnvelope} size={"2xl"} />
        <div className="text-2xl font-bold py-2 text-center">
          {params?.title ? params.title : "Update your email"}
        </div>
        {params?.subTitle && (
          <div className="text-sm text-icon-text-light dark:text-icon-text-dark text-center !p-0">
            {params.subTitle}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-4 my-3">
        <Input
          type="email"
          placeholder={email ? email : "your@email.com"}
          className="w-full py-3 px-4 rounded-md text-inherit bg-button-light dark:bg-button-dark border border-modal-background-dark/20 dark:border-modal-background-light/20 focus:outline-primary-light focus:dark:outline-primary-dark focus:outline-[1px] focus:outline-offset-0 box-border"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <ActionButton
          onClick={handleContinue}
          disabled={!isValidEmail(emailInput)}
          loading={isLoading}
          className="w-full max-w-md bg-primary-light dark:bg-primary-dark text-primary-text-light dark:text-primary-text-dark"
          spinnerClassName="text-primary-text-light dark:text-primary-text-dark"
        >
          Continue
        </ActionButton>
      </div>
    </div>
  );
}
