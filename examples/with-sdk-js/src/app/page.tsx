"use client";

import Image from "next/image";
import styles from "./index.module.css";
import { StamperType, TurnkeyClient, Wallet } from "@turnkey/sdk-js";

import { server } from "@turnkey/sdk-server";
import { useEffect, useState } from "react";
import { Session, v1AddressFormat } from "@turnkey/sdk-types";
import { init } from "next/dist/compiled/webpack/webpack";
import { OtpType } from "@turnkey/sdk-js";

export default function AuthPage() {
  const [client, setClient] = useState<TurnkeyClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [email, setEmail] = useState<string>("");
  const [otpCode, setOtpCode] = useState<string>("");
  const [otpId, setOtpId] = useState<string>("");

  useEffect(() => {
    const initializeClient = async () => {
      const turnkeyClient = new TurnkeyClient({
        apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
        authProxyUrl: process.env.NEXT_PUBLIC_AUTH_PROXY_URL!,
        authProxyId: process.env.NEXT_PUBLIC_AUTH_PROXY_ID!,
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
    const res = await client?.fetchWallets({});
    if (res) {
      setWallets(res);
      console.log("Wallets:", res);
    } else {
      console.error("Failed to fetch wallets");
    }
  };

  const initOtp = async () => {
    const res = await client?.initOtp({
      otpType: "OTP_TYPE_EMAIL",
      contact: email,
    });

    console.log("OTP initialized:", res);
    if (!res) {
      console.error("Failed to initialize OTP");
      return;
    }
    setOtpId(res);
  };

  const verifyOtp = async () => {
    const res = await client?.verifyOtp({
      otpId,
      otpCode,
      contact: email,
      otpType: OtpType.Email,
    });

    console.log("OTP verification response:", res);

    if (!res || !res.verificationToken) {
      console.error("Failed to verify OTP");
      return;
    }
    const signupRes = await client?.signUpWithOtp({
      verificationToken: res.verificationToken,
      contact: email,
      otpType: OtpType.Email,
    })

    console.log("OTP verified and user signed up:", signupRes);
  }

  const getUser = async () => {
    const res = await client?.fetchUser({});
    if (res) {
      console.log("Users:", res);
    } else {
      console.error("Failed to fetch users");
    }
  };

  const signMessage = async () => {
    if (
      (wallets.length === 0 && !wallets[0]) ||
      !wallets[0].accounts ||
      wallets[0].accounts.length < 2
    ) {
      console.error("No wallets available to sign message");
      return;
    }

    for (const walletAccount of wallets[0].accounts) {
      const res = await client?.signMessage({
        message: "Hello, Turnkey!",
        wallet: walletAccount,
      });

      console.log("Signed message response:", res);
    }
  };

  const signUpWithPasskey = async () => {
    const res = await client?.signUpWithPasskey({
      passkeyDisplayName: `local-shmocal-passkey_${Date.now()}`,
      createSubOrgParams: {
        passkeyName: `local-shmocal-passkey_${Date.now()}`,
      }
    });

    console.log(res);
  };

  const createWallet = async (walletName: string) => {
    // List of all v1AddressFormat values
    const allAddressFormats = ["ADDRESS_FORMAT_ETHEREUM"];

    const res = await client?.createWallet({
      walletName,
      accounts: allAddressFormats,
    });

    console.log("Created wallet response:", res);
  };

  const logout = async () => {
    client?.logout({});
    // window.location.reload();
  };

  const switchSession = async (sessionKey: string) => {
    await client?.setActiveSession({ sessionKey });
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
        onClick={signUpWithPasskey}
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
        onClick={initOtp}
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
        onClick={() => verifyOtp()}
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
        onClick={logout}
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

      {client?.storageManager?.getActiveSession() ? (
        <button
          onClick={() => createWallet(`EVERYTHING ${wallets.length + 1}`)}
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

      {client?.storageManager?.getActiveSession() ? (
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
      ) : null}

      {client?.storageManager?.getActiveSession() ? (
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
      ) : null}

      {client?.storageManager?.getActiveSession() ? (
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
          onClick={signMessage}
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
