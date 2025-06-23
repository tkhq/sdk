import { useRef, useEffect, useState } from "react";
import { useModal } from "./Provider";

export function ModalRoot() {
  const { modalStack, popPage, closeModal } = useModal();
  const current = modalStack[modalStack.length - 1];
  const hasBack = modalStack.length > 1;

  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  const [width, setWidth] = useState<number>();

  useEffect(() => {
    const resize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setHeight(rect.height);
        setWidth(rect.width);
      }
    };
    requestAnimationFrame(resize);
  }, [current]);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        style={{ height, width }}
        className="transition-all duration-300 ease-in-out bg-white rounded-2xl p-6 shadow-xl"
      >
        <div className="flex justify-between mb-4">
          {hasBack ? (
            <button onClick={popPage} className="text-sm text-gray-600">
              ← Back
            </button>
          ) : (
            <div />
          )}
          <button onClick={closeModal} className="text-sm text-gray-600">
            ✕
          </button>
        </div>
        <div ref={containerRef}>{current.content}</div>
      </div>
    </div>
  );
}
