import { Fragment, useRef, useEffect, useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { useModal } from "./Provider";
import { IconButton } from "../../components/Buttons";
import { faArrowLeft, faClose } from "@fortawesome/free-solid-svg-icons";

export function ModalRoot() {
  const { modalStack, popPage, closeModal } = useModal();
  const current = modalStack[modalStack.length - 1];
  const hasBack = modalStack.length > 1;

  const [contentBlur, setContentBlur] = useState(0);
  const innerPadding = 16;

  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(300);
  const [width, setWidth] = useState<number>(300);

  useEffect(() => {
    const resize = () => {
      if (containerRef.current) {
        setContentBlur(10); // Blur the content during resize.
        const rect = containerRef.current.getBoundingClientRect();

        setHeight(rect.height);
        setWidth(rect.width);
        setTimeout(() => setContentBlur(0), 100); // Remove blur after resize
      }
    };

    if (current) {
      requestAnimationFrame(resize);
    } else {
      setHeight(height / 1.3);
      setWidth(width / 1.3);
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

        {/* Modal Panel */
        /* NOTE (Amir): dark is applied manually here. This should be controlled in a variable. Idk why but, tailwind's default dark mode auto selecting causes so many bugs. If we have UI anywhere else, we need to add this modifer also! */}
        <div className="fixed inset-0 flex items-center justify-center dark">
          <DialogPanel>
            {/* White background container */}
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-150"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div
                style={{
                  height,
                  width,
                  padding: innerPadding,
                }}
                className="bg-modal-background-light dark:bg-modal-background-dark text-modal-text-light dark:text-modal-text-dark flex rounded-2xl shadow-xl transition-all"
              >
                <div
                  className="h-6.5 absolute z-30 flex items-center justify-between transition-all"
                  style={{ width }}
                >
                  {hasBack ? (
                    <IconButton
                      className="w-6.5 h-6.5"
                      icon={faArrowLeft}
                      onClick={popPage}
                    />
                  ) : (
                    <div className="w-6.5 h-6.5" />
                  )}
                  <DialogTitle className="text-base font-medium">
                    {current?.showTitle === undefined
                      ? current?.key
                      : current.showTitle
                        ? current?.key
                        : null}
                  </DialogTitle>
                  <IconButton
                    className="w-6.5 h-6.5"
                    icon={faClose}
                    onClick={closeModal}
                  />
                </div>

                <div
                  className="z-10 transition-all duration-50 self-start"
                  style={{
                    filter: `blur(${contentBlur}px)`,
                  }}
                  ref={containerRef}
                >
                  {current?.content}
                </div>
              </div>
            </TransitionChild>
          </DialogPanel>
        </div>
      </Dialog>
    </Transition>
  );
}
