import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { Transition } from "@headlessui/react";
import {
  TurnkeyProviderConfig,
  TurnkeyProvider,
  TurnkeyCallbacks,
  useModal,
} from "@turnkey/react-wallet-kit";

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
      <div className="overflow-hidden h-screen absolute inset-0 flex">
        {/* Toggle Button */}
        <button
          onClick={() => setPanelOpen((v) => !v)}
          className="absolute z-30 top-4 left-4 p-2 rounded-md bg-white dark:bg-black border border-gray-300 dark:border-gray-700 shadow transition hover:bg-gray-100 dark:hover:bg-gray-900"
        >
          <div className="w-5 h-5 bg-yellow-400 text-gray-700 dark:text-gray-200" />
        </button>

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
          <div className="z-20 fixed top-0 left-0 h-full w-72 bg-white dark:bg-zinc-900 border-r border-gray-300 dark:border-gray-700 shadow-lg flex flex-col px-4 py-6 space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Config Panel</h2>
              <button onClick={() => setPanelOpen(false)}>X</button>
            </div>

            {/* Place for future toggles */}
            <div className="flex flex-col space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Add configuration toggles here.
              </p>
            </div>
          </div>
        </Transition>

        {/* Content (shifted when panel is open) */}
        <div
          style={{
            transform: `translateX(${panelOpen ? "288px" : "0px"})`, // 72 * 4 (padding + border)
          }}
          className={`flex-1 transition-all duration-300`}
        >
          <TurnkeyProvider config={config} callbacks={callbacks}>
            {children}
          </TurnkeyProvider>
        </div>
      </div>
    </ConfigContext.Provider>
  );
}
