import Image from "next/image";
import styles from "./index.module.css";
import { TurnkeyClient } from "@turnkey/http";
import { useForm } from "react-hook-form";
import * as React from "react";
import { SetStateAction, useState } from "react";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { p256 } from "@noble/curves/p256";
import { uint8ArrayToHexString } from "@turnkey/encoding";

/**
 * Type definitions for the form data (client-side forms)
 */
type WhoamiFormData = {
  publicKey: string;
  privateKey: string;
};

export default function WhoamiPage() {
  const { register: whoamiFormRegister, handleSubmit: whoamiFormSubmit } =
    useForm<WhoamiFormData>();
  const [privateKey, setPrivateKey] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [whoamiResponse, setWhoamiResponse] = useState({
    organizationId: "",
    organizationName: "",
    userId: "",
    username: "",
  });

  const handlePrivateKeyChange = (event: {
    target: { value: SetStateAction<string> };
  }) => {
    setPrivateKey(event.target.value);

    const paddedPrivateKey = event.target.value.toString().padStart(64, "0");

    // Also derive corresponding public key
    setPublicKey(
      uint8ArrayToHexString(p256.getPublicKey(paddedPrivateKey, true))
    );
  };

  const handlePublicKeyChange = (event: {
    target: { value: SetStateAction<string> };
  }) => {
    setPublicKey(event.target.value);
  };

  const whoami = async () => {
    const turnkeyClient = new TurnkeyClient(
      { baseUrl: process.env.NEXT_PUBLIC_BASE_URL! },
      new ApiKeyStamper({
        apiPublicKey: publicKey,
        apiPrivateKey: privateKey,
      })
    );

    const response = await turnkeyClient.getWhoami({
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    setWhoamiResponse(response);
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

      <form className={styles.form} onSubmit={whoamiFormSubmit(whoami)}>
        <label className={styles.label}>
          API Private Key
          <input
            className={styles.input}
            type="text"
            value={privateKey}
            onChange={handlePrivateKeyChange}
            placeholder="Private Key"
          />
        </label>

        <label className={styles.label}>
          API Public Key.
          <br />
          (By default, this will be derived from the provided private key.)
          <input
            className={styles.input}
            type="text"
            value={publicKey}
            onChange={handlePublicKeyChange}
            placeholder="Public Key"
          />
        </label>

        <button
          className={styles.button}
          onClick={() => {
            whoami();
          }}
        >
          Whoami?
        </button>
      </form>

      {whoamiResponse.organizationId && (
        <div>
          <table>
            <tbody>
              <tr>
                <td>
                  <label className={styles.table_label}>Org ID</label>
                </td>
                <td>
                  <label className={styles.table_label}>
                    {whoamiResponse.organizationId}
                  </label>
                </td>
              </tr>
              <tr>
                <td>
                  <label className={styles.table_label}>Org Name</label>
                </td>
                <td>
                  <label className={styles.table_label}>
                    {whoamiResponse.organizationName}
                  </label>
                </td>
              </tr>
              <tr>
                <td>
                  <label className={styles.table_label}>User ID</label>
                </td>
                <td>
                  <label className={styles.table_label}>
                    {whoamiResponse.userId}
                  </label>
                </td>
              </tr>
              <tr>
                <td>
                  <label className={styles.table_label}>User Name</label>
                </td>
                <td>
                  <label className={styles.table_label}>
                    {whoamiResponse.username}
                  </label>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
