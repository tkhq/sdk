"use client";

import axios from "axios";
import { SetStateAction, useState, useEffect } from "react";

import styles from "../pages/index.module.css";
import { IframeStamper } from "@turnkey/iframe-stamper";
import { Import } from "@/components/Import";

type ImportWalletProps = {
  organizationId: string;
  userId: string;
  getWallets: () => void;
};

export function ImportWallet(props: ImportWalletProps) {
  const [iframeDisplay, setIframeDisplay] = useState("none");
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(
    null
  );
  const [walletName, setWalletName] = useState("");
  const [stage, setStage] = useState("init");

  // Handler function to update the state based on input changes
  const handleWalletNameChange = (event: {
    target: { value: SetStateAction<string> };
  }) => {
    setWalletName(event.target.value);
  };

  // Init import the wallet
  const initImportWallet = async () => {
    if (iframeStamper === null) {
      alert("Cannot init import wallet without an iframe.");
      return;
    }

    const response = await axios.post("/api/initImportWallet", {
      userId: props.userId,
    });

    const injected = await iframeStamper.injectImportBundle(
      response.data["importBundle"],
      props.organizationId,
      props.userId
    );
    if (injected !== true) {
      alert("Unexpected error while injecting import bundle.");
      return;
    }

    setStage("import");
    setIframeDisplay("block");
  };

  // Import the wallet
  const importWallet = async () => {
    if (walletName.trim() === "") {
      alert("Wallet name is required.");
      return;
    }

    if (iframeStamper === null) {
      alert("Cannot import wallet without an iframe.");
      return;
    }

    const encryptedBundle = await iframeStamper.extractWalletEncryptedBundle();

    if (encryptedBundle.trim() === "") {
      alert("Encrypted bundle is empty.");
      return;
    }

    const response = await axios.post("/api/importWallet", {
      userId: props.userId,
      walletName,
      encryptedBundle,
    });

    // Get wallets again
    if (response) {
      props.getWallets();

      setStage("success");
      setIframeDisplay("none");
    } else {
      alert("Failed to import wallet! Please try again.");
    }
  };

  return (
    <div className={styles.modalInner}>
      <div className={styles.modalDetails}>
        <h2>Enter Secret Recovery Phrase</h2>
        {(stage === "init" || stage === "import") && (
          <div className={styles.modalSpace}>
            <p>
              Import an existing wallet with your secret recovery phrase. Only
              you should know your secret recovery phrase. A secret recovery
              phrase can be 12, 15, 18, 21, or 24 words.
            </p>
          </div>
        )}
        {stage === "import" && (
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
          {stage === "init" ? (
            <button
              className={styles.longModalButton}
              onClick={() => initImportWallet()}
            >
              Establish secure channel
            </button>
          ) : stage === "import" ? (
            <button
              className={styles.modalButton}
              onClick={() => importWallet()}
            >
              Import
            </button>
          ) : stage === "success" ? (
            <div className={styles.modalSpace}>
              <p>
                Successfully imported wallet <b>{walletName}</b>! Close this
                modal to view or export this new wallet.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
