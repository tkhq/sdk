import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  TurnkeyError,
  TurnkeyErrorCodes,
  type OnRampCaip19,
  type OnRampCaip2,
  type StamperType,
  type TGetFiatOffRampQuotesBody,
  type v1FiatOffRampQuote,
  type v1FiatRampCurrency,
  type v1FiatOnRampQuote,
  type WalletAccount,
} from "@turnkey/core";
import { useTurnkey } from "../../providers/client/Hook";
import { useModal } from "../../providers/modal/Hook";
import { onRampTokensForAccount, rankQuotes } from "../../utils/funding";
import { ActionButton } from "../design/Buttons";
import { CryptoAmountInput } from "./CryptoAmountInput";
import { CurrencyDropdown } from "./CurrencyDropdown";
import { OffRampDeposit } from "./OffRampDeposit";
import {
  OFFRAMP_POPUP_NAME,
  clearOffRampHandoff,
  offrampRedirectUrl,
  saveOffRampHandoff,
} from "./offRampRedirect";
import {
  OffRampPayoutSelect,
  offRampPayoutMethods,
  type OffRampPayoutId,
} from "./PaymentMethods";
import { QuoteDetails } from "./QuoteDetails";

export type OffRampAmountProps = {
  lockedCaip19?: OnRampCaip19 | undefined;
  lockedCaip2?: OnRampCaip2 | undefined;
  walletAccount: WalletAccount;
  payout?: OffRampPayoutId | undefined;
  fiatCurrencyCode?: v1FiatRampCurrency | undefined;
  defaultCryptoAmount?: string | undefined;
  countryCode?: string | undefined;
  countrySubdivisionCode?: string | undefined;
  sandboxMode?: boolean | undefined;
  organizationId?: string | undefined;
  stampWith?: StamperType | undefined;
  openInNewTab?: boolean | undefined;
  rpcUrl?: string | undefined;
  successPageDuration?: number | undefined;
  onSuccess?: (() => void) | undefined;
  onError?: ((error: unknown) => void) | undefined;
};

export function OffRampAmount(props: OffRampAmountProps) {
  const {
    lockedCaip19,
    lockedCaip2,
    walletAccount,
    payout: initialPayout,
    fiatCurrencyCode,
    defaultCryptoAmount,
    countryCode,
    countrySubdivisionCode,
    sandboxMode,
    organizationId,
    stampWith,
    openInNewTab,
    rpcUrl,
    successPageDuration,
    onSuccess,
    onError,
  } = props;
  const { httpClient } = useTurnkey();
  const { isMobile, pushPage } = useModal();
  const [payout, setPayout] = useState(initialPayout);
  const [currency, setCurrency] = useState<v1FiatRampCurrency>(
    fiatCurrencyCode ?? "FIAT_RAMP_CURRENCY_USD",
  );
  const [amount, setAmount] = useState(defaultCryptoAmount ?? "0");
  const [quotes, setQuotes] = useState<v1FiatOnRampQuote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<
    v1FiatOnRampQuote | undefined
  >(undefined);
  const [fetchingQuotes, setFetchingQuotes] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);
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
        cryptoAmount: amount,
        fiatCurrencyCode: currency,
        caip19: token,
        sandboxMode: sandboxMode ?? false,
        ...(organizationId ? { organizationId } : {}),
        ...(countryCode ? { countryCode } : {}),
        ...(countrySubdivisionCode ? { countrySubdivisionCode } : {}),
      } as TGetFiatOffRampQuotesBody;
      const pending = stampWith
        ? httpClient.getFiatOffRampQuotes(request, stampWith)
        : httpClient.getFiatOffRampQuotes(request);

      pending
        .then((response) => {
          if (!active) return;
          const methods = offRampPayoutMethods(payout);
          const ranked = rankQuotes(
            response.quotes
              .filter((quote) => {
                if (
                  sandboxMode &&
                  quote.provider === "FIAT_RAMP_PROVIDER_COINBASE"
                ) {
                  return false;
                }
                return !methods || methods.includes(quote.paymentMethod);
              })
              .map(asOnRampQuote),
            "fiat",
          );
          setQuotes(ranked.map((item) => item.quote));
          setSelectedQuote(ranked[0]?.quote);
        })
        .catch((caught: unknown) => {
          if (!active) return;
          console.error(caught);
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
    payout,
    sandboxMode,
    stampWith,
    token,
  ]);

  useEffect(() => {
    setError(false);
  }, [amount, token, selectedQuote]);

  const handleContinue = async () => {
    if (!httpClient || !selectedQuote || !token) return;

    // Saved before the popup opens so that window can read it on the way back.
    // A popup only inherits sessionStorage from the moment it is opened.
    saveOffRampHandoff({
      token,
      amount: selectedQuote.cryptoAmount.display || amount,
      atomicAmount: selectedQuote.cryptoAmount.amount,
      provider: selectedQuote.provider,
      walletAccount,
      ...(organizationId ? { organizationId } : {}),
      ...(stampWith ? { stampWith } : {}),
      ...(rpcUrl ? { rpcUrl } : {}),
      sandboxMode: sandboxMode ?? false,
      ...(successPageDuration !== undefined ? { successPageDuration } : {}),
    });

    // Open during the click. A window opened after the session request is
    // treated as unsolicited and blocked.
    const openedInNewTab = isMobile || !!openInNewTab;
    const widget = window.open(
      "",
      openedInNewTab ? "_blank" : "turnkey-offramp",
      openedInNewTab
        ? undefined
        : "popup,width=500,height=700,scrollbars=yes,resizable=yes",
    );
    if (!widget) {
      clearOffRampHandoff();
      setError(true);
      setShaking(true);
      setTimeout(() => setShaking(false), 250);
      onError?.(
        new TurnkeyError(
          "Failed to open the offramp widget.",
          TurnkeyErrorCodes.BAD_RESPONSE,
        ),
      );
      return;
    }
    widget.name = OFFRAMP_POPUP_NAME;

    setCreatingSession(true);
    setError(false);
    try {
      const redirectUrl = offrampRedirectUrl({
        provider: selectedQuote.provider,
      });
      const request = {
        quoteId: selectedQuote.quoteId,
        walletAddress: walletAccount.address,
        ...(redirectUrl ? { redirectUrl } : {}),
        ...(organizationId ? { organizationId } : {}),
      };
      const result = stampWith
        ? await httpClient.createFiatOffRampSession(request, stampWith)
        : await httpClient.createFiatOffRampSession(request);
      if (widget.closed) {
        clearOffRampHandoff();
        return;
      }
      widget.location.href = result.offRampUrl;

      pushPage({
        key: "Sell",
        showTitle: false,
        content: (
          <OffRampDeposit
            token={token}
            amount={selectedQuote.cryptoAmount.display || amount}
            atomicAmount={selectedQuote.cryptoAmount.amount}
            walletAccount={walletAccount}
            provider={selectedQuote.provider}
            organizationId={organizationId}
            stampWith={stampWith}
            rpcUrl={rpcUrl}
            sandboxMode={sandboxMode ?? false}
            successPageDuration={successPageDuration}
            widget={widget}
            onSuccess={() => onSuccess?.()}
          />
        ),
      });
    } catch (caught) {
      clearOffRampHandoff();
      widget.close();
      setError(true);
      setShaking(true);
      setTimeout(() => setShaking(false), 250);
      onError?.(caught);
    } finally {
      setCreatingSession(false);
    }
  };

  return (
    <div
      className={clsx(
        "relative flex flex-col items-center justify-center gap-4 py-4 transition-all duration-300 text-center",
        isMobile ? "w-full" : "w-96",
      )}
    >
      <div className="flex w-full flex-col items-center gap-1">
        {token && (
          <CryptoAmountInput
            value={amount}
            onChange={setAmount}
            token={token}
            tokens={tokens}
            onTokenChange={setToken}
            locked={!!lockedCaip19}
          />
        )}
        <div className="flex items-center gap-2 text-sm text-icon-text-light dark:text-icon-text-dark">
          <span>Receive</span>
          <CurrencyDropdown value={currency} onChange={setCurrency} />
        </div>
      </div>
      <div className="flex w-full flex-col items-center gap-2">
        <QuoteDetails
          quote={selectedQuote}
          quotes={quotes}
          amount={amount}
          amountBasis="crypto"
          yieldOn="fiat"
          loading={fetchingQuotes}
          onSelect={setSelectedQuote}
        />
        <OffRampPayoutSelect value={payout} onChange={setPayout} />
      </div>

      <div className="flex w-full flex-col items-center gap-2">
        <ActionButton
          name="offramp-continue"
          onClick={handleContinue}
          disabled={fetchingQuotes || !selectedQuote}
          loading={creatingSession}
          className={clsx(
            "w-full bg-primary-light text-primary-text-light dark:bg-primary-dark dark:text-primary-text-dark",
            shaking && "animate-shake",
          )}
          spinnerClassName="text-primary-text-light dark:text-primary-text-dark"
        >
          Continue
        </ActionButton>
        <p
          data-testid="offramp-error"
          className={clsx(
            "text-sm text-danger-light dark:text-danger-dark transition-opacity delay-75 line-clamp-2 w-full",
            error
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none absolute",
          )}
        >
          Unable to start this sale
        </p>
        {sandboxMode && (
          <span className="text-xs text-icon-text-light dark:text-icon-text-dark">
            Sandbox mode. Sepolia or Solana devnet tokens will be used.
          </span>
        )}
      </div>
    </div>
  );
}

function asOnRampQuote(quote: v1FiatOffRampQuote): v1FiatOnRampQuote {
  return {
    quoteId: quote.quoteId,
    provider: quote.provider,
    ...(quote.serviceProvider
      ? { serviceProvider: quote.serviceProvider }
      : {}),
    fiatAmount: quote.fiatAmount,
    fiatCurrencyCode: quote.fiatCurrencyCode,
    cryptoAmount: quote.cryptoAmount,
    caip19: quote.caip19,
    paymentMethod: quote.paymentMethod,
    totalFee: quote.totalFee,
    ...(quote.expiresAt ? { expiresAt: quote.expiresAt } : {}),
  };
}
