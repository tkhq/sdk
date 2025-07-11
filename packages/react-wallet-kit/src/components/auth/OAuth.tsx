import { useEffect, useRef, useState } from "react";
import { ActionButton } from "../design/Buttons";

interface OAuthButtonProps {
  name: string;
  icon: React.ReactNode;
  onClick: () => void;
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
      setShowText(width > 300);
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full ">
      <ActionButton
        onClick={onClick}
        className={`flex items-center justify-center gap-2 w-full h-full rounded-md bg-button-light dark:bg-button-dark text-inherit ${className || ""}`}
      >
        {icon}
        {showText && (
          <span className="truncate">{`Continue with ${name}`}</span>
        )}
      </ActionButton>
    </div>
  );
}
