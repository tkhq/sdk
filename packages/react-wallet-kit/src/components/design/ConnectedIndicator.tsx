interface ConnectedIndicatorProps {
  isPinging?: boolean;
}
export function ConnectedIndicator(props: ConnectedIndicatorProps) {
  const { isPinging = false } = props;
  return (
    <div className="flex absolute top-[-2px] right-0">
      {isPinging && (
        <div className="absolute animate-ping size-[6px] bg-success-light dark:bg-success-dark rounded-full border border-modal-background-light dark:border-modal-background-dark" />
      )}
      <div className="size-[6px] bg-success-light dark:bg-success-dark rounded-full border border-modal-background-light dark:border-modal-background-dark" />
    </div>
  );
}
