import type { v1FiatOnRampQuote } from "@turnkey/core";
import clsx from "clsx";
import { forwardRef } from "react";
import { QuoteOption } from "./QuoteOption";

export type QuotePickerProps = {
  quotes: v1FiatOnRampQuote[];
  onSelect: (quote: v1FiatOnRampQuote) => void;
  className?: string;
};

export const QuotePicker = forwardRef<HTMLDivElement, QuotePickerProps>(
  function QuotePicker(props, ref) {
    const { quotes, onSelect, className } = props;

    return (
      <div ref={ref} className={clsx("flex w-full flex-col gap-2", className)}>
        {quotes.map((quote) => (
          <QuoteOption key={quote.quoteId} quote={quote} onSelect={onSelect} />
        ))}
      </div>
    );
  },
);
