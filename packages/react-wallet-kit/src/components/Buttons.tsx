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
  props: React.ButtonHTMLAttributes<HTMLButtonElement>,
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
  // TODO (Amir): Use standardized colors. Define these and make one for light and dark mode
  return (
    <BaseButton
      className={`flex items-center justify-center p-2 rounded-full bg-gray-200 dark:bg-[#333336] ${className}`}
      onClick={onClick}
      disabled={!!disabled}
    >
      <FontAwesomeIcon icon={icon} />
    </BaseButton>
  );
}
