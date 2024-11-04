"use client";

import axios from "axios";
import { SetStateAction, useEffect, useState } from "react";
import { useTurnkey } from "@turnkey/sdk-react";

import styles from "../pages/index.module.css";
import { Import } from "@/components/Import";

type ImportWalletProps = {
  organizationId: string;
  userId: string;
  getWallets: () => void;
};

export function ImportWallet(props: ImportWalletProps) {
  const { importIframeClient } = useTurnkey();
  const [walletName, setWalletName] = useState("");
  const [stage, setStage] = useState("init");
  const [iframeDisplay, setIframeDisplay] = useState("none");

  // TODO: check if this is necessary
  useEffect(() => {
    setIframeDisplay("none");
  }, []);

  // Handler function to update the state based on input changes
  const handleWalletNameChange = (event: {
    target: { value: SetStateAction<string> };
  }) => {
    setWalletName(event.target.value);
  };

  // Init import the wallet
  const initImportWallet = async () => {
    const response = await axios.post("/api/initImportWallet", {
      userId: props.userId,
    });

    const injected = await importIframeClient!.injectImportBundle(
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

    const encryptedBundle =
      await importIframeClient!.extractWalletEncryptedBundle();

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
        <Import iframeDisplay={iframeDisplay} />
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
