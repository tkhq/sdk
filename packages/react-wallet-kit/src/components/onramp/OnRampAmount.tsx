import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  OnRampCaip19Values,
  type OnRampCaip19,
  type OnRampCaip2,
  type v1FiatOnRampCurrency,
  type v1FiatOnRampPaymentMethod,
  type v1FiatOnRampProvider,
  type v1FiatOnRampQuote,
  type WalletAccount,
} from "@turnkey/core";
import { useModal } from "../../providers/modal/Hook";
import { FiatAmountInput } from "./FiatAmountInput";
import { QuoteDetails } from "./QuoteDetails";
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

function fakeQuote(input: {
  quoteId: string;
  onrampProvider: v1FiatOnRampProvider;
  paymentMethod: v1FiatOnRampPaymentMethod;
  cryptoAmount: string;
  cryptoDisplay: string;
  feeAmount: string;
  feeDisplay: string;
}): v1FiatOnRampQuote {
  return {
    quoteId: input.quoteId,
    onrampProvider: input.onrampProvider,
    fiatAmount: { amount: "10000", decimals: 2, display: "100.00" },
    fiatCurrencyCode: "FIAT_ON_RAMP_CURRENCY_USD",
    cryptoAmount: {
      amount: input.cryptoAmount,
      decimals: 18,
      display: input.cryptoDisplay,
    },
    caip19: "eip155:1/slip44:60",
    paymentMethod: input.paymentMethod,
    totalFee: { amount: input.feeAmount, decimals: 2, display: input.feeDisplay },
  };
}

const fakeQuotes: v1FiatOnRampQuote[] = [
  fakeQuote({
    quoteId: "card-moonpay",
    onrampProvider: "FIAT_ON_RAMP_PROVIDER_MOONPAY",
    paymentMethod: "FIAT_ON_RAMP_PAYMENT_METHOD_CREDIT_DEBIT_CARD",
    cryptoAmount: "50000000000000000",
    cryptoDisplay: "0.05",
    feeAmount: "250",
    feeDisplay: "2.50",
  }),
  fakeQuote({
    quoteId: "card-coinbase",
    onrampProvider: "FIAT_ON_RAMP_PROVIDER_COINBASE",
    paymentMethod: "FIAT_ON_RAMP_PAYMENT_METHOD_CREDIT_DEBIT_CARD",
    cryptoAmount: "48000000000000000",
    cryptoDisplay: "0.048",
    feeAmount: "399",
    feeDisplay: "3.99",
  }),
  fakeQuote({
    quoteId: "apple-moonpay",
    onrampProvider: "FIAT_ON_RAMP_PROVIDER_MOONPAY",
    paymentMethod: "FIAT_ON_RAMP_PAYMENT_METHOD_APPLE_PAY",
    cryptoAmount: "49000000000000000",
    cryptoDisplay: "0.049",
    feeAmount: "299",
    feeDisplay: "2.99",
  }),
  fakeQuote({
    quoteId: "apple-coinbase",
    onrampProvider: "FIAT_ON_RAMP_PROVIDER_COINBASE",
    paymentMethod: "FIAT_ON_RAMP_PAYMENT_METHOD_APPLE_PAY",
    cryptoAmount: "47000000000000000",
    cryptoDisplay: "0.047",
    feeAmount: "349",
    feeDisplay: "3.49",
  }),
  fakeQuote({
    quoteId: "google-moonpay",
    onrampProvider: "FIAT_ON_RAMP_PROVIDER_MOONPAY",
    paymentMethod: "FIAT_ON_RAMP_PAYMENT_METHOD_GOOGLE_PAY",
    cryptoAmount: "49500000000000000",
    cryptoDisplay: "0.0495",
    feeAmount: "275",
    feeDisplay: "2.75",
  }),
  fakeQuote({
    quoteId: "google-coinbase",
    onrampProvider: "FIAT_ON_RAMP_PROVIDER_COINBASE",
    paymentMethod: "FIAT_ON_RAMP_PAYMENT_METHOD_GOOGLE_PAY",
    cryptoAmount: "46000000000000000",
    cryptoDisplay: "0.046",
    feeAmount: "425",
    feeDisplay: "4.25",
  }),
];

export type OnRampAmountProps = {
  lockedCaip19?: OnRampCaip19 | undefined;
  lockedCaip2?: OnRampCaip2 | undefined;
  walletAccount?: WalletAccount | undefined;
  quote?: v1FiatOnRampQuote | undefined;
  paymentMethod?: v1FiatOnRampPaymentMethod | undefined;
};

export function OnRampAmount(props: OnRampAmountProps) {
  const { lockedCaip19, lockedCaip2, walletAccount, paymentMethod } = props;
  const { isMobile } = useModal();
  const [currency, setCurrency] = useState<v1FiatOnRampCurrency>(
    "FIAT_ON_RAMP_CURRENCY_USD",
  );
  const [amount, setAmount] = useState("0");
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
  const quotes = useMemo(
    () =>
      fakeQuotes.filter(
        (quote) => !paymentMethod || quote.paymentMethod === paymentMethod,
      ),
    [paymentMethod],
  );
  const [selectedQuote, setSelectedQuote] = useState<
    v1FiatOnRampQuote | undefined
  >(quotes[0]);

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
    const current = selectedQuote;
    if (!current || !quotes.some((quote) => quote.quoteId === current.quoteId)) {
      setSelectedQuote(quotes[0]);
    }
  }, [quotes, selectedQuote]);

  const tokenAmount =
    selectedQuote && selectedQuote.caip19 === token
      ? selectedQuote.cryptoAmount.display
      : undefined;

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
      {selectedQuote && (
        <QuoteDetails
          quote={selectedQuote}
          quotes={quotes}
          onSelect={setSelectedQuote}
        />
      )}
    </div>
  );
}
