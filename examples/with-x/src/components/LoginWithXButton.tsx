"use client";

import Image from "next/image";
import { useState } from "react";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import { Button } from "@/components/ui/button";

export function LoginWithXButton() {
  const { handleXOauth } = useTurnkey();
  const [isRedirecting, setIsRedirecting] = useState(false);

  async function handleXLogin() {
    setIsRedirecting(true);
    await handleXOauth({ openInPage: true })
  }

  return (
    <Button onClick={handleXLogin} disabled={isRedirecting}>
      {isRedirecting ? "Redirecting to" : "Login with"}
      <Image src="/x.svg" width={20} height={20} alt="X Logo" />
    </Button>
  );
}
