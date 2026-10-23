import { useEffect, useState } from "react";
import {
  TurnkeyError,
  TurnkeyErrorCodes,
  type StamperType,
  type v1FiatOnRampProvider,
} from "@turnkey/core";
import { useTurnkey } from "../../providers/client/Hook";
import { useModal } from "../../providers/modal/Hook";
import { ActionPage } from "../auth/Action";
import { CoinbaseLogo, MoonPayLogo } from "../design/Svg";
import { SuccessPage } from "../design/Success";
import { providerName } from "./QuoteOption";

const POLL_INTERVAL_MS = 1000;

const providerLogos = {
  FIAT_ON_RAMP_PROVIDER_COINBASE: CoinbaseLogo,
  FIAT_ON_RAMP_PROVIDER_MOONPAY: MoonPayLogo,
} as const satisfies Record<v1FiatOnRampProvider, typeof CoinbaseLogo>;

export type OnRampStatusPageProps = {
  transactionId: string;
  organizationId?: string | undefined;
  stampWith?: StamperType | undefined;
  provider: v1FiatOnRampProvider;
  openedInNewTab: boolean;
  successPageDuration?: number | undefined;
  successText?: string | undefined;
  statusLabel?: string | undefined;
  onSuccess: () => void;
  onError: (error: unknown) => void;
};

export function OnRampStatusPage(props: OnRampStatusPageProps) {
  const {
    transactionId,
    organizationId,
    stampWith,
    provider,
    openedInNewTab,
    successPageDuration = 2000,
    successText = "Purchase complete",
    statusLabel = "Onramp",
    onSuccess,
    onError,
  } = props;
  const { httpClient } = useTurnkey();
  const { closeModal } = useModal();
  const [completed, setCompleted] = useState(false);
  const ProviderLogo = providerLogos[provider];

  useEffect(() => {
    if (!httpClient || completed) return;

    let active = true;
    let polling = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    const finish = (callback: () => void) => {
      if (!active) return;
      active = false;
      clearInterval(interval);
      callback();
    };

    const poll = async () => {
      if (!active || polling) return;
      polling = true;
      try {
        const request = {
          transactionId,
          refresh: true,
          ...(organizationId ? { organizationId } : {}),
        };
        const response = stampWith
          ? await httpClient.getOnRampTransactionStatus(request, stampWith)
          : await httpClient.getOnRampTransactionStatus(request);
        if (!active) return;

        const status = response.transactionStatus.toUpperCase();
        if (isCompletedStatus(status)) {
          finish(() => setCompleted(true));
          return;
        }
        if (isFailedStatus(status)) {
          finish(() => {
            onError(
              new TurnkeyError(
                `${statusLabel} transaction ${response.transactionStatus}.`,
                TurnkeyErrorCodes.POLL_TRANSACTION_STATUS_ERROR,
              ),
            );
            closeModal();
          });
        }
      } catch {
        // Keep polling. A single failed status request is not a failed purchase.
      } finally {
        polling = false;
      }
    };

    void poll();
    interval = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [
    closeModal,
    completed,
    httpClient,
    onError,
    organizationId,
    stampWith,
    statusLabel,
    transactionId,
  ]);

  if (completed) {
    return (
      <SuccessPage
        text={successText}
        duration={successPageDuration}
        onComplete={() => {
          onSuccess();
          closeModal();
        }}
      />
    );
  }

  return (
    <ActionPage
      title="Completing Payment"
      subtitle={`Use the ${providerName(provider)} ${openedInNewTab ? "tab" : "popup"} to complete the payment.`}
      icon={<ProviderLogo className="size-10" />}
    />
  );
}

function isCompletedStatus(status: string) {
  return status.includes("COMPLETED");
}

function isFailedStatus(status: string) {
  return ["FAILED", "CANCELLED", "CANCELED"].some((value) =>
    status.includes(value),
  );
}
