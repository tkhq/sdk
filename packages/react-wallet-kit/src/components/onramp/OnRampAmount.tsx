import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  OnRampCaip19Values,
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
import { rankQuotes } from "./rankQuotes";
import { TokenSelect } from "./TokenSelect";

function caip2Of(token: OnRampCaip19): string {
  return token.slice(0, token.indexOf("/"));
}

function onRampTokensForAccount(
  walletAccount?: WalletAccount | undefined,
  locked?: {
    caip19?: OnRampCaip19 | undefined;
    caip2?: OnRampCaip2 | undefined;
  },
): OnRampCaip19[] {
  if (locked?.caip19) return [locked.caip19];

  let tokens: readonly OnRampCaip19[] = OnRampCaip19Values;
  if (walletAccount?.addressFormat === "ADDRESS_FORMAT_ETHEREUM") {
    tokens = tokens.filter((token) => caip2Of(token).startsWith("eip155:"));
  } else if (walletAccount?.addressFormat === "ADDRESS_FORMAT_SOLANA") {
    tokens = tokens.filter((token) => caip2Of(token).startsWith("solana:"));
  }

  if (locked?.caip2) {
    tokens = tokens.filter((token) => caip2Of(token) === locked.caip2);
  }

  return [...tokens];
}

export type OnRampAmountProps = {
  lockedCaip19?: OnRampCaip19 | undefined;
  lockedCaip2?: OnRampCaip2 | undefined;
  walletAccount?: WalletAccount | undefined;
  paymentMethod?: v1FiatOnRampPaymentMethod | undefined;
  fiatCurrencyCode?: v1FiatOnRampCurrency | undefined;
  defaultFiatCurrencyAmount?: string | undefined;
  sandboxMode?: boolean | undefined;
  organizationId?: string | undefined;
  stampWith?: StamperType | undefined;
};

export function OnRampAmount(props: OnRampAmountProps) {
  const {
    lockedCaip19,
    lockedCaip2,
    walletAccount,
    paymentMethod: initialPaymentMethod,
    fiatCurrencyCode,
    defaultFiatCurrencyAmount,
    sandboxMode,
    organizationId,
    stampWith,
  } = props;
  const { httpClient } = useTurnkey();
  const { isMobile } = useModal();
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
        // TODO (Amir): Figure out if we can / should hardocde the country or ask the user to pass it in
        countryCode: "US",
        countrySubdivisionCode: "NY",
        sandboxMode: sandboxMode ?? false,
        ...(organizationId ? { organizationId } : {}),
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
      console.log(result);
    } catch (error) {
      console.error(error);
    } finally {
      setCreatingSession(false);
    }
  };

  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center gap-4 py-5 transition-all duration-300 text-center",
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
    </div>
  );
}
