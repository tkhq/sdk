"use client";

import { ReactNode, createContext, useState, useEffect, useRef } from "react";
import {
  Turnkey,
  TurnkeyIframeClient,
  TurnkeyIndexedDbClient,
  TurnkeyPasskeyClient,
  TurnkeySDKBrowserConfig,
  TurnkeyBrowserClient,
  TurnkeyWalletClient,
  AuthClient,
} from "@turnkey/sdk-browser";
import type { WalletInterface } from "@turnkey/wallet-stamper";
import { useUserSession } from "../hooks/use-session";

export interface TurnkeyClientType {
  client: TurnkeyBrowserClient | undefined;
  turnkey: Turnkey | undefined;
  authIframeClient: TurnkeyIframeClient | undefined;
  passkeyClient: TurnkeyPasskeyClient | undefined;
  walletClient: TurnkeyWalletClient | undefined;
  indexedDbClient: TurnkeyIndexedDbClient | undefined;
  getActiveClient: () => Promise<TurnkeyBrowserClient | undefined>;
}

export const TurnkeyContext = createContext<TurnkeyClientType>({
  client: undefined,
  turnkey: undefined,
  passkeyClient: undefined,
  authIframeClient: undefined,
  walletClient: undefined,
  indexedDbClient: undefined,
  getActiveClient: async () => {
    return undefined;
  },
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

  const { session } = useUserSession();

  const iframeInit = useRef<boolean>(false);

  const TurnkeyAuthIframeContainerId = "turnkey-auth-iframe-container-id";
  const TurnkeyAuthIframeElementId = "turnkey-auth-iframe-element-id";

  const getActiveClient = async () => {
    // default the currentClient to the passkeyClient
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
        /**
         * if the authIframeClient is not active, check if there's a readWriteSession in localStorage
         * and try to initialize an authIframeClient with it
         */
        const readWriteSession = await turnkey?.getSession();

        if (readWriteSession) {
          await authIframeClient?.loginWithSession(readWriteSession);
          currentClient = authIframeClient;
        }
      } catch (error: any) {
        /**
         * if the authIframeClient is not active and there's no readWriteSession in localStorage,
         * or if injecting the readWriteSession into the authIframeClient fails, default to the passkeyClient
         */
      }
    }

    return currentClient;
  };

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
        setIndexedDbClient(indexedDbClient);

      }
    })();
  }, []);

  /**
   * Effect hook that updates the active client based on the current session's authenticated client.
   *
   * This hook listens for changes in the `session` object. If the `session` contains an `authClient`,
   * it determines which client was used for initial authentication by checking the `authClient` key.
   * It then sets the corresponding client (either `authIframeClient`, `passkeyClient`, or `walletClient`)
   * as the active client using the `setClient` function.
   *
   * If the `session` changes, the `authClient` will be recomputed and the active client will be
   * updated accordingly.
   */
  useEffect(() => {
    switch (session?.authClient) {
      case AuthClient.Iframe:
        const expiry = session?.write?.expiry || 0;
        if (expiry > Date.now() && session?.write?.credentialBundle) {
          authIframeClient
            ?.injectCredentialBundle(session.write.credentialBundle)
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
        setClient(indexedDbClient);
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
        getActiveClient,
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
