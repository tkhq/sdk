import { useState } from "react";
import { ActionButton, IconButton } from "../design/Buttons";
import { PhoneInputBox } from "../design/Inputs";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import clsx from "clsx";

interface PhoneNumberInputProps {
  onContinue?: (phone: string, formattedPhone: string) => void;
}

export function PhoneNumberInput(props: PhoneNumberInputProps) {
  const { onContinue } = props;
  const [phone, setPhone] = useState("");
  const [formattedPhone, setFormattedPhone] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [loading, setLoading] = useState(false);

  const [useIconButton] = useState(true); // TODO (Amir): Pull from config

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

  const buttonClass = clsx(
    "transition-all duration-300",
    (isValid || !useIconButton) &&
      "bg-primary-light dark:bg-primary-dark hover:bg-primary-light/90 dark:hover:bg-primary-dark/90 text-primary-text-light dark:text-primary-text-dark",
  );

  return (
    <div
      className={clsx(
        "w-full items-center justify-center space-y-3",
        useIconButton ? "flex flex-row" : "flex flex-col",
      )}
    >
      <div
        className={clsx(
          "w-full",
          useIconButton && "relative flex items-center",
        )}
      >
        <PhoneInputBox
          value={phone}
          onChange={(raw, formatted, valid) => {
            setPhone(raw);
            setFormattedPhone(formatted);
            setIsValid(valid);
          }}
          onEnter={handleContinue}
        />

        {useIconButton && (
          <IconButton
            icon={faArrowRight}
            onClick={handleContinue}
            disabled={buttonDisabled}
            loading={loading}
            className={clsx("absolute right-2 w-6 h-6", buttonClass)}
            spinnerClassName="text-primary-text-light dark:text-primary-text-dark"
          />
        )}
      </div>

      {!useIconButton && (
        <ActionButton
          onClick={handleContinue}
          disabled={buttonDisabled}
          loading={loading}
          className={clsx("w-full", buttonClass)}
          spinnerClassName="text-primary-text-light dark:text-primary-text-dark"
        >
          Continue
        </ActionButton>
      )}
    </div>
  );
}
