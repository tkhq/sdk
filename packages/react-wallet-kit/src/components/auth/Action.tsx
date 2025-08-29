import { useRef, useState, useEffect } from "react";
import { useModal } from "../../providers/modal/Hook";
import { Spinner } from "../design/Spinners";
import clsx from "clsx";

interface ActionPageProps {
  title: string;
  icon: React.ReactNode;
  closeOnComplete?: boolean;
  action?: () => Promise<void>;
}

export function ActionPage(props: ActionPageProps) {
  const { title, icon, closeOnComplete = true, action } = props;
  const { popPage, closeModal, isMobile } = useModal();
  const hasRun = useRef(false);
  const iconRef = useRef<HTMLDivElement>(null);
  const [spinnerSize, setSpinnerSize] = useState<number>(40);

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
          throw new Error(`${error}`);
        }
        if (closeOnComplete) {
          closeModal();
        }
      }
    };
    runAction();
  }, []);

  return (
    <div
      className={clsx(
        "flex items-center justify-center py-10",
        isMobile ? "w-full" : "w-96",
      )}
    >
      <div className="flex flex-col items-center justify-center gap-8">
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
        <span className="text-lg font-semibold">{title}</span>
      </div>
    </div>
  );
}
