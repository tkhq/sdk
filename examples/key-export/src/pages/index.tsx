import Image from "next/image";
import styles from "./index.module.css";
import { TurnkeyApiTypes } from "@turnkey/http";
import { IframeStamper } from "@turnkey/iframe-stamper";
import * as React from "react";
import { useEffect, useState } from "react";
import axios from "axios";

type TPrivateKey = TurnkeyApiTypes["v1PrivateKey"];

const TurnkeyIframeContainerId = "turnkey-iframe-container-id";
const TurnkeyIframeElementId = "turnkey-iframe-element-id";

export default function ExportPage() {
  const [privateKeys, setPrivateKeys] = useState<TPrivateKey[]>([]);
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(
    null
  );
  const [showPrivateKey, setShowPrivateKey] = useState<boolean>(false);
  const [selectedPrivateKey, setSelectedPrivateKey] = useState<string | null>(
    null
  );

  useEffect(() => {
    const instantiateIframeStamper = async () => {
      const stamper = new IframeStamper({
        iframeUrl: process.env.NEXT_PUBLIC_EXPORT_IFRAME_URL!,
        iframeContainerId: TurnkeyIframeContainerId,
        iframeElementId: TurnkeyIframeElementId,
        iframeStyle: "border: none; width: 600px; height: 200px;",
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
    getPrivateKeys();
  }, []);

  const getPrivateKeys = async () => {
    const organizationId = process.env.NEXT_PUBLIC_ORGANIZATION_ID!;
    const res = await axios.post("/api/getPrivateKeys", { organizationId });

    setPrivateKeys(res.data.privateKeys);
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

  const formatCurve = (curve: string) => {
    switch (curve) {
      case "CURVE_SECP256K1": {
        return "SECP256K1";
      }
      case "CURVE_ED25519": {
        return "ED25519";
      }
      default: {
        assertNever(curve);
      }
    }
  };

  const PrivateKeysTable = (
    <div>
      <table className={styles.table}>
        <thead className={styles.tableHeader}>
          <tr>
            <th className={styles.tableHeaderCell}></th>
            <th className={styles.tableHeaderCell}>Private key name</th>
            <th className={styles.tableHeaderCell}>Private key ID</th>
            <th className={styles.tableHeaderCell}>Curve type</th>
            <th className={styles.tableHeaderCell}>Asset address</th>
          </tr>
        </thead>
        <tbody>
          {privateKeys.map((val, key) => {
            return (
              <tr className={styles.tableRow} key={key}>
                <td className={styles.cell}>
                  <button
                    className={styles.exportButton}
                    onClick={() => {
                      setSelectedPrivateKey(val.privateKeyId);
                    }}
                  >
                    <ExportIcon />
                  </button>
                </td>
                <td className={styles.cell}>
                  <p>{val.privateKeyName}</p>
                </td>
                <td className={styles.cell}>
                  <p className={styles.idCell}>{val.privateKeyId}</p>
                </td>
                <td className={styles.cell}>
                  <p>{formatCurve(val.curve!)}</p>
                </td>
                <td className={styles.cell}>
                  <p className={styles.addressCell}>
                    {val.addresses[0].address!}
                  </p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const exportKey = async (keyId: string) => {
    if (iframeStamper === null) {
      throw new Error("cannot export private key without an iframe");
    }

    const response = await axios.post("/api/exportPrivateKey", {
      privateKeyId: keyId,
      targetPublicKey: iframeStamper.publicKey(),
    });

    let injected = await iframeStamper.injectKeyExportBundle(
      response.data["exportBundle"]
    );
    if (injected !== true) {
      throw new Error("unexpected error while injecting export bundle");
    }

    setShowPrivateKey(true);
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
      {iframeStamper && iframeStamper.publicKey() && privateKeys.length > 0 && (
        <div>{PrivateKeysTable}</div>
      )}
      {selectedPrivateKey && (
        <div className={styles.copyKey}>
          <h2>Private key</h2>
          <p>
            You are about to reveal your private key. By revealing this private
            key you understand that:
          </p>
          <ul>
            <li>
              <p>Your private key is the only way to recover your funds.</p>
            </li>
            <li>
              <p>Do not let anyone see your private key.</p>
            </li>
            <li>
              <p>
                Never share your private key with anyone, including Turnkey.
              </p>
            </li>
          </ul>
          <div className={styles.reveal}>
            <button
              className={styles.revealButton}
              onClick={() => {
                exportKey(selectedPrivateKey);
              }}
            >
              Reveal
            </button>
          </div>
        </div>
      )}
      <div
        style={{ display: showPrivateKey ? "block" : "none" }}
        id={TurnkeyIframeContainerId}
      ></div>
    </main>
  );
}
function assertNever(curve: string) {
  throw new Error("Function not implemented.");
}
