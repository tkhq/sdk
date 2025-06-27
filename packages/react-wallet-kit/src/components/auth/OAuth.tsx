import { useEffect, useRef, useState } from "react";
import { BaseButton } from "../design/Buttons";
import { useModal } from "../../providers";
import { Spinner } from "../design/Spinners";

interface OAuthButtonProps {
  name: string;
  icon: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function OAuthButton(props: OAuthButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showText, setShowText] = useState(true);
  const { name, icon, onClick, className } = props;

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = entry.contentRect.width;
      setShowText(width > 200);
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-md border border-modal-background-dark/10 dark:border-modal-background-light/10"
    >
      <BaseButton
        onClick={onClick}
        className={`flex items-center justify-center gap-2 w-full h-full rounded-md bg-button-light dark:bg-button-dark text-inherit ${className || ""}`}
      >
        {icon}
        {showText && (
          <span className="truncate">{`Continue with ${name}`}</span>
        )}
      </BaseButton>
    </div>
  );
}

interface OAuthLoadingProps {
  name: string;
  icon: React.ReactNode;
  action?: () => Promise<void>;
}

export function OAuthLoading(props: OAuthLoadingProps) {
  const { name, icon, action } = props;
  const { popPage, closeModal } = useModal();
  const hasRun = useRef(false);
  const iconRef = useRef<HTMLDivElement>(null);
  const [spinnerSize, setSpinnerSize] = useState<number>(40);

  const displayName = name.charAt(0).toUpperCase() + name.slice(1);

  useEffect(() => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      setSpinnerSize(size + 50);
    }
  }, []);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    const runAction = async () => {
      if (action) {
        try {
          await action();
        } catch (error) {
          popPage();
          throw new Error(`Error during OAuth action: ${error}`);
        }
        closeModal();
      }
    };
    runAction();
  }, []);

  return (
    <div className="flex items-center justify-center w-96 h-64">
      <div className="flex flex-col items-center justify-center gap-7">
        <div className="relative flex items-center justify-center">
          <div ref={iconRef} className="flex items-center justify-center">
            {icon}
          </div>
          <Spinner
            className="absolute"
            style={{
              width: spinnerSize,
              height: spinnerSize,
            }}
            strokeWidth={1}
          />
        </div>
        <span className="text-lg font-semibold">{`Authenticating with ${displayName}...`}</span>
      </div>
    </div>
  );
}
