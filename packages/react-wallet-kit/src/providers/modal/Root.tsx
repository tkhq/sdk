import { Fragment, useRef, useEffect, useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { useModal } from "./Provider";
import { IconButton } from "../../components/design/Buttons";
import { faArrowLeft, faClose } from "@fortawesome/free-solid-svg-icons";
import { useTurnkey } from "../client/Provider";
import { TurnkeyLogo } from "../../components/design/Svg";

export function ModalRoot() {
  const { modalStack, popPage, closeModal } = useModal();
  const { config } = useTurnkey();
  const current = modalStack[modalStack.length - 1];
  const hasBack = modalStack.length > 1 && !current?.preventBack;

  const [contentBlur, setContentBlur] = useState(0);
  const innerPadding = 16;

  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(300);
  const [width, setWidth] = useState<number>(300);
  const [observeResize, setObserveResize] = useState(true);

  useEffect(() => {
    // This useEffect sets up a ResizeObserver to monitor changes in the size of the modal content.
    // This only needs to run when the content is changing size without the page being swapped out
    const node = containerRef.current;
    if (!node || !observeResize) return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setContentBlur(10);

      const { width: newWidth, height: newHeight } = entry.contentRect;
      setHeight(newHeight);
      setWidth(newWidth);

      setTimeout(() => setContentBlur(0), 100); // Remove blur after short delay
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [containerRef.current, observeResize]);

  useEffect(() => {
    // This useEffect handles the resizing of the modal when the current page changes.
    // This only needs to run when the current page is changing. I.e, when the modal is pushed or popped.
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
      setObserveResize(true);
      requestAnimationFrame(resize);
    } else {
      setObserveResize(false);
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
        /* TODO (Amir): Does adding transition-colors here mess with the children? Probably. If you see some weird slow colour transitions, this is most likely the culprit! */}
        <div
          className={`fixed inset-0 flex items-center justify-center transition-colors duration-300 ${config?.ui?.darkMode ? "dark" : ""}`}
        >
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
                  <div className="w-6.5 h-6.5">
                    {hasBack && (
                      <IconButton
                        className="w-6.5 h-6.5"
                        icon={faArrowLeft}
                        onClick={popPage}
                      />
                    )}
                  </div>

                  <DialogTitle className="text-base font-medium">
                    {current?.showTitle === undefined
                      ? current?.key
                      : current.showTitle
                        ? current?.key
                        : null}
                  </DialogTitle>
                  <div className="w-6.5 h-6.5">
                    <IconButton
                      className="w-6.5 h-6.5"
                      icon={faClose}
                      onClick={closeModal}
                    />
                  </div>
                </div>

                <TransitionChild
                  as={Fragment}
                  enter="ease-in duration-200"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div
                    className="z-10 transition-all duration-50 self-start"
                    style={{
                      filter: `blur(${contentBlur}px)`,
                    }}
                    ref={containerRef}
                  >
                    {current?.content}

                    <a
                      href="https://www.turnkey.com/"
                      className="flex flex-row items-center justify-center gap-0.5 mt-2 mb-1 text-icon-text-light/50 dark:text-icon-text-dark/50 text-xs no-underline"
                      style={{
                        opacity: current?.content ? 1 : 0,
                      }}
                    >
                      <span>Secured by</span>
                      <TurnkeyLogo />
                    </a>
                  </div>
                </TransitionChild>
              </div>
            </TransitionChild>
          </DialogPanel>
        </div>
      </Dialog>
    </Transition>
  );
}
