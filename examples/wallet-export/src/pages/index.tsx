import Image from "next/image";
import styles from "./index.module.css";
import { TurnkeyApiTypes } from "@turnkey/http";
import { IframeStamper } from "@turnkey/iframe-stamper";
import * as React from "react";
import { useEffect, useState } from "react";
import axios from "axios";
import { WalletsTable } from "@/components/WalletsTable";

type TWallet = TurnkeyApiTypes["v1Wallet"];

const TurnkeyIframeContainerId = "turnkey-iframe-container-id";
const TurnkeyIframeElementId = "turnkey-iframe-element-id";

export default function ExportPage() {
  const [wallets, setWallets] = useState<TWallet[]>([]);
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(
    null
  );
  const [showWallet, setShowWallet] = useState<boolean>(false);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  // Initialize the iframeStamper
  useEffect(() => {
    if (!iframeStamper) {
      const iframeStamper = new IframeStamper({
        iframeUrl: process.env.NEXT_PUBLIC_EXPORT_IFRAME_URL!,
        iframeContainerId: TurnkeyIframeContainerId,
        iframeElementId: TurnkeyIframeElementId,
      });
      iframeStamper.init().then(() => {
        setIframeStamper(iframeStamper);
      });
    }

    return () => {
      if (iframeStamper) {
        iframeStamper.clear();
        setIframeStamper(null);
      }
    };
  }, [iframeStamper]);

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

    setShowWallet(true);
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
        <div className={styles.copyKey}>
          <h2>Wallet seedphrase</h2>
          <p>
            You are about to reveal your wallet seedphrase. By revealing this
            seedphrase you understand that:
          </p>
          <ul>
            <li>
              <p>Your seedphrase is the only way to recover your funds.</p>
            </li>
            <li>
              <p>Do not let anyone see your seedphrase.</p>
            </li>
            <li>
              <p>Never share your seedphrase with anyone, including Turnkey.</p>
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
      <div
        style={{ display: showWallet ? "block" : "none" }}
        id={TurnkeyIframeContainerId}
        className={styles.walletIframe}
      />
    </main>
  );
}
