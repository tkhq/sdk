import { http, createConfig } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import {
  coinbaseWallet,
  injected,
  walletConnect,
  safe,
} from 'wagmi/connectors';
import { turnkey } from '@turnkey/wagmi';
import { onTurnkeyAuth } from './walletui';

const WALLET_ID = '581b8fb0-6b7f-5316-a795-911df6ea032a';
const RPC_URL = 'https://sepolia.infura.io/v3/c20bd1f24c384a0484d689caff11cacd';
const APP_ID = '70189536-9086-4810-a9f0-990d4e7cd622';

export const config = createConfig({
  chains: [mainnet, sepolia],
  connectors: [
    injected(),
    coinbaseWallet({
      appName: 'test',
      headlessMode: true,
    }),
    turnkey({
      rpcUrl: RPC_URL,
      walletId: WALLET_ID,
      appId: APP_ID,
      onTurnkeyAuth,
    }),
  ],
  ssr: true,
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
