import { faEnvelope } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Input } from "@headlessui/react";
import { useTurnkey } from "../../providers";
import { ActionButton } from "../design/Buttons";
import { useState } from "react";

export function UpdateEmail(params: {
  onContinue?: (email: string) => Promise<void>;
  title?: string;
  subTitle?: string;
}) {
  const { onContinue } = params;
  const { user } = useTurnkey();
  const email = user?.userEmail || "";
  const [emailInput, setEmailInput] = useState(email);
  const [isLoading, setIsLoading] = useState(false);

  const isValidEmail = (e: string): boolean => {
    return e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e !== email;
  };

  const handleContinue = async () => {
    if (isValidEmail(emailInput) && onContinue) {
      setIsLoading(true);
      try {
        await Promise.resolve(onContinue(email));
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleContinue();
    }
  };

  return (
    <div className="mt-8 w-72">
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
          placeholder={email}
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
