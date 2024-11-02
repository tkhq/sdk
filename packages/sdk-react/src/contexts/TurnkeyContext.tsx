import { ReactNode, createContext, useState, useEffect, useRef } from "react";
import {
  Turnkey,
  TurnkeyIframeClient,
  TurnkeyPasskeyClient,
  TurnkeySDKBrowserConfig,
  TurnkeyBrowserClient,
} from "@turnkey/sdk-browser";

export interface TurnkeyClientType {
  turnkey: Turnkey | undefined;
  passkeyClient: TurnkeyPasskeyClient | undefined;
  authIframeClient: TurnkeyIframeClient | undefined;
  importIframeClient: TurnkeyIframeClient | undefined;
  exportIframeClient: TurnkeyIframeClient | undefined;
  getActiveClient: () => Promise<TurnkeyBrowserClient | undefined>;
}

export const TurnkeyContext = createContext<TurnkeyClientType>({
  turnkey: undefined,
  passkeyClient: undefined,
  authIframeClient: undefined,
  importIframeClient: undefined,
  exportIframeClient: undefined,
  getActiveClient: async () => {
    return undefined;
  },
});

interface TurnkeyProviderProps {
  children: ReactNode;
  config: TurnkeySDKBrowserConfig;
  importEnabled?: boolean;
  exportEnabled?: boolean;
}

const TurnkeyAuthIframeContainerId = "turnkey-auth-iframe-container-id";
const TurnkeyAuthIframeElementId = "turnkey-auth-iframe-element-id";

const TurnkeyImportIframeContainerId = "turnkey-import-iframe-container-id";
const TurnkeyImportIframeElementId = "turnkey-import-iframe-element-id";

const TurnkeyExportIframeContainerId = "turnkey-export-iframe-container-id";
const TurnkeyExportIframeElementId = "turnkey-export-iframe-element-id";

export const TurnkeyProvider: React.FC<TurnkeyProviderProps> = ({
  children,
  config,
  importEnabled = false,
  exportEnabled = false,
}) => {
  const [turnkey, setTurnkey] = useState<Turnkey | undefined>(undefined);

  // Set clients
  const [passkeyClient, setPasskeyClient] = useState<
    TurnkeyPasskeyClient | undefined
  >(undefined);
  const [authIframeClient, setAuthIframeClient] = useState<
    TurnkeyIframeClient | undefined
  >(undefined);
  const [importIframeClient, setImportIframeClient] = useState<
    TurnkeyIframeClient | undefined
  >(undefined);
  const [exportIframeClient, setExportIframeClient] = useState<
    TurnkeyIframeClient | undefined
  >(undefined);

  const iframeInit = useRef<boolean>(false);

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

        // By default, the auth iframe client is enabled
        const newAuthIframeClient = await newTurnkey.iframeClient({
          iframeContainer: document.getElementById(
            TurnkeyAuthIframeContainerId
          ),
          iframeUrl: "https://auth.turnkey.com",
          iframeElementId: TurnkeyAuthIframeElementId,
        });
        setAuthIframeClient(newAuthIframeClient);

        // Optionally include import iframe
        if (importEnabled) {
          const newImportIframeClient = await newTurnkey.iframeClient({
            iframeContainer: document.getElementById(
              TurnkeyImportIframeContainerId
            ),
            iframeUrl: "https://import.turnkey.com",
            iframeElementId: TurnkeyImportIframeElementId,
          });
          setImportIframeClient(newImportIframeClient);
        }

        // Optionally include export iframe
        if (exportEnabled) {
          const newExportIframeClient = await newTurnkey.iframeClient({
            iframeContainer: document.getElementById(
              TurnkeyExportIframeContainerId
            ),
            iframeUrl: "https://export.turnkey.com",
            iframeElementId: TurnkeyExportIframeElementId,
          });
          setExportIframeClient(newExportIframeClient);
        }
      }
    })();
  }, []);

  return (
    <TurnkeyContext.Provider
      value={{
        turnkey,
        passkeyClient,
        authIframeClient,
        importIframeClient,
        exportIframeClient,
        getActiveClient,
      }}
    >
      {children}
      <div
        className=""
        id={TurnkeyAuthIframeContainerId}
        style={{ display: "none" }}
      />
      {importEnabled && (
        <div
        className=""
        id={TurnkeyImportIframeContainerId}
        style={{ display: "none" }}
      />
      )}
      {exportEnabled && (
        <div
        className=""
        id={TurnkeyExportIframeContainerId}
        style={{ display: "none" }}
      />
      )}
    </TurnkeyContext.Provider>
  );
};
