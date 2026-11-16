import { Input } from "@headlessui/react";
import type { v1FiatRampCurrency } from "@turnkey/core";
import clsx from "clsx";
import { useEffect, useMemo, useRef } from "react";
import { CurrencyDropdown } from "./CurrencyDropdown";

const CURRENCY_CODE_PREFIX = "FIAT_RAMP_CURRENCY_";
const MAX_WHOLE_DIGITS = 7;

type CurrencyFormat = {
  symbol: string;
  decimals: number;
};

function currencyFormat(
  currency: v1FiatRampCurrency | undefined,
): CurrencyFormat {
  const code = currency ? currency.slice(CURRENCY_CODE_PREFIX.length) : "USD";
  const format = new Intl.NumberFormat("en", {
    style: "currency",
    currency: code,
    currencyDisplay: "narrowSymbol",
  });
  const parts = format.formatToParts(0);
  const symbol = parts.find((part) => part.type === "currency")?.value ?? "$";

  return {
    symbol,
    decimals: format.resolvedOptions().maximumFractionDigits ?? 2,
  };
}

export function sanitizeAmount(raw: string, decimals: number) {
  let cleaned = raw.replace(/[^\d.]/g, "");
  if (decimals === 0) {
    cleaned = cleaned.replace(/\./g, "");
  } else {
    const dot = cleaned.indexOf(".");
    if (dot !== -1) {
      const whole = cleaned.slice(0, dot);
      const fraction = cleaned
        .slice(dot + 1)
        .replace(/\./g, "")
        .slice(0, decimals);
      cleaned = `${whole}.${fraction}`;
    }
  }

  const [whole, fraction] = cleaned.split(".");
  const normalizedWhole = (whole ?? "")
    .replace(/^0+(?=\d)/, "")
    .slice(0, MAX_WHOLE_DIGITS);

  if (fraction !== undefined) {
    return `${normalizedWhole || "0"}.${fraction}`;
  }
  return normalizedWhole || "0";
}

export type FiatAmountInputProps = {
  value: string;
  onChange: (value: string) => void;
  currency?: v1FiatRampCurrency | undefined;
  onCurrencyChange?: (currency: v1FiatRampCurrency) => void;
  disabled?: boolean;
};

export function FiatAmountInput(props: FiatAmountInputProps) {
  const { value, onChange, currency, onCurrencyChange, disabled } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const format = useMemo(() => currencyFormat(currency), [currency]);

  useEffect(() => {
    const next = sanitizeAmount(value, format.decimals);
    if (next !== value) onChange(next);
  }, [format.decimals, value, onChange]);

  return (
    <div
      className={clsx(
        "w-full flex items-end justify-center gap-1.5 bg-transparent text-inherit px-4 py-4 cursor-text",
        disabled && "opacity-50 cursor-not-allowed",
      )}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="relative max-w-full pb-0.5">
        <span className="pointer-events-none absolute top-0 right-full pr-0.5 text-xs font-bold leading-none">
          {format.symbol}
        </span>
        <span className="invisible whitespace-pre px-0.5 text-6xl font-bold">
          {value || "0"}
        </span>
        <Input
          ref={inputRef}
          data-testid="fiat-amount-input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled ?? false}
          value={value || "0"}
          onChange={(event) =>
            onChange(sanitizeAmount(event.target.value, format.decimals))
          }
          className="absolute inset-0 w-full border-none bg-transparent p-0 text-center text-6xl font-bold text-inherit focus:outline-none focus:ring-0"
        />
      </div>
      {onCurrencyChange && (
        <div className="pb-1" onClick={(event) => event.stopPropagation()}>
          <CurrencyDropdown
            value={currency}
            onChange={onCurrencyChange}
            disabled={disabled ?? false}
          />
        </div>
      )}
    </div>
  );
}
