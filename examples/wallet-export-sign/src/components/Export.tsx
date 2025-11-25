"use client";

import {
  IframeStamper,
  TransactionType,
  MessageType,
} from "@turnkey/iframe-stamper";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

interface ExportProps {
  iframeUrl: string;
  turnkeyBaseUrl: string;
  iframeDisplay: string;
  setIframeStamper: Dispatch<SetStateAction<IframeStamper | null>>;
  showSigning?: boolean; // Only show signing UI for wallet accounts, not wallets
}

const containerStyles: React.CSSProperties = {
  marginTop: 16,
  display: "flex",
  flexDirection: "column",
  gap: 16,
  width: "100%",
  maxWidth: "100%",
  fontFamily:
    "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
  maxHeight: "min(70vh, 600px)",
  overflowY: "auto",
  overflowX: "hidden",
  padding: "0",
  boxSizing: "border-box",
};

const cardStyles: React.CSSProperties = {
  padding: 16,
  borderRadius: 12,
  border: "1px solid rgba(216,219,227,1)",
  background: "#ffffff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  transition: "box-shadow 0.2s ease",
  width: "100%",
  boxSizing: "border-box",
  overflowX: "hidden",
};

const monoBox: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: 13,
  padding: 12,
  borderRadius: 8,
  background: "#f8f9fa",
  border: "1px solid #e0e3e7",
  wordBreak: "break-word",
  whiteSpace: "pre-wrap",
  color: "#2b2f33",
  maxHeight: "200px",
  overflowY: "auto",
};

const iframeCss = `
  iframe {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    height: 140px;
    border-radius: 12px;
    border-width: 1px;
    border-style: solid;
    border-color: rgba(216, 219, 227, 1);
    padding: 16px;
    background: white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    margin-bottom: 8px;
  }

  @media (min-width: 768px) {
    iframe {
      padding: 20px;
    }
  }
`;

const TurnkeyIframeContainerId = "turnkey-export-and-sign-iframe-container-id";
const TurnkeyIframeElementId = "turnkey-export-and-sign-iframe-element-id";

export function Export(props: ExportProps) {
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(
    null,
  );
  const [iframeDisplay, setIframeDisplay] = useState<string>("none");

  // message + signature
  const [message, setMessage] = useState<string>("Hello, Turnkey!");
  const [signature, setSignature] = useState<string>("");

  // transaction + signed transaction
  const [txSerialized, setTxSerialized] = useState<string>("");
  const [txSigned, setTxSigned] = useState<string>("");

  const [_initializing, setInitializing] = useState<boolean>(false);

  useEffect(() => {
    setIframeDisplay(props.iframeDisplay);
    return () => {
      if (iframeDisplay === "block") {
        setIframeDisplay("none");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.iframeDisplay]);

  useEffect(() => {
    if (!iframeStamper) {
      setInitializing(true);
      const stamper = new IframeStamper({
        iframeUrl: props.iframeUrl,
        iframeContainer: document.getElementById(TurnkeyIframeContainerId),
        iframeElementId: TurnkeyIframeElementId,
      });

      stamper
        .init()
        .then(() => {
          setIframeStamper(stamper);
          props.setIframeStamper(stamper);
          return stamper;
        })
        .then((s: IframeStamper) =>
          s.applySettings({ styles: { padding: "12px" } }),
        )
        .then(() => {
          setInitializing(false);
        })
        .catch((err) => {
          console.error("Iframe init error:", err);
          setInitializing(false);
        });
    }

    return () => {
      if (iframeStamper) {
        iframeStamper.clear();
        setIframeStamper(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.setIframeStamper, iframeStamper]);

  const signMessage = async () => {
    if (iframeStamper === null) {
      alert("Iframe not ready — reveal private key first.");
      return;
    }

    // Check to ensure there's an embedded key
    const existingKey = await iframeStamper.getEmbeddedPublicKey();
    if (!existingKey) {
      alert("Iframe not ready — embedded key not found.");
      return;
    }

    try {
      const signedMessage = await iframeStamper.signMessage({
        message,
        type: MessageType.Solana,
      });
      setSignature(signedMessage);
    } catch (error: any) {
      console.error("Error signing message:", error);
      alert("Error signing message: " + error.message);
    }
  };

  const signTransaction = async () => {
    if (iframeStamper === null) {
      alert("Iframe not ready — reveal private key first.");
      return;
    }

    // Check to ensure there's an embedded key
    const existingKey = await iframeStamper.getEmbeddedPublicKey();
    if (!existingKey) {
      alert("Iframe not ready — embedded key not found.");
      return;
    }

    if (!txSerialized || txSerialized.trim() === "") {
      alert("Please provide a Solana transaction.");
      return;
    }

    try {
      const signedTransaction = await iframeStamper.signTransaction({
        transaction: txSerialized,
        type: TransactionType.Solana,
      });

      setTxSigned(signedTransaction);
    } catch (error: any) {
      console.error("Error signing transaction:", error);
      alert("Error signing transaction: " + error.message);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // lightweight UX: brief visual confirmation could be added later
    } catch (e) {
      console.error("Copy failed", e);
      alert("Copy failed");
    }
  };

  // Only reveal signing UI after iframeDisplay === "block" (i.e. after Reveal)
  return (
    <div>
      {/* keep iframe mounted but visually controlled by parent */}
      <div style={{ display: iframeDisplay }} id={TurnkeyIframeContainerId}>
        <style>{iframeCss}</style>
      </div>

      {iframeDisplay === "block" && props.showSigning ? (
        <div style={containerStyles}>
          {/* Message signing */}
          <div style={cardStyles}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong>Sign arbitrary message</strong>
              <small style={{ color: "#666" }}>ed25519 signature</small>
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{
                width: "100%",
                height: 88,
                marginTop: 10,
                padding: 10,
                fontFamily: "monospace",
                fontSize: 13,
              }}
            />

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                onClick={signMessage}
                disabled={!iframeStamper}
                style={{
                  padding: "8px 12px",
                  cursor: iframeStamper ? "pointer" : "not-allowed",
                }}
              >
                Sign message
              </button>

              <button
                onClick={() => {
                  setMessage("");
                  setSignature("");
                }}
                style={{ padding: "8px 12px" }}
              >
                Clear
              </button>
            </div>

            {signature ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13, color: "#444" }}>
                  Signature (hex)
                </div>
                <div style={{ ...monoBox, marginTop: 8 }}>{signature}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => copyToClipboard(signature)}
                    style={{ padding: "6px 10px" }}
                  >
                    Copy signature
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Transaction signing */}
          <div style={cardStyles}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong>Sign Solana transaction</strong>
              <small style={{ color: "#666" }}>Hex-encoded transaction</small>
            </div>

            <textarea
              value={txSerialized}
              onChange={(e) => setTxSerialized(e.target.value)}
              placeholder="Paste hex-encoded transaction here"
              style={{
                width: "100%",
                height: 120,
                marginTop: 10,
                padding: 10,
                fontFamily: "monospace",
                fontSize: 13,
              }}
            />

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                onClick={signTransaction}
                disabled={!iframeStamper}
                style={{
                  padding: "8px 12px",
                  cursor: iframeStamper ? "pointer" : "not-allowed",
                }}
              >
                Sign transaction
              </button>

              <button
                onClick={() => {
                  setTxSerialized("");
                  setTxSigned("");
                }}
                style={{ padding: "8px 12px" }}
              >
                Clear
              </button>
            </div>

            {txSigned ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13, color: "#444" }}>
                  Signed transaction (hex)
                </div>
                <div style={{ ...monoBox, marginTop: 8 }}>{txSigned}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => copyToClipboard(txSigned)}
                    style={{ padding: "6px 10px" }}
                  >
                    Copy signed tx
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
