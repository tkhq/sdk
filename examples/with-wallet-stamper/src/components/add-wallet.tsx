'use client';

import React, { useState } from 'react';

import { useTurnkey } from './turnkey-provider'; // Import useTurnkey from turnkey-provider
import { Button } from './ui/button';
import { Email } from '@/lib/turnkey';
import { Input } from './ui/input';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { toHex } from 'viem';
import * as ed from '@noble/ed25519';
import bs58check from 'bs58check';
import bs58 from 'bs58';

const AddWalletAuth: React.FC = () => {
  const { connected, publicKey } = useWallet();
  const [email, setEmail] = useState('');
  const { addWalletAuthenticator } = useTurnkey();

  if (!connected) {
    return null;
  }
  const handleAddWallet = async () => {
    const pubKey = publicKey?.toBuffer();
    if (publicKey && pubKey) {
      const pubKeyBytes = PublicKey.decode(pubKey);
      //   console.log(
      //     'handle add wallet ',
      //     Buffer.from(pubKeyBytes.toBuffer()).toString('hex')
      //   );
      const decodedPublicKey = Buffer.from(pubKey).toString('hex');
      console.log('decodedPublicKey', decodedPublicKey);

      const encodedPublicKey = bs58.encode(
        Buffer.from(decodedPublicKey, 'hex')
      );
      console.log('encodedPublicKey', encodedPublicKey);

      const pubK = new PublicKey(Buffer.from(decodedPublicKey, 'hex'));
      console.log('pubK', pubK.toString());
    }
    // if (email) {
    //   try {
    //     console.log('Attempting to add wallet authenticator for:', email);
    //     await addWalletAuthenticator(email as Email);
    //     console.log('Wallet authenticator added successfully');
    //   } catch (error) {
    //     console.error('Failed to add wallet authenticator:', error);
    //   }
    // }
  };

  return (
    <div>
      <Input
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button onClick={handleAddWallet}>Add Wallet</Button>
    </div>
  );
};

export default AddWalletAuth;
