import Image from "next/image";
import styles from "./index.module.css";
import { createActivityPoller, TurnkeyClient } from "@turnkey/http";
import { IframeStamper } from "@turnkey/iframe-stamper";
import { useForm } from "react-hook-form";
import axios from "axios";
import * as React from "react";
import { useState } from "react";
import { Auth } from "@/components/Auth";

/**
 * Type definition for the server response coming back from `/api/auth`
 */
type AuthResponse = {
  userId: string;
  apiKeyId: string;
  organizationId: string;
};

/**
 * Type definitions for the form data (client-side forms)
 */
type InjectCredentialsFormData = {
  walletName: string;
  authBundle: string;
  // authenticatorName: string;
};
type AuthFormData = {
  email: string;
};

// All algorithms can be found here: https://www.iana.org/assignments/cose/cose.xhtml#algorithms
// We only support ES256 and RS256, which are listed here
const es256 = -7;
const rs256 = -257;

// This constant designates the type of credential we want to create.
// The enum only supports one value, "public-key"
// https://www.w3.org/TR/webauthn-2/#enumdef-publickeycredentialtype
const publicKey = "public-key";

const generateRandomBuffer = (): ArrayBuffer => {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return arr.buffer;
};

const base64UrlEncode = (challenge: ArrayBuffer): string => {
  return Buffer.from(challenge)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
};

export default function AuthPage() {
  const [authResponse, setAuthResponse] =
    useState<AuthResponse | null>(null);
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(
    null
  );
  const {
    register: authFormRegister,
    handleSubmit: authFormSubmit,
  } = useForm<AuthFormData>();
  const {
    register: injectCredentialsFormRegister,
    handleSubmit: injectCredentialsFormSubmit,
  } = useForm<InjectCredentialsFormData>();

  const auth = async (data: AuthFormData) => {
    if (iframeStamper === null) {
      throw new Error("cannot initialize auth without an iframe");
    }

    const response = await axios.post("/api/auth", {
      email: data.email,
      targetPublicKey: iframeStamper.publicKey(),
    });

    setAuthResponse(response.data);
  };

  const injectCredentials = async (data: InjectCredentialsFormData) => {
    if (iframeStamper === null) {
      throw new Error("iframeStamper is null");
    }
    if (authResponse === null) {
      throw new Error("authResponse is null");
    }

    try {
      await iframeStamper.injectAuthBundle(data.authBundle);
    } catch (e) {
      const msg = `error while injecting bundle: ${e}`;
      console.error(msg);
      alert(msg);
      return;
    }

    const client = new TurnkeyClient(
      {
        baseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
      },
      iframeStamper
    );

    const activityPoller = createActivityPoller({
      client,
      requestFn: client.createWallet,
    });

    const completedActivity = await activityPoller({
      type: "ACTIVITY_TYPE_CREATE_WALLET",
      timestampMs: String(Date.now()),
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
      parameters: {
        walletName: data.walletName,
        accounts: [
          {
            curve: "CURVE_SECP256K1",
            pathFormat: "PATH_FORMAT_BIP32",
            path: "m/44'/60'/0'/0/0",
            addressFormat: "ADDRESS_FORMAT_ETHEREUM",
          },
        ],
      },
    });

    const wallet = refineNonNull(completedActivity.result.createWalletResult);
    const walletId = refineNonNull(wallet.walletId);
    const address = refineNonNull(wallet.addresses[0]);

    // // Instead of simply alerting, redirect the user to your app's login page.
    alert(
      `SUCCESS! Wallet and new address created: ${address} `
    );
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

      <Auth
        setIframeStamper={setIframeStamper}
        iframeUrl={process.env.NEXT_PUBLIC_AUTH_IFRAME_URL!}
        turnkeyBaseUrl={process.env.NEXT_PUBLIC_BASE_URL!}
      ></Auth>

      {!iframeStamper && <p>Loading...</p>}

      {iframeStamper &&
        iframeStamper.publicKey() &&
        authResponse === null && (
          <form
            className={styles.form}
            onSubmit={authFormSubmit(auth)}
          >
            <label className={styles.label}>
              Email
              <input
                className={styles.input}
                {...authFormRegister("email")}
                placeholder="Email"
              />
            </label>
            <label className={styles.label}>
              Encryption Target from iframe:
              <br />
              <code title={iframeStamper.publicKey()!}>
                {iframeStamper.publicKey()!.substring(0, 30)}...
              </code>
            </label>

            <input
              className={styles.button}
              type="submit"
              value="Auth"
            />
          </form>
        )}

      {iframeStamper &&
        iframeStamper.publicKey() &&
        authResponse !== null && (
          <form
            className={styles.form}
            onSubmit={injectCredentialsFormSubmit(injectCredentials)}
          >
            <label className={styles.label}>
              Auth Bundle
              <input
                className={styles.input}
                {...injectCredentialsFormRegister("authBundle")}
                placeholder="Paste your auth bundle here"
              />
            </label>
            <label className={styles.label}>
              New wallet name
              <input
                className={styles.input}
                {...injectCredentialsFormRegister("walletName")}
                placeholder="Wallet name"
              />
            </label>

            <input className={styles.button} type="submit" value="Create Wallet" />
          </form>
        )}
    </main>
  );
}

function refineNonNull<T>(
  input: T | null | undefined,
  errorMessage?: string
): T {
  if (input == null) {
    throw new Error(errorMessage ?? `Unexpected ${JSON.stringify(input)}`);
  }

  return input;
}
