import Image from "next/image";
import styles from "./index.module.css";
import { TurnkeyApiTypes } from "@turnkey/http";
import { IframeStamper } from "@turnkey/iframe-stamper";
import * as React from "react";
import { useEffect, useState } from "react";
import axios from "axios";
import { Export } from "@/components/Export";
import { WalletsTable } from "@/components/WalletsTable";

type TWallet = TurnkeyApiTypes["v1Wallet"];

export default function ExportPage() {
  const [wallets, setWallets] = useState<TWallet[]>([]);
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(
    null
  );
  const [iframeDisplay, setIframeDisplay] = useState<string>("none");
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  // Get wallets
  useEffect(() => {
    getWallets();
  }, []);

  // Get the organization's wallets
  const getWallets = async () => {
    const organizationId = process.env.NEXT_PUBLIC_ORGANIZATION_ID!;
    const res = await axios.post("/api/getWallets", { organizationId });

    setWallets(res.data.wallets);
  };

  // Export the selected wallet and set the iframe to be visible
  const exportWallet = async (walletId: string) => {
    if (iframeStamper === null) {
      throw new Error("cannot export wallet without an iframe");
    }

    const response = await axios.post("/api/exportWallet", {
      walletId: walletId,
      targetPublicKey: iframeStamper.publicKey(),
    });

    let injected = await iframeStamper.injectWalletExportBundle(
      response.data["exportBundle"]
    );
    if (injected !== true) {
      throw new Error("unexpected error while injecting export bundle");
    }

    setIframeDisplay("block");
  };

  return (
    <main className={styles.main}>
      <a
        href="https://www.turnkey.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/logo.svg"
          alt="Turnkey Logo"
          className={styles.turnkeyLogo}
          width={100}
          height={24}
          priority
        />
      </a>

      {!iframeStamper && <p>Loading...</p>}
      {iframeStamper && iframeStamper.publicKey() && (
        <WalletsTable wallets={wallets} setSelectedWallet={setSelectedWallet} />
      )}
      {selectedWallet && (
        <div className={styles.reveal}>
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
                You are responsible for the security of this private key and any
                assets associated with it, and Turnkey cannot help recover it on
                your behalf. Failure to properly secure your private key may
                result in total loss of the associated assets.
              </p>
            </li>
            <li>
              <p>
                Turnkey is not responsible for any other wallet you may use with
                this private key, and Turnkey does not represent that any other
                software or hardware will be compatible with or protect your
                private key.
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
          <div className={styles.reveal}>
            <button
              className={styles.revealButton}
              onClick={() => {
                exportWallet(selectedWallet);
              }}
            >
              Reveal
            </button>
          </div>
        </div>
      )}

      <Export
        setIframeStamper={setIframeStamper}
        iframeUrl={process.env.NEXT_PUBLIC_EXPORT_IFRAME_URL!}
        iframeDisplay={iframeDisplay}
        turnkeyBaseUrl={process.env.NEXT_PUBLIC_BASE_URL!}
      ></Export>
    </main>
  );
}
