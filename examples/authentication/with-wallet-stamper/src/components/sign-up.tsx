"use client";

import React, { useState } from "react";

import { useTurnkey } from "./turnkey-provider"; // Import useTurnkey from turnkey-provider
import { Button } from "./ui/button";
import { Email } from "@/lib/turnkey";
import { Input } from "./ui/input";
import { useWallet } from "@solana/wallet-adapter-react";

const SignUp: React.FC = () => {
  const { connected } = useWallet();
  const [email, setEmail] = useState("");
  const { createSubOrg } = useTurnkey();

  if (!connected) {
    return null;
  }
  const handleSignUp = async () => {
    if (email) {
      try {
        await createSubOrg(email as Email);
      } catch (error) {
        console.error("Failed to create sub organization:", error);
      }
    }
  };

  return (
    <div>
      <Input
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button onClick={handleSignUp}>Sign Up</Button>
    </div>
  );
};

export default SignUp;
