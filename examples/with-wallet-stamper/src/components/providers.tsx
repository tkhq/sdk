'use client';

import React, { useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import {
  WalletModalProvider,
  WalletMultiButton,
} from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

// Default styles that can be overridden by your app
import '@solana/wallet-adapter-react-ui/styles.css';
import { TurnkeyProvider } from './turnkey-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  const network = WalletAdapterNetwork.Testnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(() => [new SolflareWalletAdapter()], [network]);
  // @todo add autoConnect back
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets}>
        <WalletModalProvider>
          <TurnkeyProvider>{children}</TurnkeyProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
