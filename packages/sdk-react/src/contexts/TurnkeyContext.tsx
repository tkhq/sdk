import { ReactNode, createContext, useState, useEffect, useRef } from 'react';
import {
  Turnkey,
  TurnkeyIframeClient,
  TurnkeyPasskeyClient,
  TurnkeySDKBrowserConfig,
  TurnkeyBrowserClient,
  TurnkeyWalletClient,
} from '@turnkey/sdk-browser';
import type { WalletInterface } from '@turnkey/wallet-stamper';

export interface TurnkeyClientType {
  turnkey: Turnkey | undefined;
  authIframeClient: TurnkeyIframeClient | undefined;
  passkeyClient: TurnkeyPasskeyClient | undefined;
  walletClient: TurnkeyWalletClient | undefined;
  getActiveClient: () => Promise<TurnkeyBrowserClient | undefined>;
}

export const TurnkeyContext = createContext<TurnkeyClientType>({
  turnkey: undefined,
  passkeyClient: undefined,
  authIframeClient: undefined,
  walletClient: undefined,
  getActiveClient: async () => {
    return undefined;
  },
});

interface TurnkeyProviderProps {
  children: ReactNode;
  config: TurnkeySDKBrowserConfig & {
    wallet: WalletInterface;
  };
}

export const TurnkeyProvider: React.FC<TurnkeyProviderProps> = ({
  config,
  children,
}) => {
  const [turnkey, setTurnkey] = useState<Turnkey | undefined>(undefined);
  const [passkeyClient, setPasskeyClient] = useState<
    TurnkeyPasskeyClient | undefined
  >(undefined);
  const [walletClient, setWalletClient] = useState<
    TurnkeyWalletClient | undefined
  >(undefined);
  const [authIframeClient, setAuthIframeClient] = useState<
    TurnkeyIframeClient | undefined
  >(undefined);
  const iframeInit = useRef<boolean>(false);

  const TurnkeyAuthIframeContainerId = 'turnkey-auth-iframe-container-id';
  const TurnkeyAuthIframeElementId = 'turnkey-auth-iframe-element-id';

  const getActiveClient = async () => {
    let currentClient: TurnkeyBrowserClient | undefined = passkeyClient;
    const currentUser = await turnkey?.getCurrentUser();

    try {
      // check if the iframeClient is active
      await authIframeClient?.getWhoami({
        organizationId:
          currentUser?.organization.organizationId ??
          turnkey?.config.defaultOrganizationId!,
      });
      currentClient = authIframeClient;
    } catch (error: any) {
      try {
        // if not, check if there's a readWriteSession in localStorage, and try to initialize an iframeClient with it
        const readWriteSession = await turnkey?.getReadWriteSession();

        if (readWriteSession) {
          const injected = await authIframeClient?.injectCredentialBundle(
            readWriteSession.authBundle
          );
          if (injected) {
            await authIframeClient?.getWhoami({
              organizationId:
                currentUser?.organization.organizationId ??
                turnkey?.config.defaultOrganizationId!,
            });
            currentClient = authIframeClient;
          }
        }
      } catch (error: any) {
        // default to using the passkeyClient
      }
    }

    return currentClient;
  };

  useEffect(() => {
    (async () => {
      if (!iframeInit.current) {
        iframeInit.current = true;

        const newTurnkey = new Turnkey(config);
        setTurnkey(newTurnkey);
        setPasskeyClient(newTurnkey.passkeyClient());
        setWalletClient(await newTurnkey.walletClient(config.wallet));

        const newAuthIframeClient = await newTurnkey.iframeClient({
          iframeContainer: document.getElementById(
            TurnkeyAuthIframeContainerId
          ),
          iframeUrl: 'https://auth.turnkey.com',
          iframeElementId: TurnkeyAuthIframeElementId,
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
        walletClient,
        getActiveClient,
      }}
    >
      {children}
      <div
        className=""
        id={TurnkeyAuthIframeContainerId}
        style={{ display: 'none' }}
      />
    </TurnkeyContext.Provider>
  );
};
