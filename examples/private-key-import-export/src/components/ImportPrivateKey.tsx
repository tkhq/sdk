"use client";

import axios from "axios";
import { SetStateAction, useState } from "react";

import styles from "../pages/index.module.css";
import { IframeStamper, KeyFormat } from "@turnkey/iframe-stamper";
import { Import } from "@/components/Import";

type ImportPrivateKeyProps = {
  userId: string;
  getPrivateKeys: () => void;
};

export function ImportPrivateKey(props: ImportPrivateKeyProps) {
  const [iframeDisplay, setIframeDisplay] = useState("none");
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(
    null
  );
  const [privateKeytName, setPrivateKeyName] = useState("");
  const [stage, setStage] = useState("init");

  // Handler function to update the state based on input changes
  const handlePrivateKeyNameChange = (event: {
    target: { value: SetStateAction<string> };
  }) => {
    setPrivateKeyName(event.target.value);
  };

  // Init import the private key
  const initImportPrivateKey = async () => {
    if (iframeStamper === null) {
      alert("Cannot init import private key without an iframe.");
      return;
    }

    const response = await axios.post("/api/initImportPrivateKey", {
      userId: props.userId,
    });

    const injected = await iframeStamper.injectImportBundle(
      response.data["importBundle"]
    );
    if (injected !== true) {
      alert("Unexpected error while injecting import bundle.");
      return;
    }

    setStage("import");
    setIframeDisplay("block");
  };

  // Import the private key
  const importPrivateKey = async () => {
    if (privateKeytName.trim() === "") {
      alert("Private key name is required.");
      return;
    }

    if (iframeStamper === null) {
      alert("Cannot import private key without an iframe.");
      return;
    }

    const encryptedBundle = await iframeStamper.extractKeyEncryptedBundle(KeyFormat.Hexadecimal);

    if (encryptedBundle.trim() === "") {
      alert("Encrypted bundle is empty.");
      return;
    }

    const response = await axios.post("/api/importPrivateKey", {
      userId: props.userId,
      privateKeyname: privateKeytName,
      encryptedBundle,
      // curve: "CURVE_ED25519",
      // address_formats: ["ADDRESS_FORMAT_SOLANA"]
      curve: "CURVE_SECP256K1",
      address_formats: ["ADDRESS_FORMAT_ETHEREUM"]
    });

    // Get private keys again
    if (response) {
      props.getPrivateKeys();

      setStage("success");
      setIframeDisplay("none");
    } else {
      alert("Failed to import private key! Please try again.");
    }
  };

  return (
    <div className={styles.modalInner}>
      <div className={styles.modalDetails}>
        <h2>Enter Secret Recovery Phrase</h2>
        {(stage === "init" || stage === "import") && (
          <div className={styles.modalSpace}>
            <p>
              Import an existing private key. Currently just Eth.
            </p>
          </div>
        )}
        {stage === "import" && (
          <div className={styles.name}>
            <label className={styles.label}>
              Private Key Name
              <input
                className={styles.input}
                type="text"
                value={privateKeytName}
                onChange={handlePrivateKeyNameChange}
                placeholder="Name your private key (required)"
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
              onClick={() => initImportPrivateKey()}
            >
              Establish secure channel
            </button>
          ) : stage === "import" ? (
            <button
              className={styles.modalButton}
              onClick={() => importPrivateKey()}
            >
              Import
            </button>
          ) : stage === "success" ? (
            <div className={styles.modalSpace}>
              <p>
                Successfully imported private key <b>{privateKeytName}</b>! Close this
                modal to view or export this new private key.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
