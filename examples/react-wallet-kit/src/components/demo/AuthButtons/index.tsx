import { AddSVG, UnlinkSVG } from "@/components/Svg";
import clsx from "clsx";

interface AuthToggleButtonProps {
  label: string;
  icon: React.ReactNode;
  isLinked: boolean;
  onAdd: () => void;
  onRemove: () => void;
}

export function AuthToggleButton(props: AuthToggleButtonProps) {
  const { label, icon, isLinked, onAdd, onRemove } = props;
  const handleClick = () => {
    if (isLinked) {
      onRemove();
    } else {
      onAdd();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={clsx(
        "flex items-center justify-between gap-2 p-3 shadow rounded-lg bg-background-light dark:bg-background-dark hover:cursor-pointer",
      )}
    >
      <p className="flex items-center gap-2 text-text-light dark:text-text-dark">
        {icon}
        <span>{label}</span>
      </p>
      {isLinked ? (
        <p className="flex items-center text-sm gap-2 text-text-light/40 dark:text-text-dark/40">
          <UnlinkSVG className="w-4 h-4" />
        </p>
      ) : (
        <p className="flex items-center text-sm gap-2 text-text-light/40 dark:text-text-dark/40">
          <AddSVG className="w-4 h-4" />
          <span>Connect</span>
        </p>
      )}
    </button>
  );
}
