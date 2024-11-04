"use client";

import { useTurnkey } from "@turnkey/sdk-react";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

const TurnkeyIframeContainerId = "turnkey-export-iframe-container-id";

interface ExportProps {
  iframeDisplay: string;
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
  backgroundColor: "#ffd966",
  boxShadow: "0px 0px 10px #aaa",
  overflowWrap: "break-word",
  wordWrap: "break-word",
  resize: "none",
};

export function Export(props: ExportProps) {
  const { exportIframeClient } = useTurnkey();
  const [iframeDisplay, setIframeDisplay] = useState<string>("none");

  useEffect(() => {
    console.log("iframe display", iframeDisplay);
    console.log("props iframe display", props.iframeDisplay);

    setIframeDisplay(props.iframeDisplay);
    return () => {
      if (iframeDisplay === "block") {
        setIframeDisplay("none");
      }
    };
  }, [props.iframeDisplay]);

  if (exportIframeClient) {
    useEffect(() => {
      (async () => {
        const settingsApplied = await exportIframeClient!.applySettings({
          styles,
        });
        if (!settingsApplied) {
          alert("Unexpected error while applying settings.");
          return;
        }
      })();
    }, []);
  }

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
    <div
      id={TurnkeyIframeContainerId}
      style={{ display: iframeDisplay }}
    >
      <style>{iframeCss}</style>
    </div>
  );
}
