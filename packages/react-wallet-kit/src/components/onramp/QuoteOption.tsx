import type { v1FiatOnRampProvider, v1FiatOnRampQuote } from "@turnkey/core";
import { BaseButton } from "../design/Buttons";

const providerNames = {
  FIAT_ON_RAMP_PROVIDER_COINBASE: "Coinbase",
  FIAT_ON_RAMP_PROVIDER_MOONPAY: "MoonPay",
} as const satisfies Record<v1FiatOnRampProvider, string>;

export function providerName(provider: v1FiatOnRampProvider) {
  return providerNames[provider];
}

export type QuoteOptionProps = {
  quote: v1FiatOnRampQuote;
  onSelect: (quote: v1FiatOnRampQuote) => void;
};

export function QuoteOption(props: QuoteOptionProps) {
  const { quote, onSelect } = props;

  return (
    <BaseButton
      type="button"
      name={`onramp-quote-${quote.quoteId}`}
      onClick={() => onSelect(quote)}
      className="flex w-full flex-col gap-2 rounded-md border border-modal-background-dark/20 dark:border-modal-background-light/20 bg-button-light dark:bg-button-dark px-3 py-3 text-left text-sm transition-all focus:outline-primary-light focus:dark:outline-primary-dark focus:outline-[1px] focus:outline-offset-0"
    >
      <QuoteRow label="Fiat amount" value={quote.fiatAmount.display} />
      <QuoteRow label="Crypto amount" value={quote.cryptoAmount.display} />
      <QuoteRow label="Total fee" value={quote.totalFee.display} />
      <div className="mt-1 border-t border-modal-background-dark/15 dark:border-modal-background-light/15 pt-2 text-center text-xs text-icon-text-light dark:text-icon-text-dark">
        {providerName(quote.onrampProvider)}
      </div>
    </BaseButton>
  );
}

function QuoteRow(props: { label: string; value: string }) {
  const { label, value } = props;

  return (
    <div className="flex w-full items-center justify-between gap-3">
      <span className="text-icon-text-light dark:text-icon-text-dark">
        {label}
      </span>
      <span className="truncate text-primary-text-light dark:text-primary-text-dark">
        {value}
      </span>
    </div>
  );
}
