"use client";

import DemoPanel from "@/components/demo/DemoPanel";
import UserSettings from "@/components/demo/UserSettings";
import { Spinner } from "@/components/Spinners";
import { faUserGear, faWallet } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Button,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
} from "@headlessui/react";
import {
  AuthState,
  ClientState,
  useModal,
  useTurnkey,
} from "@turnkey/react-wallet-kit";
import { useEffect } from "react";

export default function AuthPage() {
  const { handleLogin, clientState, authState } = useTurnkey();
  const { isMobile } = useModal();

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
      ) : !isMobile ? (
        <div className="flex items-center justify-center gap-10 w-fit">
          <UserSettings />
          <DemoPanel />
        </div>
      ) : (
        <TabGroup className="relative h-screen">
          <TabPanels className="flex justify-center items-center translate-y-10 h-[calc(100%-4rem)]">
            <TabPanel className="w-full">
              <UserSettings />
            </TabPanel>
            <TabPanel className="w-full">
              <DemoPanel />
            </TabPanel>
          </TabPanels>
          <TabList className="backdrop-blur flex border-t border-t-icon-background-light dark:border-t-icon-background-dark items-center justify-evenly h-16 w-full relative z-20">
            <Tab className="flex items-center justify-center flex-col group w-full">
              <FontAwesomeIcon
                className="transition-colors text-icon-text-light dark:text-icon-text-dark group-data-selected:text-primary-light dark:group-data-selected:text-primary-dark text-xl"
                icon={faUserGear}
              />
              <p>Account</p>
            </Tab>
            <Tab className="flex items-center justify-center flex-col group w-full">
              <FontAwesomeIcon
                className="transition-colors text-icon-text-light dark:text-icon-text-dark group-data-selected:text-primary-light dark:group-data-selected:text-primary-dark text-xl"
                icon={faWallet}
              />
              <p>Wallet</p>
            </Tab>
          </TabList>
        </TabGroup>
      )}
    </div>
  );
}
