import Image from "next/image";
import * as React from "react";
import { Dispatch, SetStateAction } from "react";
import cx from "classnames";

import styles from "../pages/index.module.css";
import { TurnkeyApiTypes } from "@turnkey/http";

type TPrivateKey = TurnkeyApiTypes["v1PrivateKey"];

type PrivateKeysTableProps = {
  privateKeys: TPrivateKey[];
  setSelectedPrivateKey: Dispatch<SetStateAction<TPrivateKey | null>>;
  setIsExportModalOpen: Dispatch<SetStateAction<boolean>>;
};

export function PrivateKeysTable(props: PrivateKeysTableProps) {
  const openExportModal = (privateKey: TPrivateKey) => {
    props.setSelectedPrivateKey(privateKey);
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
            <th className={cx(styles.tableHeaderCell, styles.walletNameCol)}>
              Curve
            </th>
            <th className={cx(styles.tableHeaderCell, styles.walletIdCol)}>
              Wallet ID
            </th>
          </tr>
        </thead>
        <tbody>
          {props.privateKeys.length > 0 ? (
            props.privateKeys.map((val, key) => {
              return (
                <tr className={styles.tableRow} key={key}>
                  <td className={styles.cell}>
                    <button
                      className={styles.exportButton}
                      onClick={() => {
                        openExportModal(val);
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
                    <p>{val.privateKeyName}</p>
                  </td>
                  <td className={styles.cell}>
                    <p>{val.curve.replace("CURVE_", " ")}</p>
                  </td>
                  <td className={styles.cell}>
                    <p className={styles.idCell}>{val.privateKeyId}</p>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr className={cx(styles.tableRow, styles.noWallets)}>
              <td colSpan={3}>
                <p>You have not created any private keys.</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
