import { faUser } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useModal } from "../../providers/modal/Hook";
import { useTurnkey } from "../../providers/client/Hook";
import { ActionButton } from "../design/Buttons";
import { useState } from "react";
import { Input } from "@headlessui/react";
import clsx from "clsx";

export function UpdateUserName(params: {
  onContinue?: (userName: string) => Promise<void>;
  title?: string;
  subTitle?: string;
}) {
  const { user } = useTurnkey();
  const { isMobile } = useModal();
  const userName = user?.userName || "";
  const [userNameInput, setUserNameInput] = useState(userName);
  const [loading, setLoading] = useState(false);

  const isValidUserName = (un: string): boolean => {
    return un.length > 0 && un !== userName;
  };

  const handleContinue = async () => {
    if (isValidUserName(userNameInput) && params.onContinue) {
      setLoading(true);
      try {
        await Promise.resolve(params.onContinue(userNameInput));
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

  return (
    <div className={clsx("mt-8", isMobile ? "w-full" : "w-72")}>
      <div className="my-6 flex flex-col items-center">
        <FontAwesomeIcon icon={faUser} size={"2xl"} />
        <div className="text-2xl font-bold py-2 text-center">
          {params?.title ? params.title : "Update your user name"}
        </div>
        {params?.subTitle && (
          <div className="text-sm text-icon-text-light dark:text-icon-text-dark text-center !p-0">
            {params.subTitle}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-4 my-3">
        <Input
          type="text"
          placeholder={userName}
          className="w-full py-3 px-4 rounded-md text-inherit bg-button-light dark:bg-button-dark border border-modal-background-dark/20 dark:border-modal-background-light/20 focus:outline-primary-light focus:dark:outline-primary-dark focus:outline-[1px] focus:outline-offset-0 box-border"
          value={userNameInput}
          onChange={(e) => setUserNameInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <ActionButton
          onClick={handleContinue}
          disabled={!isValidUserName(userNameInput)}
          loading={loading}
          className="w-full max-w-md bg-primary-light dark:bg-primary-dark text-primary-text-light dark:text-primary-text-dark"
          spinnerClassName="text-primary-text-light dark:text-primary-text-dark"
        >
          Continue
        </ActionButton>
      </div>
    </div>
  );
}
