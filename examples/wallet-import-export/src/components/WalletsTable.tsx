import Image from "next/image";
import * as React from "react";
import { Dispatch, SetStateAction } from "react";
import cx from "classnames";

import styles from "../pages/index.module.css";

// We can pull this import from @turnkey/sdk-browser, @turnkey/sdk-server, or @turnkey/http.
// Electing to import from @turnkey/sdk-server as it's the only one we install for this example.
import { TurnkeyApiTypes } from "@turnkey/sdk-server";

type TWallet = TurnkeyApiTypes["v1Wallet"];

type WalletsTableProps = {
  wallets: TWallet[];
  setSelectedWallet: Dispatch<SetStateAction<string | null>>;
  setIsExportModalOpen: Dispatch<SetStateAction<boolean>>;
};

export function WalletsTable(props: WalletsTableProps) {
  const openExportModal = (walletId: string) => {
    props.setSelectedWallet(walletId);
    props.setIsExportModalOpen(true);
  };

  return (
    <div>
      <table className={styles.table}>
        <thead className={styles.tableHeader}>
          <tr>
            <th className={cx(styles.tableHeaderCell, styles.exportCol)}></th>
            <th className={cx(styles.tableHeaderCell, styles.walletNameCol)}>
              Wallet name
            </th>
            <th className={cx(styles.tableHeaderCell, styles.walletIdCol)}>
              Wallet ID
            </th>
          </tr>
        </thead>
        <tbody>
          {props.wallets.length > 0 ? (
            props.wallets.map((val, key) => {
              return (
                <tr className={styles.tableRow} key={key}>
                  <td className={styles.cell}>
                    <button
                      className={styles.exportButton}
                      onClick={() => {
                        openExportModal(val.walletId);
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
                    <p>{val.walletName}</p>
                  </td>
                  <td className={styles.cell}>
                    <p className={styles.idCell}>{val.walletId}</p>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr className={cx(styles.tableRow, styles.noWallets)}>
              <td colSpan={3}>
                <p>You have not created any wallets.</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
