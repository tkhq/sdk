"use client";

import Image from "next/image";
import styles from "./index.module.css";

import { StamperType, TurnkeyClient, Wallet } from "@turnkey/sdk-js";
import { useContext, useEffect, useState } from "react";
import { Session, v1AddressFormat, v1Attestation } from "@turnkey/sdk-types";
import { OtpType } from "@turnkey/sdk-js";
import { useModal, useTurnkey } from "@turnkey/react-wallet-kit";
import { SessionKey } from "@turnkey/sdk-js/dist/__storage__/base";

export default function AuthPage() {
  const [email, setEmail] = useState<string>("");
  const [otpCode, setOtpCode] = useState<string>("");
  const [otpId, setOtpId] = useState<string>("");

  const {
    httpClient,
    session,
    allSessions,
    authState,
    wallets,
    user,
    login,
    handleGoogleOauth,
    loginWithPasskey,
    createPasskey,
    signUpWithPasskey,
    fetchUser,
    fetchWallets,
    initOtp,
    completeOtp,
    signMessage,
    refreshSession,
    createWallet,
    logout,
    setActiveSession,
    handleExport,
    handleImport,
  } = useTurnkey();

  useEffect(() => {
    console.log("wallets:", wallets);
  }, [wallets]);

  useEffect(() => {
    console.log("User:", user);
  }, [user]);

  useEffect(() => {
    console.log("All Sessions:", allSessions);
  }, [allSessions]);

  useEffect(() => {
    console.log("Auth state", authState);
  }, [authState]);

  const logInWithPasskey1 = async () => {
    await loginWithPasskey({ sessionKey: "session-1" });
  };

  const logInWithPasskey2 = async () => {
    await loginWithPasskey({ sessionKey: "session-2" });
  };

  const indexedDB = async () => {
    const resp = await httpClient?.getWhoami({});
    console.log("Response from getWhoami:", resp);
  };

  const handleCreatePasskey = async () => {
    const res = await createPasskey();
    console.log("Created passkey:", res);
  };

  const getWallets = async () => {
    const res = await fetchWallets();
    if (res) {
      console.log("Wallets:", res);
    }
  };

  const handleVerifyOtp = async () => {
    const res = await completeOtp({
      otpId,
      otpCode,
      contact: email,
      otpType: OtpType.Email,
    });

    console.log("OTP verification response:", res);
  };

  const getUser = async () => {
    const res = await fetchUser();
    if (res) {
      console.log("Users:", res);
    } else {
      console.error("Failed to fetch users");
    }
  };

  const handleSignMessage = async () => {
    if (
      (wallets.length === 0 && !wallets[0]) ||
      !wallets[0].accounts ||
      wallets[0].accounts.length < 1
    ) {
      console.error("No wallets available to sign message");
      return;
    }

    for (const walletAccount of wallets[0].accounts) {
      const res = await signMessage({
        message: "Hello, Turnkey!",
        wallet: walletAccount,
      });

      console.log("Signed message response:", res);
    }
  };

  const handleRefreshSession = async () => {
    return await refreshSession({});
  };

  const handleCreateWallet = async (walletName: string) => {
    // List of all v1AddressFormat values
    const allAddressFormats: v1AddressFormat[] = [
      "ADDRESS_FORMAT_BITCOIN_MAINNET_P2PKH",
      "ADDRESS_FORMAT_BITCOIN_MAINNET_P2WPKH",
      "ADDRESS_FORMAT_APTOS",
      "ADDRESS_FORMAT_ETHEREUM",
      "ADDRESS_FORMAT_SOLANA",
    ];

    const res = await createWallet({
      walletName,
      accounts: allAddressFormats,
    });

    console.log("Created wallet response:", res);
  };

  const switchSession = async (sessionKey: string) => {
    await setActiveSession({ sessionKey });
  };

  const showModal = () => {
    login();
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
        onClick={() => {
          handleGoogleOauth({
            clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
          });
        }}
      >
        GOOOGEL
      </button>

      <button
        onClick={async () => {
          await signUpWithPasskey({
            passkeyDisplayName: `local-shmocal-passkey_${Date.now()}`,
            createSubOrgParams: {
              passkeyName: `local-shmocal-passkey_${Date.now()}`,
            },
          });
        }}
        style={{
          backgroundColor: "rebeccapurple",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Sign Up with Passkey
      </button>

      <input
        type="text"
        placeholder="Enter your email"
        style={{
          margin: "12px 0",
          padding: "8px",
          borderRadius: "4px",
          border: "1px solid #ccc",
          width: "300px",
        }}
        onChange={(e) => {
          setEmail(e.target.value);
        }}
      />
      <button
        onClick={async () => {
          const res = await initOtp({
            otpType: "OTP_TYPE_EMAIL",
            contact: email,
          });

          if (!res) {
            console.error("Failed to initialize OTP");
            return;
          }
          setOtpId(res);
        }}
        style={{
          backgroundColor: "rebeccapurple",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Init OTP
      </button>

      <input
        type="text"
        placeholder="Enter OTP code"
        style={{
          margin: "12px 0",
          padding: "8px",
          borderRadius: "4px",
          border: "1px solid #ccc",
          width: "300px",
        }}
        onChange={(e) => {
          setOtpCode(e.target.value);
        }}
      />

      <button
        onClick={() => handleVerifyOtp()}
        style={{
          backgroundColor: "rebeccapurple",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Verify OTP
      </button>

      <button
        onClick={() => logout()}
        style={{
          backgroundColor: "rosybrown",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Logout
      </button>

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

      {session ? (
        <button
          onClick={handleRefreshSession}
          style={{
            backgroundColor: "red",
            borderRadius: "8px",
            padding: "8px 16px",
            color: "white",
          }}
        >
          Refresh Session
        </button>
      ) : null}

      <button
        onClick={() => handleCreatePasskey()}
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

      <button
        onClick={showModal}
        style={{
          backgroundColor: "purple",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Show Modal
      </button>

      <button
        onClick={handleExport}
        style={{
          backgroundColor: "purple",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Show Export Modal
      </button>

      <button
        onClick={handleImport}
        style={{
          backgroundColor: "purple",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Show Import Modal
      </button>

      {session ? (
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

      {session ? (
        <button
          onClick={() => handleCreateWallet(`EVERYTHING ${wallets.length + 1}`)}
          style={{
            backgroundColor: "gray",
            borderRadius: "8px",
            padding: "8px 16px",
            color: "white",
          }}
        >
          Create Wallet
        </button>
      ) : null}

      <button
        onClick={() => switchSession(SessionKey.DefaultSessionkey)}
        style={{
          backgroundColor: "lightblue",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Switch to Default Session
      </button>

      <button
        onClick={() => switchSession("session-1")}
        style={{
          backgroundColor: "lightblue",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Switch to Session 1
      </button>

      <button
        onClick={() => switchSession("session-2")}
        style={{
          backgroundColor: "lightblue",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "white",
        }}
      >
        Switch to Session 2
      </button>

      {session ? (
        <button
          onClick={getUser}
          style={{
            backgroundColor: "red",
            borderRadius: "8px",
            padding: "8px 16px",
            color: "white",
          }}
        >
          Get Users
        </button>
      ) : null}

      {wallets.length > 0 && (
        <button
          onClick={handleSignMessage}
          style={{
            backgroundColor: "pink",
            borderRadius: "8px",
            padding: "8px 16px",
            color: "white",
          }}
        >
          Sign Message
        </button>
      )}
    </main>
  );
}
