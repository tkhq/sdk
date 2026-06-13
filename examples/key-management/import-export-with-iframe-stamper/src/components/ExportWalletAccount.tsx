"use client";

import axios from "axios";
import { useEffect, useState } from "react";

import styles from "../pages/index.module.css";
import { IframeStamper } from "@turnkey/iframe-stamper";
import { Export } from "@/components/Export";

type ExportWalletAccountProps = {
  organizationId: string;
  walletAccountAddress: string;
};

export function ExportWalletAccount(props: ExportWalletAccountProps) {
  const [iframeDisplay, setIframeDisplay] = useState("none");
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(
    null,
  );
  const [stage, setStage] = useState("export");

  useEffect(() => {
    setIframeDisplay("none");
  }, []);

  // Export the selected wallet account and set the iframe to be visible
  const exportWalletAccount = async () => {
    if (iframeStamper === null) {
      alert("Cannot export wallet account without an iframe.");
      return;
    }

    const response = await axios.post("/api/exportWalletAccount", {
      walletAccountAddress: props.walletAccountAddress,
      targetPublicKey: iframeStamper.publicKey(),
    });

    let injected = await iframeStamper.injectKeyExportBundle(
      response.data["exportBundle"],
      props.organizationId,
    );
    if (injected !== true) {
      alert("Unexpected error while injecting export bundle.");
      return;
    }

    setStage("success");
    setIframeDisplay("block");
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
                  exportWalletAccount();
                }}
              >
                Reveal
              </button>
            </div>
          </div>
        )}
        <Export
          setIframeStamper={setIframeStamper}
          iframeDisplay={iframeDisplay}
          iframeUrl={process.env.NEXT_PUBLIC_EXPORT_IFRAME_URL!}
          turnkeyBaseUrl={process.env.NEXT_PUBLIC_BASE_URL!}
        />
      </div>
    </div>
  );
}
