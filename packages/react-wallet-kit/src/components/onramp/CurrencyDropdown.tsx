import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";
import type { v1FiatOnRampCurrency } from "@turnkey/core";
import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlagImage as OriginalFlagImage } from "react-international-phone";
import { useScreenSize } from "../../utils/utils";

const FlagImage = OriginalFlagImage as React.ElementType;

const CURRENCY_CODE_PREFIX = "FIAT_ON_RAMP_CURRENCY_";

const currencyFlagIso2 = {
  FIAT_ON_RAMP_CURRENCY_AUD: "au",
  FIAT_ON_RAMP_CURRENCY_BGN: "bg",
  FIAT_ON_RAMP_CURRENCY_BRL: "br",
  FIAT_ON_RAMP_CURRENCY_CAD: "ca",
  FIAT_ON_RAMP_CURRENCY_CHF: "ch",
  FIAT_ON_RAMP_CURRENCY_COP: "co",
  FIAT_ON_RAMP_CURRENCY_CZK: "cz",
  FIAT_ON_RAMP_CURRENCY_DKK: "dk",
  FIAT_ON_RAMP_CURRENCY_DOP: "do",
  FIAT_ON_RAMP_CURRENCY_EGP: "eg",
  FIAT_ON_RAMP_CURRENCY_EUR: "eu",
  FIAT_ON_RAMP_CURRENCY_GBP: "gb",
  FIAT_ON_RAMP_CURRENCY_HKD: "hk",
  FIAT_ON_RAMP_CURRENCY_IDR: "id",
  FIAT_ON_RAMP_CURRENCY_ILS: "il",
  FIAT_ON_RAMP_CURRENCY_JOD: "jo",
  FIAT_ON_RAMP_CURRENCY_KES: "ke",
  FIAT_ON_RAMP_CURRENCY_KWD: "kw",
  FIAT_ON_RAMP_CURRENCY_LKR: "lk",
  FIAT_ON_RAMP_CURRENCY_MXN: "mx",
  FIAT_ON_RAMP_CURRENCY_NGN: "ng",
  FIAT_ON_RAMP_CURRENCY_NOK: "no",
  FIAT_ON_RAMP_CURRENCY_NZD: "nz",
  FIAT_ON_RAMP_CURRENCY_OMR: "om",
  FIAT_ON_RAMP_CURRENCY_PEN: "pe",
  FIAT_ON_RAMP_CURRENCY_PLN: "pl",
  FIAT_ON_RAMP_CURRENCY_RON: "ro",
  FIAT_ON_RAMP_CURRENCY_SEK: "se",
  FIAT_ON_RAMP_CURRENCY_THB: "th",
  FIAT_ON_RAMP_CURRENCY_TRY: "tr",
  FIAT_ON_RAMP_CURRENCY_TWD: "tw",
  FIAT_ON_RAMP_CURRENCY_USD: "us",
  FIAT_ON_RAMP_CURRENCY_VND: "vn",
  FIAT_ON_RAMP_CURRENCY_ZAR: "za",
} as const satisfies Record<v1FiatOnRampCurrency, string>;

const fiatOnRampCurrencies = Object.keys(
  currencyFlagIso2,
) as v1FiatOnRampCurrency[];

function currencyCode(currency: v1FiatOnRampCurrency) {
  return currency.slice(CURRENCY_CODE_PREFIX.length);
}

type Placement = "top start" | "bottom start";
const desiredPanelHeight = 288;

export type CurrencyDropdownProps = {
  value?: v1FiatOnRampCurrency | undefined;
  onChange: (currency: v1FiatOnRampCurrency) => void;
  disabled?: boolean;
};

export function CurrencyDropdown(props: CurrencyDropdownProps) {
  const { value, onChange, disabled } = props;
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [placement, setPlacement] = useState<Placement>("bottom start");
  const { height } = useScreenSize();

  const update = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;

    const bounds = btn.getBoundingClientRect();
    const spaceAbove = bounds.top;
    const spaceBelow = height - bounds.bottom;

    const next: Placement =
      spaceBelow < desiredPanelHeight && spaceAbove > spaceBelow
        ? "top start"
        : "bottom start";

    setPlacement(next);
  }, [height]);

  useEffect(() => {
    update();
  }, [update, height]);

  return (
    <Listbox<"div", v1FiatOnRampCurrency | undefined>
      as="div"
      value={value}
      onChange={(currency) => {
        if (currency !== undefined) onChange(currency);
      }}
      disabled={disabled ?? false}
    >
      <div className="relative">
        <ListboxButton
          ref={buttonRef}
          data-testid="fiat-currency-dropdown"
          className={clsx(
            "flex items-center gap-1 cursor-pointer border-none bg-transparent p-0 text-inherit focus:outline-none",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <span className="text-lg font-bold leading-none">
            {value ? currencyCode(value) : "USD"}
          </span>
          <FontAwesomeIcon
            icon={faChevronDown}
            className="size-3 shrink-0 text-icon-text-light dark:text-icon-text-dark"
          />
        </ListboxButton>

        <ListboxOptions
          transition
          anchor={placement}
          className="absolute tk-scrollbar z-50 mt-1 w-40 border border-modal-background-dark/20 dark:border-modal-background-light/20 !max-h-72 rounded-md shadow-lg overflow-y-auto overflow-x-hidden text-sm transition duration-200 ease-out data-closed:-translate-y-2 data-closed:opacity-0"
        >
          {fiatOnRampCurrencies.map((currency) => (
            <ListboxOption
              key={currency}
              value={currency}
              className={({ active }) =>
                clsx(
                  "cursor-pointer select-none py-2 px-3 bg-button-light dark:bg-button-dark flex items-center gap-2",
                  active &&
                    "bg-modal-background-light dark:bg-modal-background-dark",
                )
              }
            >
              <CurrencyOptionContent currency={currency} />
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}

function CurrencyOptionContent(props: { currency: v1FiatOnRampCurrency }) {
  const { currency } = props;

  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <FlagImage
        iso2={currencyFlagIso2[currency]}
        className="w-5 h-4 shrink-0 rounded-sm"
      />
      <span className="text-sm">{currencyCode(currency)}</span>
    </span>
  );
}
