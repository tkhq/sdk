"use client";

import { ReactNode, createContext, useState, useEffect, useRef } from "react";
import {
  Turnkey,
  TurnkeyIframeClient,
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
  iframeClient: TurnkeyIframeClient | undefined;
  passkeyClient: TurnkeyPasskeyClient | undefined;
  walletClient: TurnkeyWalletClient | undefined;
  getActiveClient: () => Promise<TurnkeyBrowserClient | undefined>;
}

export const TurnkeyContext = createContext<TurnkeyClientType>({
  client: undefined,
  turnkey: undefined,
  passkeyClient: undefined,
  iframeClient: undefined,
  walletClient: undefined,
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
  const [passkeyClient, setPasskeyClient] = useState<
    TurnkeyPasskeyClient | undefined
  >(undefined);
  const [walletClient, setWalletClient] = useState<
    TurnkeyWalletClient | undefined
  >(undefined);
  const [iframeClient, setIframeClient] = useState<
    TurnkeyIframeClient | undefined
  >(undefined);

  const [client, setClient] = useState<TurnkeyBrowserClient | undefined>(
    undefined
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
      await iframeClient?.getWhoami({
        organizationId:
          currentUser?.organization.organizationId ??
          turnkey?.config.defaultOrganizationId!,
      });
      currentClient = iframeClient;
    } catch (error: any) {
      try {
        /**
         * if the iframeClient is not active, check if there's a readWriteSession in localStorage
         * and try to initialize an iframeClient with it
         */
        const readWriteSession = await turnkey?.getReadWriteSession();

        if (readWriteSession) {
          const injected = await iframeClient?.injectCredentialBundle(
            readWriteSession.credentialBundle
          );
          if (injected) {
            await iframeClient?.getWhoami({
              organizationId:
                currentUser?.organization.organizationId ??
                turnkey?.config.defaultOrganizationId!,
            });
            currentClient = iframeClient;
          }
        }
      } catch (error: any) {
        /**
         * if the iframeClient is not active and there's no readWriteSession in localStorage,
         * or if injecting the readWriteSession into the iframeClient fails, default to the passkeyClient
         */
      }
    }

    return currentClient;
  };

  useEffect(() => {
    (async () => {
      if (!iframeInit.current) {
        iframeInit.current = true;
        console.log("TurnkeyContext config", config);
        // create an instance of TurnkeyBrowserSDK
        const turnkeyBrowserSDK = new Turnkey(config);
        setTurnkey(turnkeyBrowserSDK);
        setPasskeyClient(turnkeyBrowserSDK.passkeyClient());

        if (config.wallet) {
          setWalletClient(turnkeyBrowserSDK.walletClient(config.wallet));
        }

        const iframeClient = await turnkeyBrowserSDK.iframeClient({
          iframeContainer: document.getElementById(
            TurnkeyAuthIframeContainerId
          ),
          iframeUrl: config.iframeUrl || "https://auth.turnkey.com",
          iframeElementId: TurnkeyAuthIframeElementId,
        });
        setIframeClient(iframeClient);
      }
    })();
  }, []);

  /**
   * Effect hook that updates the active client based on the current session's authenticated client.
   *
   * This hook listens for changes in the `session` object. If the `session` contains an `authClient`,
   * it determines which client was used for initial authentication by checking the `authClient` key.
   * It then sets the corresponding client (either `iframeClient`, `passkeyClient`, or `walletClient`)
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
          iframeClient
            ?.injectCredentialBundle(session.write.credentialBundle)
            .then(() => {
              setClient(iframeClient);
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
      default:
        // Handle unknown auth client type if needed
        break;
    }
  }, [session, iframeClient, passkeyClient, walletClient]);

  return (
    <TurnkeyContext.Provider
      value={{
        client,
        turnkey,
        passkeyClient,
        iframeClient,
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
