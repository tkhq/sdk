import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  TurnkeyError,
  TurnkeyErrorCodes,
  TGetFiatOnRampQuoteBody,
  type OnRampCaip19,
  type OnRampCaip2,
  type StamperType,
  type v1FiatOnRampCurrency,
  type v1FiatOnRampPaymentMethod,
  type v1FiatOnRampQuote,
  type WalletAccount,
} from "@turnkey/core";
import { useTurnkey } from "../../providers/client/Hook";
import { useModal } from "../../providers/modal/Hook";
import { ActionButton } from "../design/Buttons";
import { FiatAmountInput } from "./FiatAmountInput";
import { PaymentMethodSelect } from "./PaymentMethods";
import { QuoteDetails } from "./QuoteDetails";
import { OnRampStatusPage } from "./OnRampStatus";
import { onRampTokensForAccount } from "./onRampTokens";
import { rankQuotes } from "./rankQuotes";
import { TokenSelect } from "./TokenSelect";

export type OnRampAmountProps = {
  lockedCaip19?: OnRampCaip19 | undefined;
  lockedCaip2?: OnRampCaip2 | undefined;
  walletAccount?: WalletAccount | undefined;
  paymentMethod?: v1FiatOnRampPaymentMethod | undefined;
  fiatCurrencyCode?: v1FiatOnRampCurrency | undefined;
  defaultFiatCurrencyAmount?: string | undefined;
  countryCode?: string | undefined;
  countrySubdivisionCode?: string | undefined;
  sandboxMode?: boolean | undefined;
  organizationId?: string | undefined;
  stampWith?: StamperType | undefined;
  openInNewTab?: boolean | undefined;
  successPageDuration?: number | undefined;
  onSuccess?: (() => void) | undefined;
  onError?: ((error: unknown) => void) | undefined;
};

export function OnRampAmount(props: OnRampAmountProps) {
  const {
    lockedCaip19,
    lockedCaip2,
    walletAccount,
    paymentMethod: initialPaymentMethod,
    fiatCurrencyCode,
    defaultFiatCurrencyAmount,
    countryCode,
    countrySubdivisionCode,
    sandboxMode,
    organizationId,
    stampWith,
    openInNewTab,
    successPageDuration,
    onSuccess,
    onError,
  } = props;
  const { httpClient } = useTurnkey();
  const { isMobile, pushPage, closeModal } = useModal();
  const [paymentMethod, setPaymentMethod] = useState(initialPaymentMethod);
  const [currency, setCurrency] = useState<v1FiatOnRampCurrency>(
    fiatCurrencyCode ?? "FIAT_ON_RAMP_CURRENCY_USD",
  );
  const [amount, setAmount] = useState(defaultFiatCurrencyAmount ?? "0");
  const [quotes, setQuotes] = useState<v1FiatOnRampQuote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<
    v1FiatOnRampQuote | undefined
  >(undefined);
  const [fetchingQuotes, setFetchingQuotes] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const tokens = useMemo(
    () =>
      onRampTokensForAccount(walletAccount, {
        caip19: lockedCaip19,
        caip2: lockedCaip2,
      }),
    [walletAccount, lockedCaip19, lockedCaip2],
  );
  const [token, setToken] = useState<OnRampCaip19 | undefined>(
    lockedCaip19 ?? tokens[0],
  );
  useEffect(() => {
    if (lockedCaip19) {
      setToken(lockedCaip19);
      return;
    }
    if (!token || !tokens.includes(token)) {
      setToken(tokens[0]);
    }
  }, [lockedCaip19, token, tokens]);

  useEffect(() => {
    if (!httpClient || !token) {
      setQuotes([]);
      setSelectedQuote(undefined);
      setFetchingQuotes(false);
      return;
    }

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setQuotes([]);
      setSelectedQuote(undefined);
      setFetchingQuotes(false);
      return;
    }

    let active = true;
    setFetchingQuotes(true);
    setSelectedQuote(undefined);

    const timer = setTimeout(() => {
      const request = {
        fiatAmount: amount,
        fiatCurrencyCode: currency,
        caip19: token,
        sandboxMode: sandboxMode ?? false,
        ...(organizationId ? { organizationId } : {}),
        ...(countryCode ? { countryCode } : {}),
        ...(countrySubdivisionCode ? { countrySubdivisionCode } : {}),
      } as TGetFiatOnRampQuoteBody;
      const pending = stampWith
        ? httpClient.getFiatOnRampQuote(request, stampWith)
        : httpClient.getFiatOnRampQuote(request);

      pending
        .then((response) => {
          if (!active) return;
          const ranked = rankQuotes(
            response.quotes.filter(
              (quote) =>
                !paymentMethod || quote.paymentMethod === paymentMethod,
            ),
          );
          setQuotes(ranked.map((item) => item.quote));
          setSelectedQuote(ranked[0]?.quote);
        })
        .catch((error: unknown) => {
          if (!active) return;
          console.error(error);
          setQuotes([]);
          setSelectedQuote(undefined);
        })
        .finally(() => {
          if (active) setFetchingQuotes(false);
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    amount,
    countryCode,
    countrySubdivisionCode,
    currency,
    httpClient,
    organizationId,
    paymentMethod,
    sandboxMode,
    stampWith,
    token,
  ]);

  const tokenAmount =
    selectedQuote && selectedQuote.caip19 === token
      ? selectedQuote.cryptoAmount.display
      : undefined;

  const handleContinue = async () => {
    if (!httpClient || !selectedQuote || !walletAccount) return;

    // Open during the click. A window opened after the session request is
    // treated as unsolicited and blocked.
    const openedInNewTab = isMobile || !!openInNewTab;
    const widget = window.open(
      "",
      openedInNewTab ? "_blank" : "turnkey-onramp",
      openedInNewTab
        ? undefined
        : "popup,width=500,height=700,scrollbars=yes,resizable=yes",
    );
    if (!widget) {
      onError?.(
        new TurnkeyError(
          "Failed to open the onramp widget.",
          TurnkeyErrorCodes.BAD_RESPONSE,
        ),
      );
      closeModal();
      return;
    }

    setCreatingSession(true);
    try {
      const request = {
        quoteId: selectedQuote.quoteId,
        walletAddress: walletAccount.address,
        ...(organizationId ? { organizationId } : {}),
      };
      const result = stampWith
        ? await httpClient.createFiatOnRampSession(request, stampWith)
        : await httpClient.createFiatOnRampSession(request);
      if (widget.closed) return;
      widget.location.href = result.onRampUrl;

      pushPage({
        key: "Buy",
        showTitle: false,
        content: (
          <OnRampStatusPage
            transactionId={result.onRampTransactionId}
            organizationId={organizationId}
            stampWith={stampWith}
            provider={selectedQuote.onrampProvider}
            openedInNewTab={openedInNewTab}
            successPageDuration={successPageDuration}
            onSuccess={() => onSuccess?.()}
            onError={(error) => onError?.(error)}
          />
        ),
      });
    } catch (error) {
      widget.close();
      onError?.(error);
      closeModal();
    } finally {
      setCreatingSession(false);
    }
  };

  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center gap-4 py-4 transition-all duration-300 text-center",
        isMobile ? "w-full" : "w-96",
      )}
    >
      <div className="flex w-full flex-col items-center gap-1">
        <FiatAmountInput
          value={amount}
          onChange={setAmount}
          currency={currency}
          onCurrencyChange={setCurrency}
        />
        {token && (
          <TokenSelect
            tokens={tokens}
            value={token}
            onChange={setToken}
            amount={tokenAmount}
            locked={!!lockedCaip19}
          />
        )}
      </div>
      <div className="flex w-full flex-col items-center gap-2">
        <QuoteDetails
          quote={selectedQuote}
          quotes={quotes}
          amount={amount}
          loading={fetchingQuotes}
          onSelect={setSelectedQuote}
        />
        <PaymentMethodSelect
          value={paymentMethod}
          onChange={setPaymentMethod}
        />
      </div>

      <div className="flex w-full flex-col items-cente gap-2">
        <ActionButton
          name="onramp-continue"
          onClick={handleContinue}
          disabled={fetchingQuotes || !selectedQuote || !walletAccount}
          loading={creatingSession}
          className="w-full bg-primary-light text-primary-text-light dark:bg-primary-dark dark:text-primary-text-dark"
          spinnerClassName="text-primary-text-light dark:text-primary-text-dark"
        >
          Continue
        </ActionButton>
        {sandboxMode && (
          <span className="text-xs text-icon-text-light dark:text-icon-text-dark">
            Sandbox mode enabled. No real funds will be used.
          </span>
        )}
      </div>
    </div>
  );
}
