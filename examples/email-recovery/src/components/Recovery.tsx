"use client";

import { IframeStamper } from "@turnkey/iframe-stamper";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

interface RecoveryProps {
  iframeUrl: string;
  turnkeyBaseUrl: string;
  setIframeStamper: Dispatch<SetStateAction<IframeStamper | null>>;
}

const TurnkeyIframeContainerId = "turnkey-iframe-container-id";
const TurnkeyIframeElementId = "turnkey-iframe-element-id";

export function Recovery(props: RecoveryProps) {
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(
    null
  );

  useEffect(() => {
    if (iframeStamper === null) {
      const iframeStamper = new IframeStamper({
        iframeUrl: props.iframeUrl,
        iframeContainerId: TurnkeyIframeContainerId,
        iframeElementId: TurnkeyIframeElementId,
      });
      iframeStamper.init().then(function () {
        setIframeStamper(iframeStamper);
        props.setIframeStamper(iframeStamper);
      });
    }

    return () => {
      if (iframeStamper !== null) {
        iframeStamper.clear();
        setIframeStamper(null);
      }
    };
  }, [props, iframeStamper, setIframeStamper]);

  return <div style={{ display: "none" }} id={TurnkeyIframeContainerId}></div>;
}
