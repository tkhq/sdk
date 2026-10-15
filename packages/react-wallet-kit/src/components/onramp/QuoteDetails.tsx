import { faQuestion } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { v1FiatOnRampQuote } from "@turnkey/core";
import clsx from "clsx";
import { BaseButton } from "../design/Buttons";
import { useModal } from "../../providers/modal/Hook";
import { QuoteSummary } from "./QuoteOption";
import { QuotePicker } from "./QuotePicker";

function SkeletonLine() {
  return (
    <div className="relative">
      <span className="invisible">Fiat amount</span>
      <div className={skeletonBarClass} />
    </div>
  );
}

const panelClassName =
  "flex w-full flex-col gap-2 rounded-md border border-modal-background-dark/20 dark:border-modal-background-light/20 bg-button-light dark:bg-button-dark px-3 py-3 text-left text-sm/[normal] box-border";

const skeletonBarClass =
  "absolute inset-x-0 top-1/2 h-[1em] -translate-y-1/2 rounded bg-icon-background-light dark:bg-icon-background-dark";

export type QuoteDetailsProps = {
  quote?: v1FiatOnRampQuote | undefined;
  quotes: v1FiatOnRampQuote[];
  amount?: string | undefined;
  loading?: boolean;
  onSelect: (quote: v1FiatOnRampQuote) => void;
};

export function QuoteDetails(props: QuoteDetailsProps) {
  const { quote, quotes, amount, loading, onSelect } = props;
  const { openSheet, closeSheet } = useModal();
  const canPick = !loading && !!quote && quotes.length > 1;
  const entered = Number(amount);
  const needsAmount =
    amount !== undefined && (!Number.isFinite(entered) || entered <= 0);

  if (loading) {
    return (
      <div
        aria-hidden
        className={clsx(panelClassName, "pointer-events-none animate-pulse")}
      >
        <SkeletonLine />
        <SkeletonLine />
        <SkeletonLine />
        <div className="relative mt-1 flex items-center justify-center border-t border-modal-background-dark/15 pt-2 text-xs dark:border-modal-background-light/15">
          <span className="invisible">MoonPay</span>
          <div className="absolute top-1/2 left-1/2 h-[1em] w-1/3 -translate-x-1/2 -translate-y-1/2 rounded bg-icon-background-light dark:bg-icon-background-dark" />
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div
        className={clsx(
          panelClassName,
          "flex flex-col items-center py-6 text-center text-icon-text-light dark:text-icon-text-dark",
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-icon-background-light text-xl dark:bg-icon-background-dark">
          {needsAmount ? (
            ":(" // :(
          ) : (
            <FontAwesomeIcon icon={faQuestion} className="text-4xl" />
          )}
        </span>
        <p className="text-center">
          {needsAmount
            ? "Please enter an input amount"
            : "No quotes found. Try a different amount, currency, or token."}
        </p>
      </div>
    );
  }

  const details = (
    <QuoteSummary quote={quote} amount={amount} showChevron={canPick} />
  );

  if (!canPick) {
    return <div className={panelClassName}>{details}</div>;
  }

  return (
    <BaseButton
      type="button"
      name="fiat-onramp-quote"
      onClick={() =>
        openSheet({
          key: "All quotes",
          showTitle: false,
          content: (
            <QuotePicker
              quotes={quotes}
              amount={amount}
              onSelect={(next) => {
                onSelect(next);
                closeSheet();
              }}
            />
          ),
        })
      }
      className={clsx(
        panelClassName,
        "transition-all focus:outline-primary-light focus:dark:outline-primary-dark focus:outline-[1px] focus:outline-offset-0",
      )}
    >
      {details}
    </BaseButton>
  );
}
