import Image from "next/image";
import axios from "axios";
import * as React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

import styles from "../index.module.css";
import { Modal } from "@/components/Modal";
import { ExportWalletAccount } from "@/components/ExportWalletAccount";

// We can pull this import from @turnkey/sdk-browser, @turnkey/sdk-server, or @turnkey/http.
// Electing to import from @turnkey/sdk-server as it's the only one we install for this example.
import { TurnkeyApiTypes } from "@turnkey/sdk-server";

type TWalletAccount = TurnkeyApiTypes["v1WalletAccount"];
type TWallet = TurnkeyApiTypes["v1Wallet"];

export default function WalletDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [wallet, setWallet] = useState<TWallet | null>(null);
  const [accounts, setAccounts] = useState<TWalletAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWalletAccount, setSelectedWalletAccount] = useState<
    string | null
  >(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Get wallet and accounts data
  useEffect(() => {
    if (id) {
      getWallet();
      getWalletAccounts();
    }
  }, [id]);

  // Get the wallet details
  const getWallet = async () => {
    try {
      const organizationId = process.env.NEXT_PUBLIC_ORGANIZATION_ID!;
      const res = await axios.post("/api/getWallets", { organizationId });

      const walletData = res.data.wallets.find(
        (w: TWallet) => w.walletId === id,
      );
      if (walletData) {
        setWallet(walletData);
      }
    } catch (error) {
      console.error("Error fetching wallet:", error);
    }
  };

  // Get the wallet accounts
  const getWalletAccounts = async () => {
    try {
      setLoading(true);
      const organizationId = process.env.NEXT_PUBLIC_ORGANIZATION_ID!;
      const res = await axios.post("/api/getWalletAccounts", {
        organizationId,
        walletId: id,
      });

      setAccounts(res.data.accounts);
    } catch (error) {
      console.error("Error fetching wallet accounts:", error);
    } finally {
      setLoading(false);
    }
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

      {/* Back Button */}
      <div
        className={styles.buttons}
        style={{ justifyContent: "flex-start", marginBottom: "20px" }}
      >
        <Link href="/">
          <button className={styles.button}>← Back to Wallets</button>
        </Link>
      </div>

      {/* Wallet Details */}
      {wallet && (
        <div style={{ width: "100%", maxWidth: "740px", marginBottom: "20px" }}>
          <h2
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "24px",
              fontWeight: "600",
            }}
          >
            {wallet.walletName}
          </h2>
          <p className={styles.idCell}>Wallet ID: {wallet.walletId}</p>
        </div>
      )}

      {/* Accounts Table */}
      <div style={{ width: "100%", maxWidth: "740px" }}>
        <h3
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: "20px",
            fontWeight: "600",
          }}
        >
          Wallet Accounts
        </h3>
        {loading ? (
          <p>Loading accounts...</p>
        ) : (
          <table className={styles.table}>
            <thead className={styles.tableHeader}>
              <tr>
                <th
                  className={styles.tableHeaderCell}
                  style={{ width: "55px" }}
                ></th>
                <th className={styles.tableHeaderCell}>Account Name</th>
                <th className={styles.tableHeaderCell}>Address</th>
                <th className={styles.tableHeaderCell}>Path</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length > 0 ? (
                accounts.map((account, key) => {
                  return (
                    <tr className={styles.tableRow} key={key}>
                      <td className={styles.cell}>
                        <button
                          className={styles.exportButton}
                          onClick={() => {
                            setSelectedWalletAccount(account.address);
                            setIsExportModalOpen(true);
                          }}
                        >
                          <Image
                            src="/export.svg"
                            alt="Export"
                            width={12}
                            height={12}
                            priority
                          />
                        </button>
                      </td>
                      <td className={styles.cell}>
                        <p>{account.walletAccountId}</p>
                      </td>
                      <td className={styles.cell}>
                        <p className={styles.addressCell}>{account.address}</p>
                      </td>
                      <td className={styles.cell}>
                        <p>{account.path}</p>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr className={`${styles.tableRow} ${styles.noWallets}`}>
                  <td colSpan={4}>
                    <p>This wallet has no accounts.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Export Modal */}
      {selectedWalletAccount && (
        <Modal
          show={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
        >
          <ExportWalletAccount
            organizationId={process.env.NEXT_PUBLIC_ORGANIZATION_ID!}
            walletAccountAddress={selectedWalletAccount}
          />
        </Modal>
      )}
    </main>
  );
}
