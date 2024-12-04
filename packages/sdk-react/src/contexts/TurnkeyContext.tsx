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
  authIframeClient: TurnkeyIframeClient | undefined;
  passkeyClient: TurnkeyPasskeyClient | undefined;
  walletClient: TurnkeyWalletClient | undefined;
  getActiveClient: () => Promise<TurnkeyBrowserClient | undefined>;
}

export const TurnkeyContext = createContext<TurnkeyClientType>({
  client: undefined,
  turnkey: undefined,
  passkeyClient: undefined,
  authIframeClient: undefined,
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
  const [authIframeClient, setAuthIframeClient] = useState<
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
            readWriteSession.credentialBundle
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

        if (config.wallet) {
          setWalletClient(newTurnkey.walletClient(config.wallet));
        }

        const newAuthIframeClient = await newTurnkey.iframeClient({
          iframeContainer: document.getElementById(
            TurnkeyAuthIframeContainerId
          ),
          iframeUrl: "https://auth.turnkey.com",
          iframeElementId: TurnkeyAuthIframeElementId,
        });
        setAuthIframeClient(newAuthIframeClient);
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
    if (session?.authClient) {
      const client = {
        [AuthClient.Iframe]: authIframeClient,
        [AuthClient.Passkey]: passkeyClient,
        [AuthClient.Wallet]: walletClient,
      }[session?.authClient];
      setClient(client);
    }
  }, [session]);

  return (
    <TurnkeyContext.Provider
      value={{
        client,
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
        style={{ display: "none" }}
      />
    </TurnkeyContext.Provider>
  );
};
