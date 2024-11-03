"use client";

import { useTurnkey } from "@turnkey/sdk-react";
import { useEffect } from "react";

const TurnkeyIframeContainerId = "turnkey-import-iframe-container-id";

export function Import() {
  const { importIframeClient } = useTurnkey();

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

  if (importIframeClient) {
    useEffect(() => {
      (async () => {
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

  const iframeCss = `
    iframe {
      box-sizing: border-box;
      width: 400px;
      height: 180px;
      border: none;
    }
    `;

  return (
    <div
      id={TurnkeyIframeContainerId}
      style={{ display: "block" }}
    >
      <style>{iframeCss}</style>
    </div>
  );
}
