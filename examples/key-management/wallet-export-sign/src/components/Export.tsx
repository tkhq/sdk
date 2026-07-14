"use client";

import {
  IframeStamper,
  TransactionType,
  MessageType,
} from "@turnkey/iframe-stamper";
import type { TurnkeyApiTypes } from "@turnkey/sdk-server";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import styles from "./Export.module.css";

interface ExportProps {
  iframeUrl: string;
  turnkeyBaseUrl: string;
  iframeDisplay: string;
  setIframeStamper: Dispatch<SetStateAction<IframeStamper | null>>;
  showSigning?: boolean; // Only show signing UI for wallet accounts, not wallets
  walletAccountAddress?: string; // Address of the wallet account being exported
  addressFormat?: TurnkeyApiTypes["v1AddressFormat"]; // e.g. ADDRESS_FORMAT_SOLANA / ADDRESS_FORMAT_ETHEREUM
}

const iframeCss = `
  iframe {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    height: 140px;
    border-radius: 12px;
    border-width: 1px;
    border-style: solid;
    border-color: #e5e7eb;
    padding: 20px;
    background: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    margin-bottom: 0;
  }

  @media (min-width: 768px) {
    iframe {
      padding: 24px;
    }
  }
`;

const TurnkeyIframeContainerId = "turnkey-export-and-sign-iframe-container-id";
const TurnkeyIframeElementId = "turnkey-export-and-sign-iframe-element-id";

export function Export(props: ExportProps) {
  // Turnkey reuses ADDRESS_FORMAT_ETHEREUM (secp256k1) for all EVM chains.
  const isEthereum = props.addressFormat === "ADDRESS_FORMAT_ETHEREUM";

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

    // At this point, we're relying on having the decrypted private key in-memory within the iframe for signing
    try {
      const signedMessage = await iframeStamper.signMessage(
        {
          message,
          type: isEthereum ? MessageType.Ethereum : MessageType.Solana,
        },
        props.walletAccountAddress,
      );
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

    if (!txSerialized || txSerialized.trim() === "") {
      alert(`Please provide a ${isEthereum ? "EVM" : "Solana"} transaction.`);
      return;
    }

    // At this point, we're relying on having the decrypted private key in-memory within the iframe for signing
    try {
      const signedTransaction = await iframeStamper.signTransaction(
        {
          transaction: txSerialized,
          type: isEthereum ? TransactionType.Ethereum : TransactionType.Solana,
        },
        props.walletAccountAddress,
      );

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
      <div
        className={styles.iframeContainer}
        style={{ display: iframeDisplay }}
        id={TurnkeyIframeContainerId}
      >
        <style>{iframeCss}</style>
      </div>

      {iframeDisplay === "block" && props.showSigning ? (
        <div className={styles.container}>
          {/* Message signing */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Sign arbitrary message</h3>
              <span className={styles.cardSubtitle}>
                {isEthereum ? "secp256k1 · EIP-191" : "ed25519"}
              </span>
            </div>

            <div className={styles.cardBody}>
              <textarea
                className={styles.textarea}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />

              <div className={styles.buttonGroup}>
                <button
                  className={`${styles.button} ${styles.buttonPrimary}`}
                  onClick={signMessage}
                  disabled={!iframeStamper}
                >
                  Sign message
                </button>

                <button
                  className={styles.button}
                  onClick={() => {
                    setMessage("");
                    setSignature("");
                  }}
                >
                  Clear
                </button>
              </div>

              {signature ? (
                <div className={styles.outputSection}>
                  <div className={styles.outputLabel}>Signature (hex)</div>
                  <div className={styles.monoBox}>{signature}</div>
                  <button
                    className={styles.copyButton}
                    onClick={() => copyToClipboard(signature)}
                  >
                    Copy signature
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {/* Transaction signing */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>
                Sign {isEthereum ? "Ethereum" : "Solana"} transaction
              </h3>
              <span className={styles.cardSubtitle}>
                {isEthereum ? "Serialized unsigned tx" : "Hex-encoded"}
              </span>
            </div>

            <div className={styles.cardBody}>
              <textarea
                className={styles.textarea}
                value={txSerialized}
                onChange={(e) => setTxSerialized(e.target.value)}
                placeholder={
                  isEthereum
                    ? "Paste 0x-prefixed serialized unsigned EVM transaction here"
                    : "Paste hex-encoded transaction here"
                }
                style={{ minHeight: "120px" }}
              />

              <div className={styles.buttonGroup}>
                <button
                  className={`${styles.button} ${styles.buttonPrimary}`}
                  onClick={signTransaction}
                  disabled={!iframeStamper}
                >
                  Sign transaction
                </button>

                <button
                  className={styles.button}
                  onClick={() => {
                    setTxSerialized("");
                    setTxSigned("");
                  }}
                >
                  Clear
                </button>
              </div>

              {txSigned ? (
                <div className={styles.outputSection}>
                  <div className={styles.outputLabel}>
                    Signed transaction (hex)
                  </div>
                  <div className={styles.monoBox}>{txSigned}</div>
                  <button
                    className={styles.copyButton}
                    onClick={() => copyToClipboard(txSigned)}
                  >
                    Copy signed tx
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
