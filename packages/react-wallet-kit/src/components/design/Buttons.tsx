import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { _internal_ComponentButton } from "@headlessui/react";
import clsx from "clsx";
import { Spinner } from "./Spinners";

interface IconButtonProps {
  icon: IconDefinition;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
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
  const { icon, onClick, disabled, className } = props;
  return (
    <BaseButton
      className={`flex items-center justify-center p-2 rounded-full border-none text-icon-text-light dark:text-icon-text-dark bg-icon-background-light dark:bg-icon-background-dark active:outline-2 active:outline-primary-light active:dark:outline-primary-dark ${className}`}
      onClick={onClick}
      disabled={!!disabled}
    >
      <FontAwesomeIcon icon={icon} />
    </BaseButton>
  );
}

interface ActionButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export function ActionButton(props: ActionButtonProps) {
  const { children, onClick, disabled, loading, className } = props;
  return (
    <BaseButton
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full px-4 py-3 rounded-md border border-modal-background-dark/15 dark:border-modal-background-light/15 focus:outline-primary-light focus:dark:outline-primary-dark focus:outline-[1px] focus:outline-offset-0 transition-all duration-300 ${
        disabled || loading ? "opacity-50 cursor-not-allowed" : ""
      } ${className}`}
    >
      {loading ? (
        <div className="flex justify-center items-center">
          <Spinner className="w-4 h-4" />
        </div>
      ) : (
        children
      )}
    </BaseButton>
  );
}
