"use client";

import DemoPanel from "@/components/demo/DemoPanel";
import UserSettings from "@/components/demo/UserSettings";
import { Spinner } from "@/components/Spinners";
import { Button } from "@headlessui/react";
import { AuthState, ClientState, useTurnkey } from "@turnkey/react-wallet-kit";
import { useEffect } from "react";

export default function AuthPage() {
  const { handleLogin, clientState, authState } = useTurnkey();

  useEffect(() => {
    if (
      clientState === ClientState.Ready &&
      authState === AuthState.Unauthenticated
    ) {
      handleLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientState]);

  return (
    <div className="w-full h-screen flex items-center justify-center">
      {authState === AuthState.Unauthenticated ? (
        clientState === ClientState.Loading ? (
          <Spinner className="size-48" strokeWidth={1} />
        ) : clientState === ClientState.Error ? (
          <Button
            onClick={() => window.location.reload()}
            className="w-full h-full flex justify-center items-center animate-pulse"
          >
            <span>
              An error has occurred. Press anywhere to refresh your page
            </span>
          </Button>
        ) : (
          <Button
            onClick={handleLogin}
            className="w-full h-full flex justify-center items-center animate-pulse"
          >
            <span>Press anywhere to login</span>
          </Button>
        )
      ) : (
        <div className="flex items-center justify-center gap-10 w-fit">
          <UserSettings />
          <DemoPanel />
        </div>
      )}
    </div>
  );
}
