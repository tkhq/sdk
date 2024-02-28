"use client";

import axios from "axios";
import { SetStateAction, useState } from "react";

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
  const [walletName, setWalletName] = useState("");

  // Handler function to update the state based on input changes
  const handleWalletNameChange = (event: {
    target: { value: SetStateAction<string> };
  }) => {
    setWalletName(event.target.value);
  };

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
    if (walletName.trim() === "") {
      throw new Error("wallet name is required");
    }

    if (iframeStamper === null) {
      throw new Error("cannot import wallet without an iframe");
    }

    const encryptedBundle = await iframeStamper.extractWalletEncryptedBundle();

    if (encryptedBundle.trim() === "") {
      throw new Error("encrypted bundle is empty");
    }

    const response = await axios.post("/api/importWallet", {
      userId: props.userId,
      walletName,
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
        {iframeDisplay != "none" && (
          <div className={styles.name}>
            <label className={styles.label}>
              Wallet Name
              <input
                className={styles.input}
                type="text"
                value={walletName}
                onChange={handleWalletNameChange}
                placeholder="Name your wallet (required)"
              />
            </label>
          </div>
        )}
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
