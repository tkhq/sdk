import { ReactNode, createContext, useState, useEffect, useRef } from 'react';

import {
  TurnkeyBrowserSDK,
  TurnkeySDKBrowserClient,
  TurnkeySDKBrowserConfig
} from '@turnkey/sdk-js-browser';

export interface TurnkeyClientType {
  turnkeyClient: TurnkeyBrowserSDK | undefined;
  iframeClient: TurnkeySDKBrowserClient | undefined;
}

export const TurnkeyContext = createContext<TurnkeyClientType> ({
  turnkeyClient: undefined,
  iframeClient: undefined
});

interface TurnkeyProviderProps {
  children: ReactNode;
  config: TurnkeySDKBrowserConfig;
}

export const TurnkeyProvider: React.FC<TurnkeyProviderProps> = ({ config, children }) => {
  const [turnkeyClient, setTurnkeyClient] = useState<TurnkeyBrowserSDK | undefined>(undefined);
  const [iframeClient, setIframeClient] = useState<TurnkeySDKBrowserClient | undefined>(undefined);
  const iframeInit = useRef<boolean>(false);

  const TurnkeyIframeContainerId = "turnkey-auth-iframe-container-id";

  useEffect(() => {

    (async () => {
      if (!iframeInit.current) {
        iframeInit.current = true;
        const tkClient = new TurnkeyBrowserSDK(config);
        setTurnkeyClient(tkClient);
        const ifClient = await tkClient.iframeSign(document.getElementById(TurnkeyIframeContainerId));
        setIframeClient(ifClient);
      }
    })();

  }, []);

  return (
    <TurnkeyContext.Provider value={{ turnkeyClient, iframeClient }}>
      {children}
      <div className='' id={TurnkeyIframeContainerId} style={{display: "none"}} />
    </TurnkeyContext.Provider>
  )

}
