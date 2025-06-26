import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { _internal_ComponentButton } from "@headlessui/react";

interface IconButtonProps {
  icon: IconDefinition;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function BaseButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>
) {
  const { children, className, disabled, ...buttonProps } = props;

  return (
    <button
      className={`cursor-pointer border-none ${className || ""}`}
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
      className={`flex items-center justify-center p-2 rounded-full text-icon-text-light dark:text-icon-text-dark bg-icon-background-light dark:bg-icon-background-dark active:outline-2 active:outline-primary-light active:dark:outline-primary-dark ${className}`}
      onClick={onClick}
      disabled={!!disabled}
    >
      <FontAwesomeIcon icon={icon} />
    </BaseButton>
  );
}
