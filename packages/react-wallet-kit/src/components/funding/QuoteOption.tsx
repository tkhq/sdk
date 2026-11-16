import {
  faChevronRight,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type {
  v1FiatRampAmount,
  v1FiatRampCurrency,
  v1FiatRampProvider,
  v1FiatOnRampQuote,
} from "@turnkey/core";
import { BaseButton } from "../design/Buttons";
import { CoinbaseLogo, MeldLogo, MoonPayLogo } from "../design/Svg";
import { useSupportedAssets } from "../../providers/SupportedAssetsProvider";
import { tokenSymbol } from "../../utils/funding";

const providerNames = {
  FIAT_RAMP_PROVIDER_COINBASE: "Coinbase",
  FIAT_RAMP_PROVIDER_MOONPAY: "MoonPay",
  FIAT_RAMP_PROVIDER_MELD: "Meld",
} as const satisfies Record<v1FiatRampProvider, string>;

export const providerLogos = {
  FIAT_RAMP_PROVIDER_COINBASE: CoinbaseLogo,
  FIAT_RAMP_PROVIDER_MOONPAY: MoonPayLogo,
  FIAT_RAMP_PROVIDER_MELD: MeldLogo,
} as const satisfies Record<v1FiatRampProvider, typeof CoinbaseLogo>;

export function providerName(provider: v1FiatRampProvider) {
  return providerNames[provider];
}

function capitalize(value: string) {
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export type QuoteAmountBasis = "fiat" | "crypto";

export type QuoteOptionProps = {
  quote: v1FiatOnRampQuote;
  amount?: string | undefined;
  amountBasis?: QuoteAmountBasis | undefined;
  onSelect: (quote: v1FiatOnRampQuote) => void;
};

export function QuoteOption(props: QuoteOptionProps) {
  const { quote, amount, amountBasis, onSelect } = props;

  return (
    <BaseButton
      type="button"
      name={`onramp-quote-${quote.quoteId}`}
      onClick={() => onSelect(quote)}
      className="flex w-full flex-col gap-2 rounded-md border border-modal-background-dark/20 dark:border-modal-background-light/20 bg-button-light dark:bg-button-dark px-3 py-3 text-left text-sm box-border transition-all focus:outline-primary-light focus:dark:outline-primary-dark focus:outline-[1px] focus:outline-offset-0"
    >
      <QuoteSummary quote={quote} amount={amount} amountBasis={amountBasis} />
    </BaseButton>
  );
}

export function QuoteSummary(props: {
  quote: v1FiatOnRampQuote;
  amount?: string | undefined;
  amountBasis?: QuoteAmountBasis | undefined;
  showChevron?: boolean;
}) {
  const { quote, amount, amountBasis = "fiat", showChevron } = props;
  const { assetsByCaip2 } = useSupportedAssets();
  const compared =
    amount === undefined
      ? undefined
      : compareFiatAmount(
          amountBasis === "crypto" ? quote.cryptoAmount : quote.fiatAmount,
          amount,
        );
  const warning = compared ? `${compared} than input amount` : undefined;
  const ProviderLogo = providerLogos[quote.provider];
  const name = providerName(quote.provider);
  const label =
    quote.provider === "FIAT_RAMP_PROVIDER_MELD" && quote.serviceProvider
      ? `${capitalize(quote.serviceProvider)} (${name})`
      : name;

  return (
    <>
      <QuoteRow
        label="Fiat amount"
        value={formatFiat(quote.fiatAmount, quote.fiatCurrencyCode)}
        warning={amountBasis === "fiat" ? warning : undefined}
      />
      <QuoteRow
        label="Crypto amount"
        value={`${quote.cryptoAmount.display} ${tokenSymbol(quote.caip19, assetsByCaip2)}`}
        warning={amountBasis === "crypto" ? warning : undefined}
      />
      <QuoteRow
        label="Total fee"
        value={formatFiat(quote.totalFee, quote.fiatCurrencyCode)}
      />
      <div className="mt-1 flex items-center justify-center gap-1.5 border-t border-modal-background-dark/15 pt-2 text-xs text-icon-text-light dark:border-modal-background-light/15 dark:text-icon-text-dark">
        {ProviderLogo && <ProviderLogo className="size-4 shrink-0" />}
        <span>{label}</span>
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
        <span className="truncate text-modal-text-light dark:text-modal-text-dark">
          {value}
        </span>
      </span>
    </div>
  );
}

function formatFiat(amount: v1FiatRampAmount, currency: v1FiatRampCurrency) {
  const code = currency.slice("FIAT_RAMP_CURRENCY_".length);
  const value = Number(amount.display);
  if (!Number.isFinite(value)) return amount.display;

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: code,
    currencyDisplay: "narrowSymbol",
  }).format(value);
}

function compareFiatAmount(
  quoted: v1FiatRampAmount,
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
