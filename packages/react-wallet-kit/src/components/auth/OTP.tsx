import { useRef, useState } from "react";
import { useModal } from "../../providers/modal/Hook";
import { useTurnkey } from "../../providers/client/Hook";
import { Spinner } from "../design/Spinners";
import { Input } from "@headlessui/react";
import { BaseButton } from "../design/Buttons";
import { OtpType } from "@turnkey/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEnvelope, faPhone } from "@fortawesome/free-solid-svg-icons";
import clsx from "clsx";

interface OtpVerificationProps {
  contact: string;
  otpId: string;
  otpType: OtpType;
  otpLength?: number;
  alphanumeric?: boolean;
  formattedContact?: string; // Optional formatted contact for display purposes
  sessionKey?: string; // Optional sessionKey for multisession
  onContinue?: (optCode: string) => Promise<void>; // Optional callback for continue action
}
export function OtpVerification(props: OtpVerificationProps) {
  const {
    contact,
    otpType,
    otpLength = 6,
    alphanumeric = true,
    formattedContact,
    sessionKey,
    onContinue = null, // Default to null if not provided
  } = props;
  const { initOtp, completeOtp } = useTurnkey();
  const { closeModal, isMobile } = useModal();
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [resending, setResending] = useState<boolean>(false);
  const [resent, setResent] = useState<boolean>(false);
  const [otpId, setOtpId] = useState<string>(props.otpId);
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);

  const shakeInput = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 250);
  };

  const handleContinue = async (otpCode: string) => {
    try {
      setSubmitting(true);
      if (onContinue) {
        await onContinue(otpCode);
      } else {
        await completeOtp({
          otpId,
          otpCode,
          contact,
          otpType,
          ...(sessionKey && { sessionKey }),
        });
        closeModal();
      }
    } catch (error) {
      const niceError = (error as Error).message.includes("Invalid OTP")
        ? "Invalid OTP code"
        : "An error has occurred"; // eek! maybe this is bad!
      setError(niceError);
      shakeInput();
      throw new Error(`Error completing OTP: ${error}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const id = await initOtp({ otpType, contact });
      setOtpId(id);
      setResent(true);
    } catch (error) {
      throw new Error(`Error resending OTP: ${error}`);
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      className={clsx(
        "flex items-center justify-center py-3",
        isMobile ? "w-full" : "min-w-96"
      )}
    >
      <div
        className={`flex flex-col items-center justify-center gap-6 transition-all duration-300 ${submitting && "opacity-30 blur"}`}
      >
        <FontAwesomeIcon
          size="3x"
          icon={
            otpType === OtpType.Email
              ? faEnvelope
              : otpType === OtpType.Sms
                ? faPhone
                : faEnvelope
          }
        />

        <div className="flex flex-col text-center">
          <span className="text-lg font-medium">{`Enter the ${otpLength}-digit code we sent to`}</span>
          <span className="text-base font-semibold">
            {formattedContact ?? contact}
          </span>
        </div>

        <div
          className={`transition-all flex justify-center ${shaking ? "animate-shake" : ""}`}
        >
          <OtpInput
            otpLength={otpLength}
            onContinue={handleContinue}
            alphanumeric={alphanumeric}
          />
        </div>

        {error && (
          <div className="text-red-400 text-center text-sm">{error}</div>
        )}
        <BaseButton
          onClick={handleResend}
          disabled={resending || resent}
          className={`text-xs text-inherit font-semibold bg-transparent border-none ${resent && "opacity-30"}`}
        >
          {resending ? (
            <span className="flex items-center gap-2.5">
              <Spinner className="size-3" />
              Resending...
            </span>
          ) : resent ? (
            "Code sent!"
          ) : (
            "Resend Code"
          )}
        </BaseButton>
      </div>
      {submitting && (
        <div className="absolute flex w-full h-full justify-center items-center">
          <Spinner strokeWidth={1} className="size-1/2" />
        </div>
      )}
    </div>
  );
}

interface OtpInputProps {
  otpLength: number;
  onContinue: (otpCode: string) => void;
  alphanumeric?: boolean;
}

export function OtpInput(props: OtpInputProps) {
  const { otpLength, onContinue, alphanumeric = false } = props;
  const { isMobile } = useModal();
  const [values, setValues] = useState<string[]>(Array(otpLength).fill(""));
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const handleChange = (index: number, value: string) => {
    if (!alphanumeric) value = value.replace(/[^0-9]/g, "");
    else value = value.replace(/[^a-zA-Z0-9]/g, "");

    const newValues = [...values];
    newValues[index] = value.slice(-1); // only last char
    setValues(newValues);

    if (value && index < otpLength - 1) {
      inputsRef.current[index + 1]?.focus();
    }
    if (value && newValues.every((v) => v)) {
      onContinue(newValues.join(""));
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (e.key === "Backspace" && !values[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }

    if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }

    if (e.key === "ArrowRight" && index < otpLength - 1) {
      inputsRef.current[index + 1]?.focus();
    }

    if (e.key === "Enter") {
      onContinue(values.join(""));
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").trim();

    const cleaned = alphanumeric
      ? paste.replace(/[^a-zA-Z0-9]/g, "")
      : paste.replace(/[^0-9]/g, "");

    const sliced = cleaned.slice(0, otpLength).split("");

    const newValues = [...values];
    for (let i = 0; i < sliced.length; i++) {
      newValues[i] = sliced[i] ?? "";
      if (inputsRef.current[i]) {
        inputsRef.current[i]!.value = sliced[i] ?? "";
      }
    }

    setValues(newValues);

    // Focus the last filled box
    const lastIndex = Math.min(sliced.length, otpLength - 1);
    inputsRef.current[lastIndex]?.focus();

    onContinue(newValues.join(""));
  };

  return (
    <div
      className={clsx(
        "flex items-center justify-center space-x-2",
        isMobile ? "w-[95%]" : "w-full"
      )}
    >
      {Array.from({ length: otpLength }).map((_, i) => {
        return (
          <Input
            key={i}
            type={alphanumeric ? "text" : "text"}
            inputMode={alphanumeric ? "text" : "numeric"}
            maxLength={1}
            value={values[i]?.toUpperCase()}
            autoComplete="off"
            onChange={(e) => handleChange(i, e.target.value.toUpperCase())}
            onKeyDown={(e) => handleKeyDown(e, i)}
            onPaste={handlePaste}
            ref={(el) => (inputsRef.current[i] = el as HTMLInputElement | null)}
            className={clsx(
              "text-center text-lg rounded-md border border-modal-background-dark/20 dark:border-modal-background-light/20 bg-button-light dark:bg-button-dark text-inherit focus:outline-primary-light focus:dark:outline-primary-dark focus:outline-[1px] focus:outline-offset-0 transition-all",
              isMobile ? "w-full h-10" : "h-12 w-12"
            )}
          />
        );
      })}
    </div>
  );
}
