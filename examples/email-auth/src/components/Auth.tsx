"use client";

import { IframeStamper } from "@turnkey/iframe-stamper";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

interface AuthProps {
  iframeUrl: string;
  turnkeyBaseUrl: string;
  setIframeStamper: Dispatch<SetStateAction<IframeStamper | null>>;
}

const TurnkeyIframeContainerId = "turnkey-iframe-container-id";
const TurnkeyIframeElementId = "turnkey-iframe-element-id";

export function Auth(props: AuthProps) {
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(
    null
  );

  useEffect(() => {
    try {
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
    } catch (error) {
      console.error('Error initializing iframe stamper:', error);
    }
  }, [props, iframeStamper, setIframeStamper]);

  return <div style={{ display: "none" }} id={TurnkeyIframeContainerId}></div>;
}
