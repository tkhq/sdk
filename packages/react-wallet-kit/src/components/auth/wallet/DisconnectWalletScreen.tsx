import { ActionButton } from "../../design/Buttons";
import { useState } from "react";
import clsx from "clsx";
import type { WalletProvider } from "@turnkey/core";
import { useModal } from "../../../providers/modal/Hook";

interface DisconnectWalletScreenProps {
  provider: WalletProvider;
  onDisconnect: (provider: WalletProvider) => Promise<void>;
}

export function DisconnectWalletScreen(props: DisconnectWalletScreenProps) {
  const { provider, onDisconnect } = props;
  const { isMobile } = useModal();
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleDisconnect = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      await onDisconnect(provider);
    } catch (err) {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={clsx("mt-8", isMobile ? "w-full" : "w-96")}>
      <div className="mt-6 mb-5 flex flex-col items-center gap-3">
        <img src={provider.info.icon ?? ""} className="size-14 rounded-full" />
        <div
          className={clsx(
            "text-2xl font-bold text-center",
            hasError && "text-danger-light dark:text-danger-dark",
          )}
        >
          {hasError
            ? "You can't disconnect this wallet!"
            : `Disconnect ${provider.info.name}`}
        </div>
        <div className="text-icon-text-light dark:text-icon-text-dark text-center !p-0">
          {hasError
            ? `Try disconnecting directly from the ${provider.info.name} app`
            : "You can always connect this wallet again later."}
        </div>
      </div>

      <div className="flex my-2 mt-0">
        <ActionButton
          onClick={handleDisconnect}
          loading={isLoading}
          className={clsx(
            "w-full max-w-md bg-danger-light dark:bg-danger-dark text-primary-text-light dark:text-primary-text-dark",
            hasError && "animate-shake opacity-50",
          )}
          spinnerClassName="text-primary-danger-text-light dark:text-primary-danger-text-dark"
        >
          Disconnect Wallet
        </ActionButton>
      </div>
    </div>
  );
}
