"use client";

import { useTurnkey } from "@turnkey/sdk-react";
import { useEffect, useState } from "react";

const TurnkeyIframeContainerId = "turnkey-import-iframe-container-id";

interface ImportProps {
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

export function Import(props: ImportProps) {
  const { importIframeClient } = useTurnkey();
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

  if (importIframeClient) {
    useEffect(() => {
      (async () => {
        const injected = await importIframeClient!.init();
        console.log("injected", injected);

        const settingsApplied = await importIframeClient!.applySettings({
          styles,
        });
        if (!settingsApplied) {
          alert("Unexpected error while applying settings.");
          return;
        }
      })();
    }, []);
  }

  return (
    <div
      id={TurnkeyIframeContainerId}
      style={{ display: iframeDisplay }}
    >
      <style>{iframeCss}</style>
    </div>
  );
}
