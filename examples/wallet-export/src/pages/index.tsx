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

      <Export
        setIframeStamper={setIframeStamper}
        iframeUrl={process.env.NEXT_PUBLIC_EXPORT_IFRAME_URL!}
        iframeDisplay={iframeDisplay}
        turnkeyBaseUrl={process.env.NEXT_PUBLIC_BASE_URL!}
      ></Export>
    </main>
  );
}
