import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { _internal_ComponentButton } from "@headlessui/react";
import clsx from "clsx";
import { Spinner } from "./Spinners";

interface IconButtonProps {
  icon: IconDefinition;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  spinnerClassName?: string;
}

export function BaseButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>,
) {
  const { children, className, disabled, ...buttonProps } = props;

  return (
    <button
      className={clsx("cursor-pointer", className)}
      disabled={!!disabled}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
export function IconButton(props: IconButtonProps) {
  const { icon, onClick, disabled, loading, className, spinnerClassName } =
    props;
  return (
    <BaseButton
      className={clsx(
        "flex items-center justify-center p-2 rounded-full border-none text-icon-text-light dark:text-icon-text-dark bg-icon-background-light dark:bg-icon-background-dark active:outline-2 active:outline-primary-light active:dark:outline-primary-dark",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
      onClick={onClick}
      disabled={!!disabled}
    >
      {loading ? (
        <div className="flex justify-center items-center">
          <Spinner className={clsx("w-4 h-4", spinnerClassName)} />
        </div>
      ) : (
        <FontAwesomeIcon icon={icon} />
      )}
    </BaseButton>
  );
}

interface ActionButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  className?: string;
  spinnerClassName?: string;
}

export function ActionButton(props: ActionButtonProps) {
  const {
    children,
    onClick,
    onMouseEnter,
    onMouseLeave,
    disabled,
    loading,
    loadingText,
    className,
    spinnerClassName,
  } = props;
  return (
    <BaseButton
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      disabled={disabled || loading}
      className={clsx(
        "w-full px-4 py-3 rounded-md border border-modal-background-dark/15 dark:border-modal-background-light/15 focus:outline-primary-light focus:dark:outline-primary-dark focus:outline-[1px] focus:outline-offset-0 transition-all duration-300",
        (disabled || loading) && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      {loading ? (
        <div className="flex justify-center space-x-2 items-center text-sm">
          <Spinner className={clsx("w-4 h-4", spinnerClassName)} />
          {loadingText && (
            <span className={spinnerClassName}>{loadingText}</span>
          )}
        </div>
      ) : (
        children
      )}
    </BaseButton>
  );
}
