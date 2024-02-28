"use client";

import { IframeStamper } from "@turnkey/iframe-stamper";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

interface ExportProps {
  iframeUrl: string;
  turnkeyBaseUrl: string;
  iframeDisplay: string;
  setIframeStamper: Dispatch<SetStateAction<IframeStamper | null>>;
}

const TurnkeyIframeContainerId = "turnkey-export-iframe-container-id";
const TurnkeyIframeElementId = "turnkey-export-iframe-element-id";

export function Export(props: ExportProps) {
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(
    null
  );
  const [iframeDisplay, setIframeDisplay] = useState<string>("none");

  useEffect(() => {
    setIframeDisplay(props.iframeDisplay);
    return () => {
      if (iframeDisplay === "block") {
        setIframeDisplay("none");
      }
    };
  }, [props.iframeDisplay]);

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
  }, [props.setIframeStamper, iframeStamper, setIframeStamper]);

  const iframeCss = `
    iframe {
      box-sizing: border-box;
      width: 400px;
      height: 120px;
      border-radius: 8px;
      border-width: 1px;
      border-style: solid;
      border-color: rgba(216, 219, 227, 1);
      padding: 20px;
    }
    `;

  return (
    <div style={{ display: iframeDisplay }} id={TurnkeyIframeContainerId}>
      <style>{iframeCss}</style>
    </div>
  );
}
