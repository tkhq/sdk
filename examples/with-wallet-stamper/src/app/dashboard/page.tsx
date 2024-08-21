"use client";

import User from "@/components/user";
import Image from "next/image";

import { IframeStamper } from "@turnkey/iframe-stamper";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

const TurnkeyIframeContainerId = "turnkey-iframe-container-id";
const TurnkeyIframeElementId = "turnkey-iframe-element-id";

interface AuthProps {
  // iframeStamper: IframeStamper | null;
  iframeUrl: string;
  turnkeyBaseUrl: string;
  setIframeStamper: Dispatch<SetStateAction<IframeStamper | null>>;
}

export function Auth(props: AuthProps) {
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(
    null
  );

  console.log({
    iframeStamper,
  });

  useEffect(() => {
    if (!iframeStamper) {
      const iframeStamper = new IframeStamper({
        iframeUrl: props.iframeUrl,
        iframeContainer: document.getElementById(TurnkeyIframeContainerId),
        iframeElementId: TurnkeyIframeElementId,
      });
      iframeStamper.init().then(() => {
        setIframeStamper(iframeStamper);
        props.setIframeStamper(iframeStamper);
      });
    }

    return () => {
      if (iframeStamper) {
        iframeStamper.clear();
        setIframeStamper(null);
      }
    };
  }, [props, iframeStamper, setIframeStamper]);

  return (
    <div
      style={{ display: "none" }}
      id={TurnkeyIframeContainerId}
    ></div>
  );
}

export default function Dashboard() {
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(
    null
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          Wallet Stamper Demo
        </p>
        <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center bg-gradient-to-t from-white via-white dark:from-black dark:via-black lg:static lg:size-auto lg:bg-none">
          <a
            className="pointer-events-none flex place-items-center gap-2 p-8 lg:pointer-events-auto lg:p-0"
            href="https://www.turnkey.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            By{" "}
            <Image
              src="/turnkey.svg"
              alt="Turnkey Logo"
              className="dark:invert"
              width={100}
              height={24}
              priority
            />
          </a>
        </div>
      </div>

      <div className="relative z-[-1] flex place-items-center before:absolute before:h-[300px] before:w-full before:-translate-x-1/2 before:rounded-full before:bg-gradient-radial before:from-white before:to-transparent before:blur-2xl before:content-[''] after:absolute after:-z-20 after:h-[180px] after:w-full after:translate-x-1/3 after:bg-gradient-conic after:from-sky-200 after:via-blue-200 after:blur-2xl after:content-[''] before:dark:bg-gradient-to-br before:dark:from-transparent before:dark:to-blue-700 before:dark:opacity-10 after:dark:from-sky-900 after:dark:via-[#0141ff] after:dark:opacity-40 sm:before:w-[480px] sm:after:w-[240px] before:lg:h-[360px]"></div>

      <div className="flex flex-col items-center justify-center mb-auto mt-52 w-full">
        <Auth
          // iframeStamper={iframeStamper}
          setIframeStamper={setIframeStamper}
          iframeUrl={process.env.NEXT_PUBLIC_IFRAME_URL!}
          turnkeyBaseUrl={process.env.NEXT_PUBLIC_BASE_URL!}
        ></Auth>

        <User />
      </div>
    </main>
  );
}
