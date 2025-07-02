export function OrSeparator() {
  return (
    <div className="flex flex-row w-full items-center justify-center my-4">
      <div className="flex flex-grow h-[1px] bg-icon-text-light/20 dark:bg-icon-text-dark/20" />
      <span className="mx-2 text-xs text-icon-text-light/60 dark:text-icon-text-dark/60">
        OR
      </span>
      <div className="flex flex-grow h-[1px] bg-icon-text-light/20 dark:bg-icon-text-dark/20" />
    </div>
  );
}
