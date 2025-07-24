import { Fragment, useRef, useEffect, useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import type { ModalPage } from "./Provider";
import { useModal } from "./Hook";
import { IconButton } from "../../components/design/Buttons";
import { faArrowLeft, faClose } from "@fortawesome/free-solid-svg-icons";
import { TurnkeyLogo } from "../../components/design/Svg";
import type { TurnkeyProviderConfig } from "../../types/base";
import { useTurnkey } from "../client/Hook";
import { ClientState } from "@utils";
import clsx from "clsx";
import { DeveloperError } from "../../components/design/Failure";

interface ModalRootProps {
  config: TurnkeyProviderConfig;
}

export function ModalRoot(props: ModalRootProps) {
  const { config } = props; // Note: This is the config passed into the TurnkeyProvider. If we ever need to get config from the dashboard as well, grab `config` from the useTurnkey hook instead.
  const { modalStack, popPage, closeModal, screenWidth, isMobile } = useModal();
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

  const maxMobileScreenWidth = screenWidth * 0.9; // Only take up 90% of the screen width on mobile

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
    return () => observer.disconnect();
  }, [containerRef.current, observeResize]);

  useEffect(() => {
    const resize = () => {
      if (containerRef.current) {
        setContentBlur(10);
        const rect = containerRef.current.getBoundingClientRect();
        setHeight(rect.height);
        setWidth(rect.width);
        setTimeout(() => setContentBlur(0), 100); // Remove blur after short delay
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
      setWidth(isMobile ? width : width / 1.3);
      return;
    }
  }, [current]);

  return (
    <Transition appear show={!!current} as={Fragment}>
      <Dialog
        // https://github.com/tailwindlabs/headlessui/blob/38986df81ecc7b7c86abab33d61ce18ffd55fac6/packages/%40headlessui-react/src/components/dialog/dialog.tsx#L205-L206
        // If we are rendering the modal in the provider, set __demoMode to true to avoid "inert" being applied to all ansestors of the modal.
        __demoMode={config?.ui?.renderModalInProvider ? true : false}
        as="div"
        className="relative z-50"
        onClose={() => {
          // prevent default outside-click close behavior
          // we'll manually handle backdrop clicks below
        }}
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

        {/* Modal Panel */
        /* TODO (Amir): Does adding transition-colors here mess with the children? Probably. If you see some weird slow colour transitions, this is most likely the culprit! */}
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              e.stopPropagation();
              closeModal();
            }
          }}
          onTouchStart={(e) => {
            if (e.target === e.currentTarget) {
              e.stopPropagation();
              closeModal();
            }
          }}
          className={clsx(
            "tk-modal fixed inset-0 flex justify-center transition-colors duration-300",
            { dark: config?.ui?.darkMode },
            { "items-end": isMobile },
            { "items-center": !isMobile },
          )}
        >
          <DialogPanel>
            {/* White / Black background container */}
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
                  width: isMobile ? maxMobileScreenWidth : width,
                  padding: innerPadding,
                  borderRadius: isMobile
                    ? // Remove bottom border radius on mobile to avoid rounded corners at the bottom of the screen
                      `${config?.ui?.borderRadius ?? "16px"} ${config?.ui?.borderRadius ?? "16px"} 0 0`
                    : (config?.ui?.borderRadius ?? "16px"),
                }}
                className="bg-modal-background-light dark:bg-modal-background-dark text-modal-text-light dark:text-modal-text-dark flex justify-center shadow-xl transition-all overflow-x-clip"
              >
                <div
                  className="h-6.5 absolute z-30 flex items-center justify-between transition-all"
                  style={{
                    width: isMobile ? maxMobileScreenWidth : width,
                  }}
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
                    className={clsx(
                      "flex flex-col z-10 transition-all duration-50 self-start",
                      // This allows the content to take the static `maxMobileScreenWidth` width on mobile
                      isMobile && "w-full items-center",
                    )}
                    style={{ filter: `blur(${contentBlur}px)` }}
                    ref={containerRef}
                  >
                    {clientState === ClientState.Error ? (
                      <DeveloperError
                        developerTitle="Turnkey SDK failed to initialize."
                        developerMessages={[
                          "Check your config and ensure you're connected to the internet.",
                          "Try attaching an onError callback to the TurnkeyProvider's callbacks to see more details.",
                          "You can also inspect the network tab to see any failed network requests.",
                        ]}
                        userMessages={[
                          "An underlying error occurred. Try refreshing the page",
                        ]}
                      />
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
    if (process.env.NODE_ENV !== "development") return; // Only check in development mode

    const el = document.createElement("div");
    el.className = "tk-style-sentinel"; // See index.css for this class
    document.body.appendChild(el);

    const width = window.getComputedStyle(el).width;
    const cssLoaded = width === "1234px"; // We check for a specific width to ensure the styles are loaded. If this width is not set, it means the styles are not loaded!
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
