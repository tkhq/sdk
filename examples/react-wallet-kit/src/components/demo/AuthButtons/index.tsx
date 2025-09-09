import { AddSVG, UnlinkSVG } from "@/components/Svg";
import clsx from "clsx";
import { useState } from "react";
import { toast } from "react-toastify";

interface AuthToggleButtonProps {
  label: string;
  icon: React.ReactNode;
  isLinked: boolean;
  canRemoveAuthMethod: boolean;
  onAdd: () => void;
  onRemove: () => void;
}

export function AuthToggleButton(props: AuthToggleButtonProps) {
  const { label, icon, isLinked, onAdd, onRemove, canRemoveAuthMethod } = props;
  const handleClick = () => {
    if (isLinked) {
      if (!canRemoveAuthMethod) {
        setShaking(true);
        setTimeout(() => setShaking(false), 500);
        toast.error("Error: Cannot remove your last authenticator.");
        return;
      }
      onRemove();
    } else {
      onAdd();
    }
  };

  const [shaking, setShaking] = useState(false);

  return (
    <button
      onClick={handleClick}
      className={clsx(
        "flex items-center justify-between gap-2 p-3 shadow rounded-lg bg-background-light dark:bg-background-dark hover:cursor-pointer group",
      )}
    >
      <p className="flex items-center gap-2 text-text-light dark:text-text-dark">
        {icon}
        <span>{label}</span>
      </p>
      {isLinked ? (
        <p
          className={`flex items-center text-sm gap-2 text-text-light/40 dark:text-text-dark/40 group-hover:text-danger-light dark:group-hover:text-danger-dark transition-all ${shaking ? "animate-shake duration-100" : ""}`}
        >
          <UnlinkSVG className="w-4 h-4" />
        </p>
      ) : (
        <p className="transition-colors flex items-center text-sm gap-2 text-text-light/40 dark:text-text-dark/40 group-hover:text-success-light dark:group-hover:text-success-dark">
          <AddSVG className="w-4 h-4" />
          <span>Connect</span>
        </p>
      )}
    </button>
  );
}
