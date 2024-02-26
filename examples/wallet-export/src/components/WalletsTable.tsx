import Image from "next/image";
import styles from "../pages/index.module.css";
import { TurnkeyApiTypes } from "@turnkey/http";
import * as React from "react";
import cx from "classnames";

type TWallet = TurnkeyApiTypes["v1Wallet"];

type WalletsTableProps = {
  wallets: TWallet[];
  openExportModal:  (walletId: string) => void;
};

export function WalletsTable(props: WalletsTableProps) {
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
                        props.openExportModal(val.walletId);
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
