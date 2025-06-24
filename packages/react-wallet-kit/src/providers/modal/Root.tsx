import { Fragment, useRef, useEffect, useState } from "react";
import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { useModal } from "./Provider";

export function ModalRoot() {
  const { modalStack, popPage, closeModal } = useModal();
  const current = modalStack[modalStack.length - 1];
  const hasBack = modalStack.length > 1;

  const [contentBlur, setContentBlur] = useState(0);
  const innerPadding = 16;

  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  const [width, setWidth] = useState<number>();

  useEffect(() => {
    const resize = () => {
      if (containerRef.current) {
        setContentBlur(10);
        const rect = containerRef.current.getBoundingClientRect();
        setHeight(rect.height);
        setWidth(rect.width);
        setTimeout(() => setContentBlur(0), 100);
      }
    };

    if (current) {
      requestAnimationFrame(resize);
    }
  }, [current]);

  return (
    <Transition appear show={!!current} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeModal}>
        {/* Backdrop */}
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </TransitionChild>

        {/* Modal Panel */}
        <div className="fixed inset-0 flex items-center justify-center">
          <DialogPanel>
            {/* Modal content (absolute layer) */}
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div
                className="absolute z-10 transition-all duration-50"
                style={{
                  transform: `translate(${innerPadding}px, ${innerPadding}px)`,
                  filter: `blur(${contentBlur}px)`,
                }}
                ref={containerRef}
              >
                {current?.content}
              </div>
            </TransitionChild>

            {/* White background container */}
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <div
                style={{
                  height,
                  width,
                  padding: innerPadding,
                }}
                className="bg-white rounded-2xl shadow-xl transition-all duration-200 ease-in-out"
              >
                <div
                  className="absolute z-30 flex items-center justify-between transition-all duration-200 py-3"
                  style={{ width }}
                >
                  {hasBack ? (
                    <button
                      onClick={popPage}
                      className="text-sm text-gray-600 h-7 w-7"
                    >
                      ←
                    </button>
                  ) : (
                    <div />
                  )}
                  <button
                    onClick={closeModal}
                    className="text-sm text-gray-600 h-7 w-7"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </TransitionChild>
          </DialogPanel>
        </div>
      </Dialog>
    </Transition>
  );
}
