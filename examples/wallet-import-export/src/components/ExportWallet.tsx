"use client";

import axios from "axios";
import { useEffect, useState } from "react";
import { useTurnkey } from "@turnkey/sdk-react";

import styles from "../pages/index.module.css";
import { Export } from "@/components/Export";

type ExportWalletProps = {
  organizationId: string;
  walletId: string;
};

export function ExportWallet(props: ExportWalletProps) {
  const { exportIframeClient } = useTurnkey();
  const [stage, setStage] = useState("export");

  // Export the selected wallet and set the iframe to be visible
  const exportWallet = async () => {
    const response = await axios.post("/api/exportWallet", {
      walletId: props.walletId,
      targetPublicKey: exportIframeClient!.iframePublicKey,
    });

    let injected = await exportIframeClient!.injectWalletExportBundle(
      response.data["exportBundle"],
      props.organizationId
    );
    if (injected !== true) {
      alert("Unexpected error while injecting export bundle.");
      return;
    }

    setStage("success");
  };

  return (
    <div className={styles.modalInner}>
      <div className={styles.modalDetails}>
        {stage === "export" && (
          <div>
            <h2>Before you continue</h2>
            <p>By revealing the private key, you understand and agree that:</p>
            <ul>
              <li>
                <p>
                  You should never share your private key with anyone, including
                  the Turnkey team. Turnkey will never ask you for your private
                  key.
                </p>
              </li>
              <li>
                <p>
                  You are responsible for the security of this private key and
                  any assets associated with it, and Turnkey cannot help recover
                  it on your behalf. Failure to properly secure your private key
                  may result in total loss of the associated assets.
                </p>
              </li>
              <li>
                <p>
                  Turnkey is not responsible for any other wallet you may use
                  with this private key, and Turnkey does not represent that any
                  other software or hardware will be compatible with or protect
                  your private key.
                </p>
              </li>
              <li>
                <p>
                  You have read and agree to{" "}
                  <a href="https://www.turnkey.com/files/terms-of-service.pdf">
                    Turnkey{"'"}s Terms of Service
                  </a>
                  , including the risks related to exporting your private key
                  disclosed therein.
                </p>
              </li>
            </ul>
            <div className={styles.modalSpace}>
              <button
                className={styles.modalButton}
                onClick={() => {
                  exportWallet();
                }}
              >
                Reveal
              </button>
            </div>
          </div>
        )}
        <Export />
      </div>
    </div>
  );
}
