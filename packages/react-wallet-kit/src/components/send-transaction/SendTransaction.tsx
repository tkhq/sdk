import { useModal } from "../../providers/modal/Hook";
import clsx from "clsx";
import { ActionPage } from "../auth/Action";
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
          "flex flex-col items-center justify-center py-5 transition-all duration-300 text-center gap-2",
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
          <a
            href={getExplorerUrl(storedTxHash, caip2)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline text-sm mt-2"
          >
            View on Explorer
          </a>
        )}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center py-5 transition-all duration-300 text-center",
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
