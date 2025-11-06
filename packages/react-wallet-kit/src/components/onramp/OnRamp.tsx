import { useModal } from "../../providers/modal/Hook";
import clsx from "clsx";
import { ActionPage } from "../auth/Action";
import { SuccessPage } from "../design/Success";

type OnRampPageProps = {
  icon: React.ReactNode;
  onrampProvider: string;
  action: () => Promise<void>;
  completed: boolean;
  successPageDuration?: number;
  sandboxMode?: boolean;
  onSuccess?: () => void;
  onError?: (error: any) => void;
};

export function OnRampPage({
  icon,
  onrampProvider,
  action,
  completed,
  successPageDuration = 2000,
  sandboxMode = false,
  onSuccess,
  onError,
}: OnRampPageProps) {
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
          text="On Ramp Transaction Complete!"
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
        title="Initiating On-Ramp"
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
        {onrampProvider === "FIAT_ON_RAMP_PROVIDER_COINBASE"
          ? "Use the Coinbase popup to finish funding your account."
          : "Use the MoonPay popup to finish funding your account."}
      </div>
      {sandboxMode && (
        <div className="mt-2 text-xs text-blue-500 dark:text-blue-400">
          Sandbox mode — no real funds will be used.
        </div>
      )}
    </div>
  );
}
