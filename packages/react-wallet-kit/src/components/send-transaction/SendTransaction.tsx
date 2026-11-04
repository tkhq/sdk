import { useModal } from "../../providers/modal/Hook";
import clsx from "clsx";
import { ActionPage } from "../auth/Action";
import { ActionButton } from "../design/Buttons";
import { SuccessPage } from "../design/Success";
import { useState } from "react";
import { getExplorerUrl } from "./helpers";

export function SendTransactionPage({
  icon,
  action,
  caip2,
  successPageDuration = 2000,
  onSuccess,
  onError,
}: {
  icon?: React.ReactNode;
  action: () => Promise<{ txHash?: string }>;
  caip2: string;
  successPageDuration?: number;
  onSuccess?: () => void;
  onError?: (error: any) => void;
}) {
  const { closeModal, isMobile } = useModal();
  const [completed, setCompleted] = useState(false);
  const [storedTxHash, setStoredTxHash] = useState<string | undefined>();

  if (completed) {
    return (
      <div
        className={clsx(
          "flex flex-col items-center justify-center py-5 text-center gap-2",
          isMobile ? "w-full" : "w-72",
        )}
      >
        <SuccessPage
          text="Transaction Sent!"
          duration={successPageDuration}
          onComplete={() => {
            onSuccess?.();
            closeModal();
          }}
        />

        {storedTxHash && (
          <ActionButton
            name="send-transaction-view-explorer"
            onClick={() => {
              window.open(
                getExplorerUrl(storedTxHash, caip2),
                "_blank",
                "noopener,noreferrer",
              );
            }}
            className="mt-2 bg-primary-light text-primary-text-light dark:bg-primary-dark dark:text-primary-text-dark"
          >
            View on block explorer
          </ActionButton>
        )}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center py-5 text-center",
        isMobile ? "w-full" : "w-72",
      )}
    >
      <ActionPage
        title="Sending Transaction"
        icon={icon}
        action={async () => {
          try {
            const result = await action();
            setStoredTxHash(result?.txHash);
            setCompleted(true);
          } catch (err) {
            onError?.(err);
            throw err;
          }
        }}
        closeOnComplete={false}
      />
    </div>
  );
}
