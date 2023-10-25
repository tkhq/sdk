import Image from "next/image";
import styles from "./index.module.css";
import { TurnkeyApiTypes } from "@turnkey/http";
import { IframeStamper } from "@turnkey/iframe-stamper";
import * as React from "react";
import { useEffect, useState } from "react";
import axios from "axios";

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

  useEffect(() => {
    const instantiateIframeStamper = async () => {
      const stamper = new IframeStamper({
        iframeUrl: process.env.NEXT_PUBLIC_EXPORT_IFRAME_URL!,
        iframeContainerId: TurnkeyIframeContainerId,
        iframeElementId: TurnkeyIframeElementId,
        iframeStyle: "border: none; width: 600px; height: 600px;",
      });

      await stamper.init();
      setIframeStamper(stamper);
    };

    if (!iframeStamper) {
      instantiateIframeStamper();
    }

    return () => {
      iframeStamper?.clear();
    };
  }, [iframeStamper]);

  useEffect(() => {
    getWallets();
  }, []);

  const getWallets = async () => {
    const organizationId = process.env.NEXT_PUBLIC_ORGANIZATION_ID!;
    const res = await axios.post("/api/getWallets", { organizationId });

    setWallets(res.data.wallets);
  };

  const ExportIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
      <path
        d="M12 2L12 16M12 16L16 12M12 16L8 12M2 20H22"
        stroke="#3f464b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const WalletsTable = (
    <div>
      <table className={styles.table}>
        <thead className={styles.tableHeader}>
          <tr>
            <th className={styles.tableHeaderCell}></th>
            <th className={styles.tableHeaderCell}>Wallet name</th>
            <th className={styles.tableHeaderCell}>Wallet ID</th>
          </tr>
        </thead>
        <tbody>
          {wallets.map((val, key) => {
            return (
              <tr className={styles.tableRow} key={key}>
                <td className={styles.cell}>
                  <button
                    className={styles.exportButton}
                    onClick={() => {
                      setSelectedWallet(val.walletId);
                    }}
                  >
                    <ExportIcon />
                  </button>
                </td>
                <td className={styles.cell}>
                  <p>{val.walletName}</p>
                </td>
                <td className={styles.cell}>
                  <p className={styles.idCell}>{val.walletId}</p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

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
      {iframeStamper && iframeStamper.publicKey() && wallets.length > 0 && (
        <div>{WalletsTable}</div>
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
      ></div>
    </main>
  );
}
function assertNever(curve: string) {
  throw new Error("Function not implemented.");
}
