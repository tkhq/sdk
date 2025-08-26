"use client";

import { ClientProvider } from "./client/Provider";
import { TurnkeyThemeOverrides } from "./theme/Overrides";
import type { TurnkeyCallbacks, TurnkeyProviderConfig } from "../types/base";

/** @internal */
export function TurnkeyProvider({
  children,
  config,
  callbacks,
}: {
  children: React.ReactNode;
  config: TurnkeyProviderConfig;
  callbacks?: TurnkeyCallbacks;
}) {
  return (
    <ClientProvider config={config} callbacks={callbacks}>
      <TurnkeyThemeOverrides
        light={config.ui?.colors?.light}
        dark={config.ui?.colors?.dark}
      />
      {children}

      {config.ui?.renderModalInProvider && (
        // https://github.com/tailwindlabs/headlessui/discussions/666#discussioncomment-3449763
        <div id="headlessui-portal-root">
          <div></div>
        </div>
      )}
    </ClientProvider>
  );
}
