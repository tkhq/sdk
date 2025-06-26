import { TurnkeySDKClientConfig } from "@turnkey/sdk-js";
import { ClientProvider } from "./client/Provider";
import { ModalProvider } from "./modal/Provider";

export interface TurnkeyProviderConfig extends TurnkeySDKClientConfig {
  // TODO: Add anything else you need for the TurnkeyProvider
}

export function TurnkeyProvider({
  children,
  config,
}: {
  children: React.ReactNode;
  config: TurnkeyProviderConfig;
}) {
  return (
    <ModalProvider>
      <ClientProvider config={config}>{children}</ClientProvider>
    </ModalProvider>
  );
}
