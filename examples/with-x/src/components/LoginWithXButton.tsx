"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LoginWithXButton() {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  function handleXLogin() {
    setIsRedirecting(true);
    localStorage.setItem("oauth_state", "random_state");
    router.push("/auth/x");
  }

  return (
    <Button onClick={handleXLogin} disabled={isRedirecting}>
      {isRedirecting ? "Redirecting to" : "Login with"}
      <Image src="/x.svg" width={20} height={20} alt="X Logo" />
    </Button>
  );
}
