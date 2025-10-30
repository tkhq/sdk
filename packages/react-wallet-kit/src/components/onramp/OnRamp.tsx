import { useEffect, useRef, useState } from "react";
import { useModal } from "../../providers/modal/Hook";
import { useTurnkey } from "../../providers/client/Hook";
import type {
  v1FiatOnRampBlockchainNetwork,
  v1FiatOnRampCryptoCurrency,
  v1FiatOnRampProvider,
} from "@turnkey/sdk-types";
import { CoinbaseLogo, MoonPayLogo} from "../design/Svg";
import clsx from "clsx";
import { ActionPage } from "../auth/Action";
import { SuccessPage } from "../design/Success";
type OnRampPageProps = {
  walletAddress: string;
  fiatCurrencyAmount: string;
  cryptoCurrencyCode: v1FiatOnRampCryptoCurrency;
  network: v1FiatOnRampBlockchainNetwork;
  onrampProvider: v1FiatOnRampProvider;
  sandboxMode: boolean;
  successPageDuration?: number;
  onSuccess?: () => void;
  onError?: (error: any) => void;
};

export function OnRampPage(props: OnRampPageProps) {
  const {
    walletAddress,
    fiatCurrencyAmount,
    cryptoCurrencyCode,
    network,
    onrampProvider,
    sandboxMode,
    successPageDuration = 2000,
    onSuccess,
    onError,
  } = props;

  const { closeModal, isMobile } = useModal();
  const { httpClient } = useTurnkey();

  const [completed, setCompleted] = useState(false);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
  }, []);

  const renderProviderLogo = () => {
    if (onrampProvider === "FIAT_ON_RAMP_PROVIDER_COINBASE") {
      return <CoinbaseLogo className="w-12 h-12" />;
    }
    if (onrampProvider === "FIAT_ON_RAMP_PROVIDER_MOONPAY") {
      return <MoonPayLogo className="w-12 h-12"/>;
    }
    return null;
  };

  const action = async () => {
    try {
      // Small delay to smooth UI transition
      await new Promise((resolve) => setTimeout(resolve, 300));

      const result = await httpClient?.initFiatOnRamp({
        onrampProvider,
        walletAddress,
        network,
        cryptoCurrencyCode,
        fiatCurrencyAmount,
        sandboxMode,
      });

      if (result?.onRampUrl) {
        const popupWidth = 500;
        const popupHeight = 600;
        const left = window.screenX + (window.innerWidth - popupWidth) / 2;
        const top = window.screenY + (window.innerHeight - popupHeight) / 2;

        const authWindow = window.open(
          result.onRampUrl,
          "_blank",
          `width=${popupWidth},height=${popupHeight},top=${top},left=${left},scrollbars=yes,resizable=yes`
        );
        if (authWindow) authWindow.focus();
      }

      const onRampTransactionId = result?.onRampTransactionId;
      if (!onRampTransactionId) throw new Error("No onRampTransactionId returned");

      let attempts = 0;
      const maxAttempts = 60;

      return new Promise<void>((resolve, reject) => {
        const pollInterval = setInterval(async () => {
          attempts++;

          try {
            const resp = await httpClient?.getOnRampTransactionStatus({
              transactionId: onRampTransactionId,
              refresh: true,
            });

            const status = resp?.transactionStatus;
            if (!status) return;

            if (["COMPLETED", "FAILED", "CANCELLED"].includes(status)) {
              clearInterval(pollInterval);
              setCompleted(true);
              resolve();
            }

            if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              reject(new Error("Polling timed out"));
            }
          } catch (err) {
            clearInterval(pollInterval);
            reject(err);
          }
        }, 5000);
      });
    } catch (err) {
      console.error("On-ramp flow error:", err);
      onError?.(err);
      closeModal();
      throw err;
    }
  };

  if (completed) {
    return (
      <div
        className={clsx(
          "flex flex-col items-center justify-center py-5 transition-all duration-300 text-center",
          isMobile ? "w-full" : "w-72"
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
        isMobile ? "w-full" : "w-72"
      )}
    >
      <ActionPage
        title={
          "Initiating On-Ramp"
        }
        icon={renderProviderLogo()}
        action={action}
        closeOnComplete={false}
      />
        <div className="text-icon-text-light text-sm dark:text-icon-text-dark text-center !p-0">
        {onrampProvider === "FIAT_ON_RAMP_PROVIDER_COINBASE"
            ? "Use the Coinbase popup to finish funding your account."
            : "Use the MoonPay popup finish funding your account."
        }
      </div>
    </div>
  );
}
