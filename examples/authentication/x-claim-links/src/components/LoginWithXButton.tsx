"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LoginWithXButton({ subOrgId }: { subOrgId?: string }) {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  function handleXLogin() {
    setIsRedirecting(true);
    const state = crypto.randomUUID();
    localStorage.setItem("oauth_state", state); // satisfies the kit's internal state check on redirect
    const params = new URLSearchParams({ state });
    if (subOrgId) params.set("allocation", subOrgId);
    router.push(`/auth/x?${params.toString()}`);
  }

  return (
    <Button onClick={handleXLogin} disabled={isRedirecting}>
      {isRedirecting ? "Redirecting to" : "Login with"}
      <Image src="/x.svg" width={20} height={20} alt="X Logo" />
    </Button>
  );
}
