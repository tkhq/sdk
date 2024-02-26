import Image from "next/image";
import * as React from "react";
import { useEffect, useState } from "react";
import axios from "axios";

import styles from "./index.module.css";
import { TurnkeyApiTypes } from "@turnkey/http";
import { Modal } from "@/components/Modal";
import { ExportWallet } from "@/components/ExportWallet";
import { ImportWallet } from "@/components/ImportWallet";
import { WalletsTable } from "@/components/WalletsTable";

type TWallet = TurnkeyApiTypes["v1Wallet"];

export default function ExportPage() {
  const [wallets, setWallets] = useState<TWallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Get wallets
  useEffect(() => {
    getWallets();
  }, []);

  const openExportModal = (walletId: string) => {
    setSelectedWallet(walletId)
    setIsExportModalOpen(true);
  }

  const closeExportModal = () => {
    setIsExportModalOpen(false);
  }

  const openImportModal = () => {
    setIsImportModalOpen(true);
  }

  const closeImportModal = () => {
    setIsImportModalOpen(false);
  }

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

      <div className={styles.buttons}>
        <button
          className={styles.button}
          onClick={openImportModal}
        >
          Import Wallet
        </button>
      </div>

      {/* Wallets Table */}
      <WalletsTable
        wallets={wallets}
        openExportModal={openExportModal}
      />
      
      {/* Import Modal */} 
      <Modal show={isImportModalOpen} onClose={closeImportModal}>
        <ImportWallet
          userId={process.env.NEXT_PUBLIC_USER_ID!}
          getWallets={getWallets}
        />
      </Modal>

      {/* Export Modal */} 
      {selectedWallet && (
        <Modal show={isExportModalOpen} onClose={closeExportModal}>
          <ExportWallet
            walletId={selectedWallet}
          />
        </Modal>
      )}
    </main>
  );
}
