import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ActionButton } from "../design/Buttons";
import { useState } from "react";
import { useTurnkey } from "../../providers";
import { TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";

export function RemovePasskey(params: {
  authenticatorId: string;
  onContinue?: () => Promise<void>;
  title?: string;
  subTitle?: string;
}) {
  const { user } = useTurnkey();
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

  const authenticator = user?.authenticators?.find(
    (authenticator) => authenticator.authenticatorId === params.authenticatorId,
  );

  if (!authenticator) {
    throw new TurnkeyError(
      "Authenticator not found",
      TurnkeyErrorCodes.NOT_FOUND,
    );
  }

  return (
    <div className="mt-8 w-96">
      <div className="mt-6 mb-5 flex flex-col items-center gap-3">
        <FontAwesomeIcon
          icon={faTriangleExclamation}
          size={"3x"}
          className="text-danger-light dark:text-danger-dark"
        />
        <div className="text-2xl font-bold text-center">
          {params?.title ? params.title : "Remove Passkey"}
        </div>
        <div className="text-icon-text-light dark:text-icon-text-dark text-center !p-0">
          {params?.subTitle ? params.subTitle : "This action is irreversible."}
        </div>
        <div className="p-2 h-full mt-2 max-h-72 rounded-md border border-modal-background-dark/10 dark:border-modal-background-light/10 bg-icon-background-light dark:bg-icon-background-dark text-icon-text-light dark:text-icon-text-dark">
          <div className="text-sm font-mono!">
            Passkey Name: {authenticator.authenticatorName}
          </div>
          <div className="text-sm font-mono!">
            Passkey ID: {authenticator.authenticatorId}
          </div>
        </div>
      </div>
      <div className="flex my-2 mt-0">
        <ActionButton
          onClick={handleContinue}
          loading={isLoading}
          className="w-full max-w-md bg-danger-light dark:bg-danger-dark text-primary-text-light dark:text-primary-text-dark"
          spinnerClassName="text-primary-text-light dark:text-primary-text-dark"
        >
          Remove Passkey
        </ActionButton>
      </div>
    </div>
  );
}
