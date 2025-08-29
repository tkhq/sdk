"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { Button, Transition } from "@headlessui/react";
import { TurnkeyConfigPanel } from "./Panel";
import clsx from "clsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faCaretDown,
  faClose,
} from "@fortawesome/free-solid-svg-icons";
import { ThreeDimensionalBackground } from "@/components/3D/Background";
import { TurnkeySVG } from "@/components/Svg";
import { isHardwareAccelerationEnabled, kebab, useScreenSize } from "@/utils";
import { Slide, ToastContainer } from "react-toastify";
import { DemoConfig } from "@/types";
import {
  TurnkeyProviderConfig,
  TurnkeyCallbacks,
  TurnkeyProvider,
} from "@turnkey/react-wallet-kit";

type ConfigContextValue = {
  config: TurnkeyProviderConfig;
  initialConfig: TurnkeyProviderConfig;
  demoConfig: DemoConfig;
  hardwareAccelerationEnabled: boolean;
  setConfig: (
    newConfig: Partial<TurnkeyProviderConfig>,
    demoConfig?: Partial<DemoConfig>,
  ) => void;
};

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined);

export function useTurnkeyConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("Must be used inside TurnkeyConfigProvider");
  return ctx;
}

interface TurnkeyConfigProviderProps {
  initialConfig: TurnkeyProviderConfig;
  callbacks?: TurnkeyCallbacks;
  children: ReactNode;
}

export function TurnkeyConfigProvider({
  initialConfig,
  callbacks,
  children,
}: TurnkeyConfigProviderProps) {
  const [config, setConfigState] = useState(initialConfig);
  const [demoConfig, setDemoConfig] = useState<DemoConfig>({
    backgroundEnabled: true,
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const { isMobile } = useScreenSize();

  const [hardwareAccelerationEnabled, setHardwareAccelerationEnabled] =
    useState(false);

  const panelWidth = 384;
  const setConfig = (
    newConfig: Partial<TurnkeyProviderConfig>,
    demoConfig?: Partial<DemoConfig>,
  ) => {
    setConfigState((prev) => ({ ...prev, ...newConfig }));
    setDemoConfig((prev) => ({ ...prev, ...demoConfig }));
  };

  useEffect(() => {
    setHardwareAccelerationEnabled(isHardwareAccelerationEnabled());
  }, []);

  const generateCSSVars = (theme?: Partial<DemoConfig>) => {
    if (!theme?.ui?.light) return "";
    return Object.entries(theme.ui.light)
      .map(([key, value]) => `--color-${kebab(key)}-light: ${value};`)
      .join("\n");
  };

  const generateDarkCSSVars = (theme?: Partial<DemoConfig>) => {
    if (!theme?.ui?.dark) return "";
    return Object.entries(theme.ui.dark)
      .map(([key, value]) => `--color-${kebab(key)}-dark: ${value};`)
      .join("\n");
  };

  useEffect(() => {
    if (isMobile) {
      setPanelOpen(false);
    } else {
      setPanelOpen(true);
    }
  }, [isMobile]);

  return (
    <ConfigContext.Provider
      value={{
        config,
        initialConfig,
        demoConfig,
        hardwareAccelerationEnabled,
        setConfig,
      }}
    >
      <style>
        {`
          :root {
            ${generateCSSVars(demoConfig)}
          }
          .dark {
            ${generateDarkCSSVars(demoConfig)}
          }
        `}
      </style>
      <div
        className={clsx(
          "transition-colors overflow-hidden h-full absolute inset-0 flex dark:bg-panel-background-dark bg-panel-background-light text-text-light dark:text-text-dark",
          config.ui?.darkMode && "dark",
        )}
      >
        {/* Sliding Config Panel */}
        <Transition
          appear
          unmount={false}
          show={panelOpen}
          enter="transition-transform duration-250 ease-out"
          enterFrom="-translate-x-full"
          enterTo="translate-x-0"
          leave="transition-transform duration-150"
          leaveFrom="translate-x-0"
          leaveTo="-translate-x-full"
        >
          <div className="z-20 fixed top-0 left-0 h-full w-full sm:w-96 bg-panel-background-light dark:bg-panel-background-dark flex flex-col px-4 py-6 space-y-4 transition-all">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Wallet Kit Config</h2>
              <Button
                className="cursor-pointer"
                onClick={() => setPanelOpen(false)}
              >
                <FontAwesomeIcon size="lg" icon={faClose} />
              </Button>
            </div>

            <TurnkeyConfigPanel />
          </div>
        </Transition>

        <ToastContainer
          className={"fixed z-10"}
          position="bottom-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick={false}
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme={config.ui?.darkMode ? "dark" : "light"}
          transition={Slide}
        />

        <Button
          onClick={() => setPanelOpen(!panelOpen)}
          className={clsx(
            "fixed z-10 cursor-pointer top-1/2 -translate-y-1/2 w-[80px] h-[250px] rounded-r-xl bg-panel-background-light dark:bg-panel-background-dark hidden sm:flex flex-col items-center justify-center transition-all ease-out",
            panelOpen ? " -translate-x-full" : "",
          )}
        >
          <div className="flex flex-row items-center justify-center gap-3 transform -rotate-90 text-xl font-medium text-center w-[250px] whitespace-pre">
            <div className="size-4" />
            <span>Config</span>
            <FontAwesomeIcon className="size-4" icon={faCaretDown} />
          </div>
        </Button>

        {/* Content (shifted when panel is open) */}
        <div
          style={{
            transform: `translateX(${panelOpen ? `${panelWidth / 2}px` : "0px"})`,
          }}
          className="flex-1 transition-all duration-150"
        >
          <TurnkeyProvider config={config} callbacks={callbacks}>
            <ThreeDimensionalBackground />
            <div className="relative z-10">{children}</div>
          </TurnkeyProvider>
        </div>
        <div className="w-full z-10 h-14 sm:h-16 bg-panel-background-light backdrop-blur dark:bg-panel-background-dark absolute flex items-center justify-between px-2 sm:px-6.5">
          <Button
            onClick={() => setPanelOpen(!panelOpen)}
            className="flex sm:hidden items-center justify-center p-2 gap-2 cursor-pointer text-xl"
          >
            <FontAwesomeIcon icon={faBars} />
            Config
          </Button>

          <a href="https://turnkey.com" target="_blank">
            <TurnkeySVG
              className="transition-all duration-250 h-full w-32"
              style={{
                transform: `translateX(${panelOpen ? `${panelWidth}px` : "0px"})`,
              }}
            />
          </a>

          <div className="sm:flex hidden font-bold text-sm w-52 justify-end">
            <span>@turnkey/react-wallet-kit</span>
          </div>
        </div>

        <div className="hidden sm:block">
          <div className="absolute bottom-0 left-0 w-7 h-full bg-panel-background-light dark:bg-panel-background-dark flex items-center justify-center" />
          <div className="absolute bottom-0 right-0 w-7 h-full bg-panel-background-light dark:bg-panel-background-dark flex items-center justify-center" />
          <div className="absolute bottom-0 right-0 w-full h-7 bg-panel-background-light dark:bg-panel-background-dark flex items-center justify-center text-[8px] sm:text-xs text-icon-text-light/30 dark:text-icon-text-dark/30 font-extralight text-center">
            This is purely a demo app for the Turnkey React Wallet Kit. You will
            not receive any real tokens or rewards.
          </div>
        </div>
      </div>
    </ConfigContext.Provider>
  );
}
