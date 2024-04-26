import { ReactNode, createContext, useState, useEffect, useRef } from "react";
import type {
  Turnkey,
  TurnkeyIframeClient,
  TurnkeyPasskeyClient,
  TurnkeySDKBrowserConfig,
} from "@turnkey/sdk-browser";

export interface TurnkeyClientType {
  turnkey: Turnkey | undefined;
  iframeClient: TurnkeyIframeClient | undefined;
  passkeyClient: TurnkeyPasskeyClient | undefined;
}

export const TurnkeyContext = createContext<TurnkeyClientType>({
  turnkey: undefined,
  passkeyClient: undefined,
  iframeClient: undefined,
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
  const [passkeyClient, setPasskeyClient] = useState<
    TurnkeyPasskeyClient | undefined
  >(undefined);
  const [iframeClient, setIframeClient] = useState<
    TurnkeyIframeClient | undefined
  >(undefined);
  const iframeInit = useRef<boolean>(false);

  const isBrowser = typeof window !== 'undefined';
  const TurnkeyIframeContainerId = "turnkey-auth-iframe-container-id";

  useEffect(() => {
    if (!isBrowser) {
      console.log("CALLED IN SERVER ENVIRONMENT");
      return;
    } else {
      console.log("CALLED IN BROWSER ENVIRONMENT");
      // console.log(Turnkey);
    }

    // (async () => {
    //   if (!iframeInit.current) {
    //     iframeInit.current = true;
    //     const newTurnkey = new Turnkey(config);
    //     setTurnkey(newTurnkey);
    //     setPasskeyClient(newTurnkey.passkeyClient());
    //     const newIframeClient = await newTurnkey.iframeClient(
    //       document.getElementById(TurnkeyIframeContainerId)
    //     );
    //     setIframeClient(newIframeClient);
    //   }
    // })();
  }, []);

  return (
    <TurnkeyContext.Provider
      value={{
        turnkey,
        passkeyClient,
        iframeClient,
      }}
    >
      {children}
      {isBrowser && <div id={TurnkeyIframeContainerId} style={{ display: "none" }} />}
    </TurnkeyContext.Provider>
  );
};
