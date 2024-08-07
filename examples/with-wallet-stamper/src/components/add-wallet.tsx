"use client";

import React, { useState } from "react";

import { useTurnkey } from "./turnkey-provider"; // Import useTurnkey from turnkey-provider
import { Button } from "./ui/button";
import { Email } from "@/lib/turnkey";
import { Input } from "./ui/input";
import { useWallet } from "@solana/wallet-adapter-react";

const AddWalletAuth: React.FC = () => {
  const { connected, publicKey, signMessage } = useWallet();
  const [email, setEmail] = useState("");
  const { addWalletAuthenticator, signInWithWallet } = useTurnkey();

  if (!connected) {
    return null;
  }

  const handleAddWallet = async () => {
    if (email) {
      try {
        console.log("Attempting to add wallet authenticator for:", email);
        await addWalletAuthenticator(email as Email);
        console.log("Wallet authenticator added successfully");
      } catch (error) {
        console.error("Failed to add wallet authenticator:", error);
      }
    }
  };

  const handleListWallets = async () => {
    const wallets = await signInWithWallet(email as Email);
  };

  return (
    <div>
      <Input
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button onClick={handleAddWallet}>Add Wallet</Button>
      <Button onClick={handleListWallets}>List Wallets</Button>
    </div>
  );
};

export default AddWalletAuth;
