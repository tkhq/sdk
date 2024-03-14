import Image from "next/image";
import axios from "axios";
import * as React from "react";
import { useEffect, useState } from "react";

import styles from "./index.module.css";
import { Modal } from "@/components/Modal";
import { ExportPrivateKey } from "@/components/ExportPrivateKey";
import { ImportPrivateKey } from "@/components/ImportPrivateKey";
import { PrivateKeysTable } from "@/components/PrivateKeysTable";
import { TurnkeyApiTypes } from "@turnkey/http";

type TPrivateKey = TurnkeyApiTypes["v1PrivateKey"];

export default function ExportPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [privateKeys, setPrivateKeys] = useState<TPrivateKey[]>([]);
  const [selectedPrivateKey, setSelectedPrivateKey] = useState<TPrivateKey | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Get current user and wallets
  useEffect(() => {
    whoami();
    getPrivateKeys();
  }, []);

  // Get the current user
  const whoami = async () => {
    const organizationId = process.env.NEXT_PUBLIC_ORGANIZATION_ID!;
    const res = await axios.post("/api/whoami", { organizationId });

    console.log(res.data.userId);
    setUserId(res.data.userId);
  };

  // Get the organization's private keys
  const getPrivateKeys = async () => {
    const organizationId = process.env.NEXT_PUBLIC_ORGANIZATION_ID!;
    const res = await axios.post("/api/getPrivateKeys", { organizationId });

    setPrivateKeys(res.data.privateKeys);
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

      {/* Private Keys Table and Action Buttons */}
      {userId && (
        <div>
          <div className={styles.buttons}>
            <button
              className={styles.button}
              onClick={() => setIsImportModalOpen(true)}
            >
              Import Private Key
            </button>
          </div>
          <PrivateKeysTable
            privateKeys={privateKeys}
            setSelectedPrivateKey={setSelectedPrivateKey}
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
          <ImportPrivateKey userId={userId} getPrivateKeys={getPrivateKeys} />
        </Modal>
      )}

      {/* Export Modal */}
      {selectedPrivateKey && (
        <Modal
          show={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
        >
          <ExportPrivateKey
            privateKey={selectedPrivateKey} />
        </Modal>
      )}
    </main>
  );
}
