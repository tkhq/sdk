import { ReactNode, createContext, useState, useEffect, useRef } from "react";
import {
  TurnkeyBrowserSDK,
  TurnkeySDKBrowserClient,
  TurnkeySDKIframeClient,
  TurnkeySDKBrowserConfig,
} from "@turnkey/sdk-browser";

export interface TurnkeyClientType {
  turnkeyClient: TurnkeyBrowserSDK | undefined;
  iframeSigner: TurnkeySDKIframeClient | undefined;
  passkeySigner: TurnkeySDKBrowserClient | undefined;
}

export const TurnkeyContext = createContext<TurnkeyClientType>({
  turnkeyClient: undefined,
  passkeySigner: undefined,
  iframeSigner: undefined,
});

interface TurnkeyProviderProps {
  children: ReactNode;
  config: TurnkeySDKBrowserConfig;
}

export const TurnkeyProvider: React.FC<TurnkeyProviderProps> = ({
  config,
  children,
}) => {
  const [turnkeyClient, setTurnkeyClient] = useState<TurnkeyBrowserSDK | undefined>(undefined);
  const [passkeySigner, setPasskeySigner] = useState<TurnkeySDKBrowserClient | undefined>(undefined);
  const [iframeSigner, setIframeSigner] = useState<TurnkeySDKIframeClient | undefined>(undefined);
  const iframeInit = useRef<boolean>(false);

  const TurnkeyIframeContainerId = "turnkey-auth-iframe-container-id";

  useEffect(() => {
    (async () => {
      if (!iframeInit.current) {
        iframeInit.current = true;
        const newTurnkeyClient = new TurnkeyBrowserSDK(config);
        setTurnkeyClient(newTurnkeyClient);
        setPasskeySigner(await newTurnkeyClient.passkeySigner());
        const iframeClient = await newTurnkeyClient.iframeSigner(document.getElementById(TurnkeyIframeContainerId));
        setIframeSigner(iframeClient);
      }
    })();
  }, []);

  return (
    <TurnkeyContext.Provider
      value={{
        turnkeyClient,
        passkeySigner,
        iframeSigner,
      }}
    >
      {children}
      <div
        className=""
        id={TurnkeyIframeContainerId}
        style={{ display: "none" }}
      />
    </TurnkeyContext.Provider>
  );
};
