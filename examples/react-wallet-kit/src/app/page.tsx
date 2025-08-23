"use client";

import DemoPanel from "@/components/demo/DemoPanel";
import UserSettings from "@/components/demo/UserSettings";
import { Spinner } from "@/components/Spinners";
import { useScreenSize } from "@/utils";
import { faUserGear, faWallet } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Button,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  Transition,
} from "@headlessui/react";
import { AuthState, ClientState, useTurnkey } from "@turnkey/react-wallet-kit";
import { useEffect, useState } from "react";

export default function AuthPage() {
  const { handleLogin, clientState, authState } = useTurnkey();

  const [selectedTabIndex, setSelectedTabIndex] = useState(1);

  useEffect(() => {
    if (
      clientState === ClientState.Ready &&
      authState === AuthState.Unauthenticated
    ) {
      handleLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientState]);

  const { isMobile } = useScreenSize();

  return (
    <div className="w-full flex items-center justify-center h-dvh">
      {authState === AuthState.Unauthenticated &&
        (clientState === undefined || clientState === ClientState.Loading ? (
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
        ))}
      <Transition
        appear
        show={authState === AuthState.Authenticated}
        leave="transition-all duration-200 ease-in absolute"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        {!isMobile ? (
          <div className="flex items-center justify-center gap-10 w-fit">
            <UserSettings />
            <DemoPanel />
          </div>
        ) : (
          <TabGroup
            onChange={(index) => setSelectedTabIndex(index)}
            selectedIndex={selectedTabIndex}
          >
            <TabPanels className="flex justify-center items-center">
              <TabPanel className="w-[95%]">
                <UserSettings />
              </TabPanel>
              <TabPanel className="w-[95%]">
                <DemoPanel />
              </TabPanel>
            </TabPanels>
            <TabList className="backdrop-blur flex border-t border-t-icon-background-light dark:border-t-icon-background-dark items-center justify-evenly absolute bottom-0 h-16 w-full z-20">
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
      </Transition>
    </div>
  );
}
