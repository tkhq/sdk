import { useState } from "react";
import { ActionButton } from "../design/Buttons";
import { PhoneInputBox } from "../design/Inputs";

interface PhoneNumberInputProps {
  onContinue?: (phone: string, formattedPhone: string) => void;
}

export function PhoneNumberInput(props: PhoneNumberInputProps) {
  const { onContinue } = props;
  const [phone, setPhone] = useState("");
  const [formattedPhone, setformattedPhone] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const handleContinue = async () => {
    if (isValid && onContinue) {
      setLoading(true);
      try {
        await Promise.resolve(onContinue(phone, formattedPhone));
      } finally {
        setLoading(false);
      }
    }
  };

  const buttonDisabled = !isValid;
  const buttonBgClass =
    "bg-primary-light dark:bg-primary-dark hover:bg-primary-light/90 dark:hover:bg-primary-dark/90 text-modal-text-dark";

  return (
    <div className="flex flex-col w-full items-center justify-center space-y-3">
      <PhoneInputBox
        value={phone}
        onChange={(phone, formattedPhone, valid) => {
          setPhone(phone);
          setformattedPhone(formattedPhone);
          setIsValid(valid);
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onEnter={handleContinue}
      />

      <ActionButton
        onClick={handleContinue}
        disabled={buttonDisabled}
        loading={loading}
        className={buttonBgClass}
      >
        Continue
      </ActionButton>
    </div>
  );
}
