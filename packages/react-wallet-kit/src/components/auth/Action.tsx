import { useRef, useState, useEffect } from "react";
import { useModal } from "../../providers";
import { Spinner } from "../design/Spinners";

interface ActionPageProps {
  title: string;
  icon: React.ReactNode;
  action?: () => Promise<void>;
}

export function ActionPage(props: ActionPageProps) {
  const { title, icon, action } = props;
  const { popPage, closeModal } = useModal();
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
        closeModal();
      }
    };
    runAction();
  }, []);

  return (
    <div className="flex items-center justify-center w-96 py-10">
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
