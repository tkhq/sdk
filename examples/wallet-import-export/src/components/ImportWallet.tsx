"use client";

import axios from "axios";
import { useState } from "react";

import styles from "../pages/index.module.css";
import { IframeStamper } from "@turnkey/iframe-stamper";
import { Import } from "@/components/Import";

type ImportWalletProps = {
  userId: string;
  getWallets: () => void;
};

export function ImportWallet(props: ImportWalletProps) {
  const [iframeDisplay, setIframeDisplay] = useState("none");
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(
    null
  );

  // Init import the wallet
  const initImportWallet = async () => {
    if (iframeStamper === null) {
      throw new Error("cannot init import wallet without an iframe");
    }

    const response = await axios.post("/api/initImportWallet", {
      userId: props.userId,
    });

    const injected = await iframeStamper.injectImportBundle(
      response.data["importBundle"]
    );
    if (injected !== true) {
      throw new Error("unexpected error while injecting import bundle");
    }

    setIframeDisplay("block");
  };

  // Import the wallet
  const importWallet = async () => {
    if (iframeStamper === null) {
      throw new Error("cannot import wallet without an iframe");
    }

    const encryptedBundle = await iframeStamper.extractWalletEncryptedBundle();

    const response = await axios.post("/api/importWallet", {
      userId: props.userId,
      walletName: "wallet " + Math.floor(Math.random() *  (100 - 1) + 1),
      encryptedBundle,
    });

    // Get wallets again
    if (response) {
      props.getWallets();

      setIframeDisplay("none");
    } else {
      throw new Error("failed to import wallet");
    }
  };

  return (
    <div className={styles.modalInner}>
      <div className={styles.modalDetails}>
        <h2>Enter Secret Recovery Phrase</h2>
        <div className={styles.modalSpace}>
          <p>
            Import an existing wallet with your secret recovery phrase. Only you
            should know your secret recovery phrase. A secret recovery phrase
            can be 12, 15, 18, 21, or 24 words.
          </p>
        </div>
        <Import
          setIframeStamper={setIframeStamper}
          iframeDisplay={iframeDisplay}
          iframeUrl={process.env.NEXT_PUBLIC_IMPORT_IFRAME_URL!}
          turnkeyBaseUrl={process.env.NEXT_PUBLIC_BASE_URL!}
        />
        <div className={styles.modalSpace}>
          {iframeDisplay == "none" ? (
            <button
              className={styles.longModalButton}
              onClick={() => initImportWallet()}
            >
              Establish secure channel
            </button>
          ) : (
            <button
              className={styles.modalButton}
              onClick={() => importWallet()}
            >
              Import
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
