import { WALLET_BUTTON_HEIGHT } from "./constants";

export function WalletButtonSkeleton() {
  return (
    <div
      style={{ height: `${WALLET_BUTTON_HEIGHT}px` }}
      className="flex items-center gap-2 rounded-xl bg-button-light dark:bg-button-dark animate-pulse pointer-events-none px-3"
      aria-hidden="true"
    >
      <div className="size-6 rounded-full bg-icon-background-light dark:bg-icon-background-dark" />
      <div className="h-3 w-full rounded bg-icon-background-light dark:bg-icon-background-dark" />
    </div>
  );
}
