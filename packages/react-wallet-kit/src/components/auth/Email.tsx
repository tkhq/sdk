import { useState } from "react";
import { Input } from "@headlessui/react";
import { ActionButton } from "../design/Buttons";

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
  const [isFocused, setIsFocused] = useState(false);

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
  const buttonBgClass =
    "bg-primary-light dark:bg-primary-dark hover:bg-primary-light/90 dark:hover:bg-primary-dark/90 text-modal-text-dark";

  return (
    <div className="flex flex-col w-full items-center justify-center space-y-3">
      <div className="w-full">
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          className="w-full py-3 px-4 rounded-md text-inherit bg-button-light dark:bg-button-dark border border-modal-background-dark/20 dark:border-modal-background-light/20 focus:outline-primary-light focus:dark:outline-primary-dark focus:outline-[1px] focus:outline-offset-0 box-border"
        />
      </div>

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
