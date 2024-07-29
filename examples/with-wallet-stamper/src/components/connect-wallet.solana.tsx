'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from './ui/button';
import {
  useWalletModal,
  WalletConnectButton,
} from '@solana/wallet-adapter-react-ui';

export function ConnectWallet() {
  const { connected, connect, select } = useWallet();
  const { setVisible } = useWalletModal();
  // const { buttonState, onConnect, onDisconnect, onSelectWallet } =
  //   useWalletMultiButton({
  //     onSelectWallet: setWalletModalConfig,
  //   });

  return (
    <Button
      onClick={() => {
        console.log('click');
        setVisible(true);
        // connect();
      }}
    >
      {connected ? 'Connected' : 'Connect'}
    </Button>
  );
}
