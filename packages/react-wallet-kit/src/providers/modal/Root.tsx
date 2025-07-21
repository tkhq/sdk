import { Fragment, useRef, useEffect, useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { ModalPage, useModal } from "./Provider";
import { IconButton } from "../../components/design/Buttons";
import { faArrowLeft, faClose } from "@fortawesome/free-solid-svg-icons";
import { TurnkeyLogo } from "../../components/design/Svg";
import { TurnkeyProviderConfig } from "../TurnkeyProvider";
import { useTurnkey } from "../client/Provider";
import { ClientState } from "@utils";

interface ModalRootProps {
  config: TurnkeyProviderConfig;
}

export function ModalRoot(props: ModalRootProps) {
  const { config } = props;
  const { modalStack, popPage, closeModal } = useModal();
  const { clientState } = useTurnkey();

  const current = modalStack[modalStack.length - 1];
  const hasBack = modalStack.length > 1 && !current?.preventBack;

  const [contentBlur, setContentBlur] = useState(0);
  const innerPadding = 16;

  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(300);
  const [width, setWidth] = useState<number>(300);
  const [observeResize, setObserveResize] = useState(true);

  useCssLoaded(modalStack); // triggers warning overlay if CSS missing

  useEffect(() => {
    const node = containerRef.current;
    if (!node || !observeResize) return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setContentBlur(10);
      const { width: newWidth, height: newHeight } = entry.contentRect;
      setHeight(newHeight);
      setWidth(newWidth);
      setTimeout(() => setContentBlur(0), 100);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [containerRef.current, observeResize]);

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
      setObserveResize(true);
      requestAnimationFrame(resize);

      if (config?.ui?.renderModalInProvider) {
        const originalStyle = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = "hidden";
        return () => {
          document.body.style.overflow = originalStyle;
        };
      }

      return;
    } else {
      setObserveResize(false);
      setHeight(height / 1.3);
      setWidth(width / 1.3);
      return;
    }
  }, [current]);

  return (
    <Transition appear show={!!current} as={Fragment}>
      <Dialog
        __demoMode={config?.ui?.renderModalInProvider ? true : false}
        as="div"
        className="relative z-50"
        onClose={() => {}}
      >
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
            className="fixed inset-0 bg-black/40"
            style={{
              backdropFilter: `blur(${
                typeof config?.ui?.backgroundBlur === "number"
                  ? `${config.ui.backgroundBlur}px`
                  : (config?.ui?.backgroundBlur ?? "8px")
              })`,
            }}
          />
        </TransitionChild>

        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              e.stopPropagation();
              closeModal();
            }
          }}
          className={`tk-modal fixed inset-0 flex items-center justify-center transition-colors duration-300 ${
            config?.ui?.darkMode ? "dark" : ""
          }`}
        >
          <DialogPanel>
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
                  borderRadius: config?.ui?.borderRadius ?? "16px",
                }}
                className="bg-modal-background-light dark:bg-modal-background-dark text-modal-text-light dark:text-modal-text-dark flex shadow-xl transition-all overflow-x-clip"
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
                    style={{ filter: `blur(${contentBlur}px)` }}
                    ref={containerRef}
                  >
                    {clientState === ClientState.Error ? (
                      <InitFailed />
                    ) : (
                      current?.content
                    )}

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

function useCssLoaded(modalStack: ModalPage[]) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const el = document.createElement("div");
    el.className = "tk-style-sentinel";
    document.body.appendChild(el);

    const width = window.getComputedStyle(el).width;
    const cssLoaded = width === "1234px";
    document.body.removeChild(el);

    if (!cssLoaded && modalStack.length > 0) renderMissingStylesOverlay();
  }, [modalStack]);
}

function renderMissingStylesOverlay() {
  if (typeof document === "undefined") return;
  if (document.getElementById("turnkey-missing-css")) return;

  const div = document.createElement("div");
  div.id = "turnkey-missing-css";

  Object.assign(div.style, {
    position: "fixed",
    inset: "0",
    backgroundColor: "rgba(255,255,255,0.96)",
    color: "#b91c1c",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "monospace",
    zIndex: "999999",
    padding: "2rem",
    textAlign: "center",
  });

  div.innerHTML = `
    <div style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem;">
      ⚠️ Turnkey styles are missing
    </div>
    <div style="font-size: 1rem; max-width: 600px;">
      You must import the Turnkey React Wallet Kit styles in your app:
      <pre style="background-color: #f3f4f6; color: #111827; padding: 0.5rem 1rem; margin-top: 1rem; border-radius: 6px; font-size: 0.875rem;">
        import "@turnkey/react-wallet-kit/dist/styles.css";
      </pre>
      <p style="margin-top: 1rem; font-size: 0.875rem; color: #6b7280;">
        This warning only shows in development mode.
      </p>
    </div>
  `;

  document.body.appendChild(div);
}

function InitFailed() {
  return (
    <div className="flex items-center justify-center w-64 min-48 text-sm text-center">
      {process.env.NODE_ENV === "development" ? (
        <div className="flex flex-col items-center gap-2 mt-10 text-sm font-normal">
          <strong className="text-danger-light dark:text-danger-dark">
            Turnkey SDK failed to initialize.
          </strong>
          <div>
            Check your config and ensure you're connected to the internet.
          </div>
          <div>
            Try attaching an onError callback to the TurnkeyProvider's callbacks
            to see more details. You can also inspect the network tab to see any
            failed network requests.
          </div>
          <div className="text-xs mt-3 font-extralight italic">
            You will only see this error if you are a developer!
          </div>
        </div>
      ) : (
        <p>An underlying error occurred. Try refreshing the page</p>
      )}
    </div>
  );
}
