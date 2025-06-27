import { useEffect, useRef, useState } from "react";
import { BaseButton } from "../Buttons";

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

  useEffect(() => {
    const runAction = async () => {
      if (action) {
        console.log(`Starting OAuth action for ${name}`);
        await action();
      }
    };
    runAction();
  }, []);

  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-lg font-semibold">{`Authenticating with ${name}...`}</span>
      </div>
    </div>
  );
}
