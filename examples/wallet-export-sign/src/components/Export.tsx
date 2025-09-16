"use client";

import { IframeStamper, TransactionType } from "@turnkey/iframe-stamper";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

interface ExportProps {
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
  backgroundColor: "#ffd966",
  boxShadow: "0px 0px 10px #aaa",
  overflowWrap: "break-word" as "break-word",
  // wordWrap removed to fix type error
  resize: "none" as const,
};

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

const TurnkeyIframeContainerId = "turnkey-export-and-sign-iframe-container-id";
const TurnkeyIframeElementId = "turnkey-export-and-sign-iframe-element-id";

export function Export(props: ExportProps) {
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(
    null
  );
  const [iframeDisplay, setIframeDisplay] = useState<string>("none");

  // New state: message to sign and returned signature
  const [message, setMessage] = useState<string>("Hello, Turnkey!");
  const [signature, setSignature] = useState<string>("");

  // New state: transaction serialized input and returned signed transaction
  const [txSerialized, setTxSerialized] = useState<string>("");
  const [txSigned, setTxSigned] = useState<string>("");

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

  const signMessage = () => {
    if (iframeStamper === null) {
      alert("Cannot sign message without an iframe.");
      return;
    }

    // Use the message state and store the returned signature
    iframeStamper
      .signMessage({ message })
      .then((sig: string) => {
        setSignature(sig);
        console.log("Message signature:", sig);
      })
      .catch((error: Error) => {
        console.error("Error signing message:", error);
        alert("Error signing message: " + error.message);
      });
  };

  const signTransaction = () => {
    if (iframeStamper === null) {
      alert("Cannot sign transaction without an iframe.");
      return;
    }

    if (!txSerialized || txSerialized.trim() === "") {
      alert("Please provide a serialized transaction (base64).");
      return;
    }

    // Attempt to sign the serialized (base64) versioned Solana transaction.
    // The IframeStamper API is expected to provide a signTransaction method that
    // accepts { serializedTransaction: string } and returns the signed transaction (base64).
    iframeStamper
      .signTransaction({ transaction: txSerialized, type: TransactionType.Solana })
      .then((signed: string) => {
        setTxSigned(signed);
        console.log("Signed transaction (base64):", signed);
      })
      .catch((error: Error) => {
        console.error("Error signing transaction:", error);
        alert("Error signing transaction: " + error.message);
      });
  };

  // --- Changed rendering: keep iframe container mounted (so iframeStamper can initialize),
  //     but only show the message/transaction UI after iframeDisplay === "block" (i.e. after reveal).
  return (
    <div>
      <div
        style={{ display: iframeDisplay }}
        id={TurnkeyIframeContainerId}
      >
        <style>{iframeCss}</style>
      </div>

      {iframeDisplay === "block" ? (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8, maxWidth: 420 }}>
          <label style={{ fontSize: 13 }}>Message to sign</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ width: "400px", height: "80px", padding: 8, fontFamily: "monospace" }}
          />

          <div>
            <button
              onClick={() => {
                signMessage();
              }}
              style={{ padding: "8px 12px", cursor: "pointer" }}
            >
              Sign message
            </button>
          </div>

          {signature ? (
            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: 13 }}>Signature</label>
              <div style={{ ...styles, width: "100%", height: "auto", whiteSpace: "pre-wrap", marginTop: 8 }}>
                {signature}
              </div>
            </div>
          ) : null}

          {/* Transaction signing section */}
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 13 }}>Serialized Solana Versioned Transaction (base64)</label>
            <textarea
              value={txSerialized}
              onChange={(e) => setTxSerialized(e.target.value)}
              placeholder="Paste base64 serialized versioned transaction here"
              style={{ width: "400px", height: "120px", padding: 8, fontFamily: "monospace", marginTop: 8 }}
            />

            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => {
                  signTransaction();
                }}
                style={{ padding: "8px 12px", cursor: "pointer" }}
              >
                Sign transaction
              </button>
            </div>

            {txSigned ? (
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 13 }}>Signed transaction (base64)</label>
                <div style={{ ...styles, width: "100%", height: "auto", whiteSpace: "pre-wrap", marginTop: 8 }}>
                  {txSigned}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
