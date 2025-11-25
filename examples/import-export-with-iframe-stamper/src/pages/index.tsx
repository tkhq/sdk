import Image from "next/image";
import axios from "axios";
import * as React from "react";
import { useEffect, useState } from "react";

import styles from "./index.module.css";
import { Modal } from "@/components/Modal";
import { ExportWallet } from "@/components/ExportWallet";
import { ImportWallet } from "@/components/ImportWallet";
import { WalletsTable } from "@/components/WalletsTable";

// We can pull this import from @turnkey/sdk-browser, @turnkey/sdk-server, or @turnkey/http.
// Electing to import from @turnkey/sdk-server as it's the only one we install for this example.
import { TurnkeyApiTypes } from "@turnkey/sdk-server";

type TWallet = TurnkeyApiTypes["v1Wallet"];

export default function ExportPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [wallets, setWallets] = useState<TWallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Get current user and wallets
  useEffect(() => {
    whoami();
    getWallets();
  }, []);

  // Get the current user
  const whoami = async () => {
    const organizationId = process.env.NEXT_PUBLIC_ORGANIZATION_ID!;
    const res = await axios.post("/api/whoami", { organizationId });

    setUserId(res.data.userId);
  };

  // Get the organization's wallets
  const getWallets = async () => {
    const organizationId = process.env.NEXT_PUBLIC_ORGANIZATION_ID!;
    const res = await axios.post("/api/getWallets", { organizationId });

    setWallets(res.data.wallets);
  };

  return (
    <main className={styles.main}>
      {/* Header */}
      <div className={styles.header}>
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
      </div>

      {/* Wallets Table and Action Buttons */}
      {userId && (
        <div>
          <div className={styles.buttons}>
            <button
              className={styles.button}
              onClick={() => setIsImportModalOpen(true)}
            >
              Import Wallet
            </button>
          </div>
          <WalletsTable
            wallets={wallets}
            setSelectedWallet={setSelectedWallet}
            setIsExportModalOpen={setIsExportModalOpen}
          />
        </div>
      )}

      {/* Import Modal */}
      {userId && (
        <Modal
          show={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
        >
          <ImportWallet
            organizationId={process.env.NEXT_PUBLIC_ORGANIZATION_ID!}
            userId={userId}
            getWallets={getWallets}
          />
        </Modal>
      )}

      {/* Export Modal */}
      {selectedWallet && (
        <Modal
          show={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
        >
          <ExportWallet
            organizationId={process.env.NEXT_PUBLIC_ORGANIZATION_ID!}
            walletId={selectedWallet}
          />
        </Modal>
      )}
    </main>
  );
}
