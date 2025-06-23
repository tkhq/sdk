"use client";

import { Fragment, useRef, useEffect, useState } from "react";
import { Portal, Transition, TransitionChild } from "@headlessui/react";
import type { ModalPage } from "./Provider";
import { useModal } from "./Hook";
import { IconButton } from "../../components/design/Buttons";
import { faArrowLeft, faClose } from "@fortawesome/free-solid-svg-icons";
import { TurnkeyLogo } from "../../components/design/Svg";
import { ClientState, type TurnkeyProviderConfig } from "../../types/base";
import { useTurnkey } from "../client/Hook";
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

  useCssLoaded(modalStack, config); // triggers warning overlay if CSS missing

  const maxMobileScreenWidth = screenWidth * 0.9; // Only take up 90% of the screen width on mobile

  const getBorderRadius = () => {
    // Border radius can be passed in as either a number or a string, so we need to handle both cases
    const value = config?.ui?.borderRadius ?? 16;
    const stringBorderRadius = typeof value === "number" ? `${value}px` : value;

    // Remove bottom border radius on mobile to avoid rounded corners at the bottom of the screen

    return isMobile
      ? `${stringBorderRadius} ${stringBorderRadius} 0 0`
      : stringBorderRadius;
  };

  useEffect(() => {
    // This useEffect sets up a ResizeObserver to monitor changes in the size of the modal content.
    // This only needs to run when the content is changing size without the page being swapped out
    const node = containerRef.current;
    if (!node || !observeResize) return;

    let cancelled = false; // To prevent setting state on unmounted component
    const observer = new ResizeObserver(([entry]) => {
      if (!entry || cancelled) return;
      setContentBlur(10);
      const { width: newWidth, height: newHeight } = entry.contentRect;
      setHeight(newHeight);
      setWidth(newWidth);
      setTimeout(() => !cancelled && setContentBlur(0), 100);
    });

    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [containerRef.current, observeResize]);

  useEffect(() => {
    let cancelled = false; // To prevent setting state on unmounted component

    const resize = () => {
      if (cancelled || !containerRef.current) return;
      setContentBlur(10);
      const rect = containerRef.current.getBoundingClientRect();
      setHeight(rect.height);
      setWidth(rect.width);
      setTimeout(() => !cancelled && setContentBlur(0), 100);
    };

    if (current) {
      setObserveResize(true);
      requestAnimationFrame(resize);
      const originalStyle = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        cancelled = true;
        document.body.style.overflow = originalStyle;
      };
    } else {
      setObserveResize(false);
      setHeight(height / 1.3);
      setWidth(isMobile ? width : width / 1.3);
      return;
    }
  }, [current, isMobile]);

  return (
    <Transition appear show={!!current} as={Fragment}>
      {/* When open, jump into a portal – just like <Dialog> would do */}
      <Portal as={Fragment}>
        {/* relative wrapper (positioned by the portal root) */}
        <div className="relative z-40">
          {/* --- Backdrop --- */}
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

          {/* TODO (Amir): Does adding transition-colors here mess with the children? Probably. If you see some weird slow colour transitions, this is most likely the culprit! */}
          <div
            className={clsx(
              "tk-modal fixed inset-0 flex justify-center transition-colors",
              { dark: config?.ui?.darkMode },
              { "items-end": isMobile },
              { "items-center": !isMobile }
            )}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                e.stopPropagation();
                closeModal();
              }
            }}
          >
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-150"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              {/* Inner panel – we stop propagation so clicks INSIDE the modal never reach the backdrop */}
              <div
                onClick={(e) => e.stopPropagation()}
                /* White / Black background container */
                style={{
                  height,
                  width: isMobile ? maxMobileScreenWidth : width,
                  padding: innerPadding,
                  borderRadius: getBorderRadius(),
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

                  <h2 className="text-base font-medium">
                    {current?.showTitle === undefined
                      ? current?.key
                      : current.showTitle
                        ? current?.key
                        : null}
                  </h2>

                  <div className="w-6.5 h-6.5">
                    <IconButton
                      className="w-6.5 h-6.5"
                      icon={faClose}
                      onClick={closeModal}
                    />
                  </div>
                </div>

                {/* --- Sliding / fading page stack inside the modal --- */}
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
                      isMobile && "w-full items-center"
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
                      target="_blank"
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
          </div>
        </div>
      </Portal>
    </Transition>
  );
}

function useCssLoaded(modalStack: ModalPage[], config: TurnkeyProviderConfig) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return; // Only check in development mode

    const testElement = document.createElement("div");
    testElement.className = "tk-modal"; // Use a class that should definitely be styled
    testElement.style.position = "absolute";
    testElement.style.visibility = "hidden";
    document.body.appendChild(testElement);

    // Check if the styles have been applied by inspecting a computed style
    const computedStyle = window.getComputedStyle(testElement);
    const hasStyles = computedStyle.lineHeight === "normal";

    document.body.removeChild(testElement);
    if (
      !hasStyles &&
      modalStack.length === 1 &&
      !config.ui?.supressMissingStylesError
    )
      renderMissingStylesOverlay();
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
        import "@turnkey/react-wallet-kit/styles.css";
      </pre>
      <p style="margin-top: 1rem; font-size: 0.875rem; color: #6b7280;">
        This warning only shows in development mode.
      </p>
      <button id="turnkey-missing-css-close" style="margin-top: 2rem; padding: 0.5rem 1.5rem; font-size: 1rem; background: #b91c1c; color: white; border: none; border-radius: 6px; cursor: pointer;">
        Close
      </button>
    </div>
  `;

  document.body.appendChild(div);

  const closeBtn = div.querySelector("#turnkey-missing-css-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      div.remove();
    });
  }
}
