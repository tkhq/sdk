import { createContext, useContext, useState, ReactNode } from "react";
import { Button, Transition } from "@headlessui/react";
import {
  TurnkeyProviderConfig,
  TurnkeyProvider,
  TurnkeyCallbacks,
} from "@turnkey/react-wallet-kit";
import { TurnkeyConfigPanel } from "./Panel";
import clsx from "clsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClose } from "@fortawesome/free-solid-svg-icons";
import { ThreeDimensionalBackground } from "@/components/3D/Background";

type ConfigContextValue = {
  config: TurnkeyProviderConfig;
  setConfig: (newConfig: Partial<TurnkeyProviderConfig>) => void;
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
  const [panelOpen, setPanelOpen] = useState(false);

  const setConfig = (newConfig: Partial<TurnkeyProviderConfig>) => {
    setConfigState((prev) => ({ ...prev, ...newConfig }));
  };

  return (
    <ConfigContext.Provider value={{ config, setConfig }}>
      <div
        className={clsx(
          "overflow-hidden h-full absolute inset-0 flex",
          config.ui?.darkMode && "dark",
        )}
      >
        {/* Sliding Config Panel */}
        <Transition
          show={panelOpen}
          enter="transition-transform duration-300"
          enterFrom="-translate-x-full"
          enterTo="translate-x-0"
          leave="transition-transform duration-300"
          leaveFrom="translate-x-0"
          leaveTo="-translate-x-full"
        >
          <div className="z-20 fixed top-0 left-0 h-full w-96 bg-panel-background-light dark:bg-panel-background-dark border-r border-gray-300 dark:border-gray-700 text-text-light dark:text-text-dark shadow-lg flex flex-col px-4 py-6 space-y-4 transition-all">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Config Panel</h2>
              <Button
                className="cursor-pointer"
                onClick={() => setPanelOpen(false)}
              >
                <FontAwesomeIcon icon={faClose} />
              </Button>
            </div>

            {/* Place for future toggles */}
            <div className="flex flex-col space-y-3">
              <TurnkeyConfigPanel />
            </div>
          </div>
        </Transition>

        {/* Content (shifted when panel is open) */}
        <div
          style={{
            transform: `translateX(${panelOpen ? "384px" : "0px"})`,
          }}
          className={`flex-1 transition-all duration-300`}
        >
          <TurnkeyProvider config={config} callbacks={callbacks}>
            <ThreeDimensionalBackground />
            <div className="relative z-10">{children}</div>
          </TurnkeyProvider>

          <Button
            onClick={() => setPanelOpen(!panelOpen)}
            className="fixed z-50 cursor-pointer top-1/2 -translate-y-1/2 w-[80px] h-[250px] rounded-r-xl bg-panel-background-light dark:bg-panel-background-dark flex items-center justify-center"
          >
            <span className="transform -rotate-90 text-xl font-mediumtext-center w-[250px] whitespace-pre text-black dark:text-white">
              Config
            </span>
          </Button>
        </div>
      </div>
    </ConfigContext.Provider>
  );
}
