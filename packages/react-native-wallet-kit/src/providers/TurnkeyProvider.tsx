import React, { ReactNode } from 'react';
import { ClientProvider } from './client/Provider';
import { ModalProvider } from './modal/Provider';
import type { TurnkeyCallbacks, TurnkeyProviderConfig } from '../types/base';

interface TurnkeyProviderProps {
  children: ReactNode;
  config: TurnkeyProviderConfig;
  callbacks?: TurnkeyCallbacks;
}

/**
 * Root provider for the Turnkey React Native Wallet Kit.
 * 
 * This provider sets up the entire context hierarchy needed for the SDK:
 * - ModalProvider: Manages modal/screen navigation state
 * - ClientProvider: Manages authentication, sessions, and wallet operations
 * 
 * Usage:
 * ```tsx
 * <TurnkeyProvider config={config} callbacks={callbacks}>
 *   <YourApp />
 * </TurnkeyProvider>
 * ```
 */
export function TurnkeyProvider({
  children,
  config,
  callbacks,
}: TurnkeyProviderProps) {
  return (
    <ModalProvider>
      <ClientProvider config={config} callbacks={callbacks}>
        {children}
      </ClientProvider>
    </ModalProvider>
  );
}