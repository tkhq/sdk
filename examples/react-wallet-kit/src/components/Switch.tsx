import { Switch } from "@headlessui/react";
import clsx from "clsx";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  label?: string;
  tooltip?: string;
}

export function ToggleSwitch(props: ToggleSwitchProps) {
  const { checked, onChange, size = "md", disabled, label, tooltip } = props;
  const height = size === "sm" ? "h-4" : "h-5";
  const width = size === "sm" ? "w-8" : "w-10";
  const knobSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const translate = checked
    ? size === "sm"
      ? "translate-x-4"
      : "translate-x-5"
    : "translate-x-1";

  return (
    <div
      title={tooltip}
      className={clsx(
        "flex items-center justify-between",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {label && <span className="text-sm">{label}</span>}
      <Switch
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className={clsx(
          "relative inline-flex items-center rounded-full transition",
          height,
          width,
          checked
            ? "bg-primary-light dark:bg-primary-dark"
            : "bg-icon-text-light dark:bg-icon-text-dark",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        )}
      >
        <span
          className={clsx(
            "inline-block transform rounded-full bg-primary-text-light dark:bg-primary-text-dark transition",
            knobSize,
            translate,
          )}
        />
      </Switch>
    </div>
  );
}
