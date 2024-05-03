import { ReactNode, createContext, useState, useEffect, useRef, Dispatch, SetStateAction } from "react";
import {
  Turnkey,
  TurnkeyIframeClient,
  TurnkeyPasskeyClient,
  TurnkeySDKBrowserConfig,
} from "@turnkey/sdk-browser";

export interface TurnkeyClientType {
  turnkey: Turnkey | undefined;
  passkeyClient: TurnkeyPasskeyClient | undefined;
  authIframeClient: TurnkeyIframeClient | undefined;
  setAuthIframeStyle: Dispatch<SetStateAction<Record<any, any>>>;
}

export const TurnkeyContext = createContext<TurnkeyClientType>({
  turnkey: undefined,
  passkeyClient: undefined,
  authIframeClient: undefined,
  setAuthIframeStyle: ({}) => undefined,
});

interface TurnkeyProviderProps {
  children: ReactNode;
  config: TurnkeySDKBrowserConfig;
}

export const TurnkeyProvider: React.FC<TurnkeyProviderProps> = ({
  config,
  children,
}) => {
  const [turnkey, setTurnkey] = useState<Turnkey | undefined>(undefined);
  const [passkeyClient, setPasskeyClient] = useState<TurnkeyPasskeyClient | undefined>(undefined);

  const [authIframeClient, setAuthIframeClient] = useState<TurnkeyIframeClient | undefined>(undefined);
  const [authIframeStyle, setAuthIframeStyle] = useState<Record<any, any>>({ display: "none" });

  const iframesInit = useRef<boolean>(false);

  const TurnkeyAuthIframeContainerId = "turnkey-auth-iframe-container-id";

  useEffect(() => {
    (async () => {
      if (!iframesInit.current) {

        iframesInit.current = true;

        const newTurnkey = new Turnkey(config);
        setTurnkey(newTurnkey);

        setPasskeyClient(newTurnkey.passkeyClient());

        const newAuthIframeClient = await newTurnkey.iframeClient({
          iframeContainer: document.getElementById(TurnkeyAuthIframeContainerId),
          iframeUrl: "https://auth.turnkey.com"
        });
        setAuthIframeClient(newAuthIframeClient);

      }
    })();
  }, []);

  return (
    <TurnkeyContext.Provider
      value={{
        turnkey,
        passkeyClient,
        authIframeClient,
        setAuthIframeStyle,
      }}
    >
      {children}
      <div id={TurnkeyAuthIframeContainerId} style={authIframeStyle} />
    </TurnkeyContext.Provider>
  );
};
