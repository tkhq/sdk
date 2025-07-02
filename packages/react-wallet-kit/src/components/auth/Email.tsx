import { useState } from "react";
import { Input } from "@headlessui/react";
import { ActionButton, IconButton } from "../design/Buttons";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import clsx from "clsx";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface EmailInputProps {
  onContinue?: (email: string) => void;
}

export function EmailInput(props: EmailInputProps) {
  const { onContinue } = props;
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [useIconButton] = useState(true); // TODO (Amir): Pull from config

  const emailIsValid = isValidEmail(email);

  const handleContinue = async () => {
    if (emailIsValid && onContinue) {
      setLoading(true);
      try {
        await Promise.resolve(onContinue(email));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleContinue();
    }
  };

  const buttonDisabled = !emailIsValid;

  const buttonClass = clsx(
    "transition-all duration-300",
    (emailIsValid || !useIconButton) &&
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
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full py-3 px-4 rounded-md text-inherit bg-button-light dark:bg-button-dark border border-modal-background-dark/20 dark:border-modal-background-light/20 focus:outline-primary-light focus:dark:outline-primary-dark focus:outline-[1px] focus:outline-offset-0 box-border"
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
