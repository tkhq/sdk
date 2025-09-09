"use client";

import {
  type ReactNode,
  createContext,
  useState,
  useEffect,
  useRef,
} from "react";
import {
  Turnkey,
  TurnkeyIframeClient,
  TurnkeyIndexedDbClient,
  TurnkeyPasskeyClient,
  type TurnkeySDKBrowserConfig,
  TurnkeyBrowserClient,
  TurnkeyWalletClient,
  AuthClient,
} from "@turnkey/sdk-browser";
import type { WalletInterface } from "@turnkey/wallet-stamper";
import { useSession } from "../hooks/use-session";

export interface TurnkeyClientType {
  client: TurnkeyBrowserClient | undefined;
  turnkey: Turnkey | undefined;
  authIframeClient: TurnkeyIframeClient | undefined;
  passkeyClient: TurnkeyPasskeyClient | undefined;
  walletClient: TurnkeyWalletClient | undefined;
  indexedDbClient: TurnkeyIndexedDbClient | undefined;
}

export const TurnkeyContext = createContext<TurnkeyClientType>({
  client: undefined,
  turnkey: undefined,
  passkeyClient: undefined,
  authIframeClient: undefined,
  walletClient: undefined,
  indexedDbClient: undefined,
});

type TurnkeyProviderConfig = TurnkeySDKBrowserConfig & {
  wallet?: WalletInterface;
};

interface TurnkeyProviderProps {
  children: ReactNode;
  config: TurnkeyProviderConfig;
}

export const TurnkeyProvider: React.FC<TurnkeyProviderProps> = ({
  config,
  children,
}) => {
  const [turnkey, setTurnkey] = useState<Turnkey | undefined>(undefined);
  const [indexedDbClient, setIndexedDbClient] = useState<
    TurnkeyIndexedDbClient | undefined
  >(undefined);
  const [passkeyClient, setPasskeyClient] = useState<
    TurnkeyPasskeyClient | undefined
  >(undefined);
  const [walletClient, setWalletClient] = useState<
    TurnkeyWalletClient | undefined
  >(undefined);
  const [authIframeClient, setAuthIframeClient] = useState<
    TurnkeyIframeClient | undefined
  >(undefined);
  const [client, setClient] = useState<TurnkeyBrowserClient | undefined>(
    undefined,
  );

  const { session, authClient } = useSession();

  const iframeInit = useRef<boolean>(false);

  const TurnkeyAuthIframeContainerId = "turnkey-auth-iframe-container-id";
  const TurnkeyAuthIframeElementId = "turnkey-auth-iframe-element-id";

  useEffect(() => {
    (async () => {
      if (!iframeInit.current) {
        iframeInit.current = true;

        // create an instance of TurnkeyBrowserSDK
        const turnkeyBrowserSDK = new Turnkey(config);
        setTurnkey(turnkeyBrowserSDK);

        // create an instance of TurnkeyPasskeyClient
        setPasskeyClient(turnkeyBrowserSDK.passkeyClient());

        if (config.wallet) {
          setWalletClient(turnkeyBrowserSDK.walletClient(config.wallet));
        }

        // create an instance of TurnkeyIframeClient
        const iframeClient = await turnkeyBrowserSDK.iframeClient({
          iframeContainer: document.getElementById(
            TurnkeyAuthIframeContainerId,
          ),
          iframeUrl: config.iframeUrl || "https://auth.turnkey.com",
          ...(config.dangerouslyOverrideIframeKeyTtl && {
            dangerouslyOverrideIframeKeyTtl:
              config.dangerouslyOverrideIframeKeyTtl,
          }),
          iframeElementId: TurnkeyAuthIframeElementId,
        });
        setAuthIframeClient(iframeClient);

        // create an instance of TurnkeyIndexedDbClient
        const indexedDbClient = await turnkeyBrowserSDK.indexedDbClient();
        await indexedDbClient?.init();
        setIndexedDbClient(indexedDbClient);
      }
    })();
  }, []);

  /**
   * Effect hook that updates the active client based on the current session's authenticated client.
   *
   * This hook listens for changes in the `session` object. If the `session` contains an `authClient`,
   * it determines which client was used for initial authentication by checking the `authClient` key.
   * It then sets the corresponding client (either `authIframeClient`, `passkeyClient`, `walletClient`, or `indexedDbClient`)
   * as the active client using the `setClient` function.
   *
   * If the `session` changes, the `authClient` will be recomputed and the active client will be
   * updated accordingly.
   */
  useEffect(() => {
    switch (authClient) {
      case AuthClient.Iframe:
        let expiry = session?.expiry || 0;
        if (expiry > Date.now() && session?.token) {
          authIframeClient
            ?.injectCredentialBundle(session.token)
            .then(() => {
              setClient(authIframeClient);
            })
            .catch((error) => {
              console.error("Failed to inject credential bundle:", error);
            });
        }
        break;
      case AuthClient.Passkey:
        setClient(passkeyClient);
        break;
      case AuthClient.Wallet:
        setClient(walletClient);
        break;
      case AuthClient.IndexedDb:
        expiry = session?.expiry || 0;
        if (expiry > Date.now() && session?.token) {
          setClient(indexedDbClient);
        }
        break;
      default:
        // Handle unknown auth client type if needed
        break;
    }
  }, [session, authIframeClient, passkeyClient, walletClient, indexedDbClient]);

  return (
    <TurnkeyContext.Provider
      value={{
        client,
        turnkey,
        passkeyClient,
        authIframeClient,
        indexedDbClient,
        walletClient,
      }}
    >
      {children}
      <div
        className=""
        id={TurnkeyAuthIframeContainerId}
        style={{ display: "none" }}
      />
    </TurnkeyContext.Provider>
  );
};
