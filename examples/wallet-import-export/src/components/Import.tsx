"use client";

import { IframeStamper } from "@turnkey/iframe-stamper";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

interface ImportProps {
  iframeUrl: string;
  turnkeyBaseUrl: string;
  iframeDisplay: string;
  setIframeStamper: Dispatch<SetStateAction<IframeStamper | null>>;
}

const styles = {
  padding: "20px",
  borderRadius: "8px",
  borderWidth: "2px",
  borderStyle: "solid",
  borderColor: "#ff6961",
  fontFamily: "monospace",
  color: "#333",
  width: "340px",
  height: "100px",
  backgroundColor: "#fff3f3",
  boxShadow: "0px 0px 10px #aaa",
  overflowWrap: "break-word",
  wordWrap: "break-word",
  resize: "none",
};

const iframeCss = `
  iframe {
    box-sizing: border-box;
    width: 400px;
    height: 180px;
    border: none;
  }
`;

const TurnkeyIframeContainerId = "turnkey-import-iframe-container-id";
const TurnkeyIframeElementId = "turnkey-import-iframe-element-id";

export function Import(props: ImportProps) {
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
      iframeStamper
        .init()
        .then(() => {
          setIframeStamper(iframeStamper);
          props.setIframeStamper(iframeStamper);
          return iframeStamper;
        })
        .then((iframeStamper: IframeStamper) => {
          return iframeStamper.applySettings({ styles });
        })
        .then((settingsApplied: boolean) => {
          if (settingsApplied !== true) {
            alert("Unexpected error while applying settings.");
            return;
          }
        });
    }

    return () => {
      if (iframeStamper) {
        iframeStamper.clear();
        setIframeStamper(null);
      }
    };
  }, [props.setIframeStamper, iframeStamper, setIframeStamper]);

  return (
    <div style={{ display: iframeDisplay }} id={TurnkeyIframeContainerId}>
      <style>{iframeCss}</style>
    </div>
  );
}
