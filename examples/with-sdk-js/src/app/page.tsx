"use client";

import Image from "next/image";
import styles from "./index.module.css";
import { StamperType, TurnkeyClient } from "@turnkey/sdk-js";

import { server } from "@turnkey/sdk-server";
import { useEffect, useState } from "react";

export default function AuthPage() {
  const [client, setClient] = useState<TurnkeyClient | null>(null);

  useEffect(() => {
    const initializeClient = async () => {
      const turnkeyClient = new TurnkeyClient({
        apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
        organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
        passkeyConfig: {
          rpId: process.env.NEXT_PUBLIC_RPID!,
          timeout: 60000, // 60 seconds
          userVerification: "preferred",
          allowCredentials: [],
        },
      });

      await turnkeyClient.init();
      setClient(turnkeyClient);
    };

    initializeClient();
  }, []);

  const createPasskey = async () => {
    await client?.createPasskey({});
  };

  const logInWithPasskey = async () => {
    await client?.loginWithPasskey({});
  };
  const indexedDB = async () => {
    const resp = await client?.httpClient.getWhoami({});
    console.log("Response from getWhoami:", resp);
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

      <button
        onClick={indexedDB}
        style={{
          backgroundColor: "green",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        GetWhoami with IndexedDB
      </button>

      <button
        onClick={createPasskey}
        style={{
          backgroundColor: "orange",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Create Passkey
      </button>
      <button
        onClick={logInWithPasskey}
        style={{
          backgroundColor: "blue",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Log in With Passkey
      </button>
    </main>
  );
}
