"use client";

import { IframeStamper } from "@turnkey/iframe-stamper";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

interface ExportProps {
  iframeUrl: string;
  turnkeyBaseUrl: string;
  iframeDisplay: string;
  setIframeStamper: Dispatch<SetStateAction<IframeStamper | null>>;
}

const TurnkeyIframeContainerId = "turnkey-iframe-container-id";
const TurnkeyIframeElementId = "turnkey-iframe-element-id";

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
    try {
      if (!iframeStamper) {
        const iframeContainer = document.getElementById(TurnkeyIframeContainerId);
        if (!iframeContainer) {
          console.error(`Cannot create iframe stamper: no container with ID ${TurnkeyIframeContainerId} exists`);
          return;
        }
        const iframeStamper = new IframeStamper({
          iframeUrl: props.iframeUrl,
          iframeContainer,
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
  }, [props.setIframeStamper, iframeStamper, setIframeStamper]);

  const iframeCss = `
    iframe {
      width: 400px;
      height: 340px;
      border: none;
    }
    `;

  return (
    <div style={{ display: iframeDisplay }} id={TurnkeyIframeContainerId}>
      <style>{iframeCss}</style>
    </div>
  );
}
