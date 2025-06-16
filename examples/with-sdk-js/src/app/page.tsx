"use client";

import Image from "next/image";
import styles from "./index.module.css";
import { StamperType, TurnkeyClient, TWallet } from "@turnkey/sdk-js";

import { server } from "@turnkey/sdk-server";
import { useEffect, useState } from "react";
import { Session } from "@turnkey/sdk-types";
import { get } from "http";
import { set } from "react-hook-form";

export default function AuthPage() {
  const [client, setClient] = useState<TurnkeyClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [wallets, setWallets] = useState<TWallet[]>([]);

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

  const logInWithPasskey1 = async () => {
    await client?.loginWithPasskey({ sessionKey: "session-1" });
  };

  const logInWithPasskey2 = async () => {
    await client?.loginWithPasskey({ sessionKey: "session-2" });
  };

  const indexedDB = async () => {
    const resp = await client?.httpClient.getWhoami({});
    console.log("Response from getWhoami:", resp);
  };

  const getWallets = async () => {
    const res = await client?.getWallets({});
    if (res) {
      setWallets(res);
      console.log("Wallets:", res);
    } else {
      console.error("Failed to fetch wallets");
    }
  };

  useEffect(() => {});

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
        onClick={logInWithPasskey1}
        style={{
          backgroundColor: "blue",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Log in With Passkey Session 1
      </button>
      <button
        onClick={logInWithPasskey2}
        style={{
          backgroundColor: "lightblue",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Log in With Passkey Session 2
      </button>

      {client?.storageManager?.getActiveSession() ? (
        <button
          onClick={getWallets}
          style={{
            backgroundColor: "blue",
            borderRadius: "8px",
            padding: "8px 16px",
            color: "white",
          }}
        >
          Get Wallets
        </button>
      ) : null}
    </main>
  );
}
