import { useModal } from "../../providers/modal/Hook";
import clsx from "clsx";
import { ActionPage } from "../auth/Action";
import { SuccessPage } from "../design/Success";

type SendTransactionPageProps = {
  icon?: React.ReactNode; // optional, you may pass a chain icon if desired
  action: () => Promise<void>;
  completed: boolean;
  successPageDuration?: number;
  onSuccess?: () => void;
  onError?: (error: any) => void;
};

export function SendTransactionPage({
  icon,
  action,
  completed,
  successPageDuration = 2000,
  onSuccess,
  onError,
}: SendTransactionPageProps) {
  const { closeModal, isMobile } = useModal();

  if (completed) {
    return (
      <div
        className={clsx(
          "flex flex-col items-center justify-center py-5 transition-all duration-300 text-center",
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
            await action();
          } catch (err) {
            onError?.(err);
            throw err;
          }
        }}
        closeOnComplete={false}
      />

      <div className="text-icon-text-light text-sm dark:text-icon-text-dark text-center !p-0">
        Complete the transaction in the popup window.
      </div>
    </div>
  );
}
