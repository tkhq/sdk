import { faChevronRight, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type {
  v1FiatOnRampAmount,
  v1FiatOnRampCurrency,
  v1FiatOnRampProvider,
  v1FiatOnRampQuote,
} from "@turnkey/core";
import { BaseButton } from "../design/Buttons";
import { CoinbaseLogo, MoonPayLogo } from "../design/Svg";
import { useSupportedAssets } from "../../providers/SupportedAssetsProvider";
import { tokenSymbol } from "./tokenSymbol";

const providerNames = {
  FIAT_ON_RAMP_PROVIDER_COINBASE: "Coinbase",
  FIAT_ON_RAMP_PROVIDER_MOONPAY: "MoonPay",
} as const satisfies Record<v1FiatOnRampProvider, string>;

const providerLogos = {
  FIAT_ON_RAMP_PROVIDER_COINBASE: CoinbaseLogo,
  FIAT_ON_RAMP_PROVIDER_MOONPAY: MoonPayLogo,
} as const satisfies Record<v1FiatOnRampProvider, typeof CoinbaseLogo>;

export function providerName(provider: v1FiatOnRampProvider) {
  return providerNames[provider];
}

export type QuoteOptionProps = {
  quote: v1FiatOnRampQuote;
  amount?: string | undefined;
  onSelect: (quote: v1FiatOnRampQuote) => void;
};

export function QuoteOption(props: QuoteOptionProps) {
  const { quote, amount, onSelect } = props;

  return (
    <BaseButton
      type="button"
      name={`onramp-quote-${quote.quoteId}`}
      onClick={() => onSelect(quote)}
      className="flex w-full flex-col gap-2 rounded-md border border-modal-background-dark/20 dark:border-modal-background-light/20 bg-button-light dark:bg-button-dark px-3 py-3 text-left text-sm box-border transition-all focus:outline-primary-light focus:dark:outline-primary-dark focus:outline-[1px] focus:outline-offset-0"
    >
      <QuoteSummary quote={quote} amount={amount} />
    </BaseButton>
  );
}

export function QuoteSummary(props: {
  quote: v1FiatOnRampQuote;
  amount?: string | undefined;
  showChevron?: boolean;
}) {
  const { quote, amount, showChevron } = props;
  const { assetsByCaip2 } = useSupportedAssets();
  const fiatComparison =
    amount === undefined
      ? undefined
      : compareFiatAmount(quote.fiatAmount, amount);
  const ProviderLogo = providerLogos[quote.onrampProvider];

  return (
    <>
      <QuoteRow
        label="Fiat amount"
        value={formatFiat(quote.fiatAmount, quote.fiatCurrencyCode)}
        warning={
          fiatComparison ? `${fiatComparison} than input amount` : undefined
        }
      />
      <QuoteRow
        label="Crypto amount"
        value={`${quote.cryptoAmount.display} ${tokenSymbol(quote.caip19, assetsByCaip2)}`}
      />
      <QuoteRow
        label="Total fee"
        value={formatFiat(quote.totalFee, quote.fiatCurrencyCode)}
      />
      <div className="mt-1 flex items-center justify-center gap-1.5 border-t border-modal-background-dark/15 pt-2 text-xs text-icon-text-light dark:border-modal-background-light/15 dark:text-icon-text-dark">
        <ProviderLogo className="size-4 shrink-0" />
        <span>{providerName(quote.onrampProvider)}</span>
        {showChevron && (
          <FontAwesomeIcon icon={faChevronRight} className="size-3" />
        )}
      </div>
    </>
  );
}

function QuoteRow(props: {
  label: string;
  value: string;
  warning?: string | undefined;
}) {
  const { label, value, warning } = props;

  return (
    <div className="flex w-full items-center justify-between gap-3">
      <span className="text-icon-text-light dark:text-icon-text-dark">
        {label}
      </span>
      <span className="flex min-w-0 items-center justify-end gap-1.5">
        {warning && (
          <span className="flex items-center gap-1 text-xs text-danger-light dark:text-danger-dark">
            <FontAwesomeIcon
              icon={faTriangleExclamation}
              className="size-3 shrink-0"
            />
            {warning}
          </span>
        )}
        <span className="truncate text-primary-text-light dark:text-primary-text-dark">
          {value}
        </span>
      </span>
    </div>
  );
}

function formatFiat(
  amount: v1FiatOnRampAmount,
  currency: v1FiatOnRampCurrency,
) {
  const code = currency.slice("FIAT_ON_RAMP_CURRENCY_".length);
  const value = Number(amount.display);
  if (!Number.isFinite(value)) return amount.display;

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: code,
    currencyDisplay: "narrowSymbol",
  }).format(value);
}

function compareFiatAmount(
  quoted: v1FiatOnRampAmount,
  input: string,
): "Higher" | "Lower" | undefined {
  const quotedAtomic = toAtomic(quoted.display, quoted.decimals);
  const inputAtomic = toAtomic(input, quoted.decimals);
  if (
    quotedAtomic === undefined ||
    inputAtomic === undefined ||
    quotedAtomic === inputAtomic
  ) {
    return undefined;
  }

  return quotedAtomic > inputAtomic ? "Higher" : "Lower";
}

function toAtomic(value: string, decimals: number): bigint | undefined {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return undefined;

  const [whole = "0", fraction = ""] = trimmed.split(".");
  const digits = `${fraction}${"0".repeat(decimals)}`.slice(0, decimals);

  try {
    return BigInt(`${whole || "0"}${digits}`);
  } catch {
    return undefined;
  }
}

