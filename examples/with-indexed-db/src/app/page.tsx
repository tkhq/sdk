"use client";

import Image from "next/image";
import styles from "./index.module.css";
import { useTurnkey } from "@turnkey/sdk-react";
import * as React from "react";
import { useState, useEffect } from "react";
import { server } from "@turnkey/sdk-server";
import { SessionType, type Session } from "@turnkey/sdk-browser";

export default function AuthPage() {
  const { indexedDbClient, passkeyClient, turnkey } = useTurnkey();
  const [session, setSession] = useState<any | null>(null);
  const [whoamI, setWhoAmI] = useState<any | null>(null);
  useEffect(() => {
    const checkSession = async () => {
      const session = await turnkey?.getSession();
      console.log(session);
      if (!session || Date.now() > session.expiry) {
        await handleLogout();
      } else {
        setSession(session);
      }
    };
    checkSession();
  }, [turnkey]);

  const getWhoAmi = async () => {
    const response = await indexedDbClient?.getWhoami({
      organizationId: session.organizationId,
    });
    setWhoAmI(JSON.stringify(response));
  };

  const handleLogout = async () => {
    turnkey?.logout();
    indexedDbClient?.clear();
    setSession(false);
  };
  const login = async () => {
    await indexedDbClient?.resetKeyPair();

    const publicKey = await indexedDbClient!.getPublicKey();
    console.log("Public Key: ", publicKey);

    const whoamiResponse = await passkeyClient?.getWhoami({});
    await passkeyClient!.createApiKeys({
      organizationId: whoamiResponse?.organizationId!,
      userId: whoamiResponse?.userId!,
      apiKeys: [
        {
          apiKeyName: "Auth API Key",
          publicKey: publicKey!,
          curveType: "API_KEY_CURVE_P256",
          expirationSeconds: "900",
        },
      ],
    });

    const session: Session = {
      sessionType: SessionType.READ_WRITE,
      expiry: Date.now() + 900 * 1000, // 15 minutes from now
      userId: whoamiResponse?.userId!,
      organizationId: whoamiResponse?.organizationId!,
      token: publicKey!,
    };
    await indexedDbClient!.loginWithSessionIndexedDb(session);
    setSession(session);
  };

  const create = async () => {
    const siteInfo = `${
      new URL(window.location.href).hostname
    } - ${new Date().toLocaleString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })}`;
    const { encodedChallenge, attestation } =
      (await passkeyClient?.createUserPasskey({
        publicKey: { user: { name: siteInfo, displayName: siteInfo } },
      })) || {};

    const resp = await server.createSuborg({
      passkey: {
        authenticatorName: "First Passkey",
        challenge: encodedChallenge,
        attestation,
      },
    });
    console.log(resp);
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

      {(!indexedDbClient || !passkeyClient) && <p>Loading...</p>}

      {indexedDbClient && passkeyClient && (
        <div>
          {!session ? (
            <div>
              <button className={styles.button} onClick={login}>
                Login With Passkey
              </button>
              <button className={styles.button} onClick={create}>
                Create Suborg
              </button>
            </div>
          ) : (
            <div>
              <p>Session is active!</p>
              <button className={styles.button} onClick={handleLogout}>
                Log out
              </button>
              <button className={styles.button} onClick={getWhoAmi}>
                Who am I?
              </button>
              <div>{whoamI && whoamI}</div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
