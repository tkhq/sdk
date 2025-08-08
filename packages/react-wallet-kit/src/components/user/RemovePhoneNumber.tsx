import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ActionButton } from "../design/Buttons";
import { useState } from "react";
import { useModal } from "../../providers/modal/Hook";
import { useTurnkey } from "../../providers/client/Hook";
import clsx from "clsx";
import { SuccessPage } from "../design/Success";
import type { StamperType } from "@turnkey/sdk-js";

export function RemovePhoneNumber(params: {
  userId?: string;
  title?: string;
  subTitle?: string;
  successPageDuration?: number | undefined;
  onSuccess: (userId: string) => void;
  onError: (error: any) => void;
  stampWith?: StamperType | undefined;
}) {
  const { user, removeUserPhoneNumber } = useTurnkey();
  const { isMobile, closeModal, pushPage } = useModal();
  const [isLoading, setIsLoading] = useState(false);

  const {
    onSuccess,
    onError,
    successPageDuration,
    userId = user?.userId,
  } = params;

  const handleContinue = async () => {
    try {
      setIsLoading(true);
      const res = await removeUserPhoneNumber({
        userId: userId!,
        stampWith: params.stampWith,
      });
      handleSuccess(res);
    } catch (error) {
      onError(error);
    } finally {
      setIsLoading(false);
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
          text="Phone number removed successfully!"
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

  return (
    <div className={clsx("mt-8", isMobile ? "w-full" : "w-96")}>
      <div className="mt-6 mb-5 flex flex-col items-center gap-3">
        <FontAwesomeIcon
          icon={faTriangleExclamation}
          size={"3x"}
          className="text-danger-light dark:text-danger-dark"
        />
        <div className="text-2xl font-bold text-center">
          {params?.title ? params.title : "Remove Phone Number"}
        </div>
        <div className="text-icon-text-light dark:text-icon-text-dark text-center !p-0">
          {params?.subTitle ? params.subTitle : "This action is irreversible."}
        </div>
        <div className="p-2 h-full mt-2 max-h-72 rounded-md border border-modal-background-dark/10 dark:border-modal-background-light/10 bg-icon-background-light dark:bg-icon-background-dark text-icon-text-light dark:text-icon-text-dark">
          <div className="text-sm font-mono!">
            Phone Number: {user!.userPhoneNumber}
          </div>
          <div className="text-sm font-mono!">User ID: {user!.userId}</div>
        </div>
      </div>
      <div className="flex my-2 mt-0">
        <ActionButton
          onClick={handleContinue}
          loading={isLoading}
          className="w-full max-w-md bg-danger-light dark:bg-danger-dark text-primary-text-light dark:text-primary-text-dark"
          spinnerClassName="text-primary-text-light dark:text-primary-text-dark"
        >
          Remove Phone Number
        </ActionButton>
      </div>
    </div>
  );
}
