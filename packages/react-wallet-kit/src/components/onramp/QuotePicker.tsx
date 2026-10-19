import type { v1FiatOnRampQuote } from "@turnkey/core";
import clsx from "clsx";
import { forwardRef } from "react";
import { SupportedAssetsProvider } from "../../providers/SupportedAssetsProvider";
import { rankQuotes } from "../../utils/onramp";
import { QuoteOption } from "./QuoteOption";

export type QuotePickerProps = {
  quotes: v1FiatOnRampQuote[];
  amount?: string | undefined;
  onSelect: (quote: v1FiatOnRampQuote) => void;
  className?: string;
};

export const QuotePicker = forwardRef<HTMLDivElement, QuotePickerProps>(
  function QuotePicker(props, ref) {
    const { quotes, amount, onSelect, className } = props;

    return (
      <SupportedAssetsProvider>
        <div ref={ref} className={clsx("flex w-full flex-col gap-3", className)}>
          {rankQuotes(quotes).map(({ quote, labels }) => (
            <div key={quote.quoteId} className="flex flex-col gap-1">
              {labels.map((label) => (
                <div
                  key={label}
                  className="px-1 text-xs font-medium text-icon-text-light dark:text-icon-text-dark"
                >
                  {label}
                </div>
              ))}
              <QuoteOption
                quote={quote}
                amount={amount}
                onSelect={onSelect}
              />
            </div>
          ))}
        </div>
      </SupportedAssetsProvider>
    );
  },
);
