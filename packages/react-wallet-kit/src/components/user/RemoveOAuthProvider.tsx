import { faKey } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ActionButton } from "../design/Buttons";
import { useState } from "react";

export function RemoveOAuthProvider(params: {
  providerId: string;
  onContinue?: () => Promise<void>;
  title?: string;
  subTitle?: string;
}) {
  const { onContinue } = params;
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    if (onContinue) {
      setIsLoading(true);
      try {
        await Promise.resolve(onContinue());
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="mt-8 w-72">
      <div className="my-6 flex flex-col items-center">
        <FontAwesomeIcon icon={faKey} size={"2xl"} />
        <div className="text-2xl font-bold py-2 text-center">
          {params?.title ? params.title : "Remove OAuth Provider"}
        </div>
        <div className="text-sm text-icon-text-light dark:text-icon-text-dark text-center !p-0">
          {params?.subTitle
            ? params.subTitle
            : "Are you sure you want to remove this OAuth provider?"}
        </div>
      </div>
      <div className="flex flex-col gap-4 my-3">
        <ActionButton
          onClick={handleContinue}
          loading={isLoading}
          className="w-full max-w-md bg-primary-light dark:bg-primary-dark text-primary-text-light dark:text-primary-text-dark"
          spinnerClassName="text-primary-text-light dark:text-primary-text-dark"
        >
          Remove Provider
        </ActionButton>
      </div>
    </div>
  );
}
