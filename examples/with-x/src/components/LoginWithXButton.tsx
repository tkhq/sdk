"use client";

import Image from "next/image";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import { Button } from "@/components/ui/button";

export function LoginWithXButton() {
  const { handleXOauth } = useTurnkey();

  return (
    <Button onClick={() => handleXOauth({ openInPage: true })}>
      Login with
      <Image src="/x.svg" width={20} height={20} alt="X Logo" />
    </Button>
  );
}
