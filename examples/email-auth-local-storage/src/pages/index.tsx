import { useState, useEffect } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import axios from "axios";

import { createActivityPoller, TurnkeyClient } from "@turnkey/http";
import {
  generateP256KeyPair,
  decryptBundle,
  getPublicKey,
} from "@turnkey/crypto";
import {
  uint8ArrayToHexString,
  uint8ArrayFromHexString,
} from "@turnkey/encoding";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

import styles from "./index.module.css";

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
};
type AuthFormData = {
  email: string;
  suborgID: string;
  invalidateExisting: boolean;
};

const TURNKEY_EMBEDDED_KEY = "@turnkey/embedded_key";
const TURNKEY_EMBEDDED_KEY_TTL_IN_MILLIS = 1000 * 60 * 60 * 48; // 48 hours in milliseconds;

const TURNKEY_CREDENTIAL_BUNDLE = "@turnkey/credential_bundle";
const TURNKEY_CREDENTIAL_BUNDLE_TTL_IN_MILLIS = 1000 * 60 * 60 * 48; // 48 hours in milliseconds;

export default function AuthPage() {
  const [authResponse, setAuthResponse] = useState<AuthResponse | null>(null);
  const { register: authFormRegister, handleSubmit: authFormSubmit } =
    useForm<AuthFormData>();
  const {
    register: injectCredentialsFormRegister,
    handleSubmit: injectCredentialsFormSubmit,
  } = useForm<InjectCredentialsFormData>();
  const [targetPublicKey, setTargetPublicKey] = useState("");

  useEffect(() => {
    handleGenerateKey();
  }, []);

  const handleGenerateKey = async () => {
    const existingKey = getItemWithExpiry(TURNKEY_EMBEDDED_KEY);
    if (existingKey) {
      const parsedKey = JSON.parse(existingKey);
      setTargetPublicKey(parsedKey.publicKeyUncompressed);

      console.log(
        "Using existing target key stored in localStorage: ",
        parsedKey.publicKeyUncompressed
      );
      return;
    }

    try {
      const key = generateP256KeyPair();
      const targetPubHex = key.publicKeyUncompressed;
      setItemWithExpiry(
        TURNKEY_EMBEDDED_KEY,
        JSON.stringify(key),
        TURNKEY_EMBEDDED_KEY_TTL_IN_MILLIS
      );
      setTargetPublicKey(targetPubHex!);

      console.log("Created and stored new target key:", targetPubHex); // this is your target public key - use this value in email auth
    } catch (error) {
      console.error("Error generating key:", error);
    }
  };

  const auth = async (data: AuthFormData) => {
    const response = await axios.post("/api/auth", {
      suborgID: data.suborgID,
      email: data.email,
      targetPublicKey: targetPublicKey,
      invalidateExisting: data.invalidateExisting,
    });

    setAuthResponse(response.data);
  };

  const injectCredentials = async (data: InjectCredentialsFormData) => {
    if (authResponse === null) {
      throw new Error("authResponse is null");
    }

    let decryptedData;
    try {
      const embeddedKey = getItemWithExpiry(TURNKEY_EMBEDDED_KEY);
      const parsed = JSON.parse(embeddedKey);

      // This is decrypting the email auth bundle using the locally stored target embedded key
      const decryptedDataRaw = decryptBundle(
        data.authBundle,
        parsed.privateKey
      ) as Uint8Array;

      // This is the resulting decrypted Turnkey API key
      decryptedData = uint8ArrayToHexString(decryptedDataRaw);

      // Save the email auth bundle to local storage as well
      setItemWithExpiry(
        TURNKEY_CREDENTIAL_BUNDLE,
        data.authBundle,
        TURNKEY_CREDENTIAL_BUNDLE_TTL_IN_MILLIS
      );
    } catch (e) {
      const msg = `Error while injecting bundle: ${e}`;
      console.error(msg);
      alert(msg);
      return;
    }

    if (!decryptedData) {
      console.error("Missing decrypted data; did you perform email auth?");
      return;
    }

    const privateKey = decryptedData;
    const publicKey = getPublicKeyFromPrivateKeyHex(privateKey);

    const turnkeyClient = new TurnkeyClient(
      { baseUrl: "https://api.turnkey.com" },
      new ApiKeyStamper({
        apiPublicKey: publicKey,
        apiPrivateKey: privateKey,
      })
    );

    // get whoami for suborg
    const whoamiResponse = await turnkeyClient.getWhoami({
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    const orgID = whoamiResponse.organizationId;

    const activityPoller = createActivityPoller({
      client: turnkeyClient,
      requestFn: turnkeyClient.createWallet,
    });

    const completedActivity = await activityPoller({
      type: "ACTIVITY_TYPE_CREATE_WALLET",
      timestampMs: String(Date.now()),
      organizationId: orgID,
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
    const address = refineNonNull(wallet.addresses[0]);

    alert(`SUCCESS! Wallet and new address created: ${address} `);
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

      {!targetPublicKey && <p>Loading...</p>}

      {targetPublicKey && authResponse === null && (
        <form className={styles.form} onSubmit={authFormSubmit(auth)}>
          <label className={styles.label}>
            Email
            <input
              className={styles.input}
              {...authFormRegister("email")}
              placeholder="Email"
            />
          </label>
          <label className={styles.label}>
            Suborg ID (Optional — if not provided, attempt for standalone parent
            org)
            <input
              className={styles.input}
              {...authFormRegister("suborgID")}
              placeholder="Suborg ID"
            />
          </label>
          <label className={styles.label}>
            Invalidate previously issued email authentication token(s)?
            <input
              className={styles.input_checkbox}
              {...authFormRegister("invalidateExisting")}
              type="checkbox"
            />
          </label>
          <label className={styles.label}>
            Encryption Target from Local Storage:
            <br />
            <code title={targetPublicKey!}>
              {targetPublicKey!.substring(0, 30)}...
            </code>
          </label>

          <input className={styles.button} type="submit" value="Auth" />
        </form>
      )}

      {targetPublicKey && authResponse !== null && (
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

          <input
            className={styles.button}
            type="submit"
            value="Create Wallet"
          />
        </form>
      )}
    </main>
  );
}

// ****
// UTILITY FUNCTIONS BELOW
// ****
const getPublicKeyFromPrivateKeyHex = (privateKey: string): string => {
  return uint8ArrayToHexString(
    getPublicKey(uint8ArrayFromHexString(privateKey), true)
  );
};

/**
 * Get an item from localStorage. If it has expired, remove
 * the item from localStorage and return null.
 * @param {string} key
 */
const getItemWithExpiry = (key: string) => {
  const itemStr = localStorage.getItem(key);

  if (!itemStr) {
    return null;
  }

  const item = JSON.parse(itemStr);

  if (!item.hasOwnProperty("expiry") || !item.hasOwnProperty("value")) {
    window.localStorage.removeItem(key);
    return null;
  }

  const now = new Date();
  if (now.getTime() > item.expiry) {
    window.localStorage.removeItem(key);
    return null;
  }
  return item.value;
};

/**
 * Set an item in localStorage with an expiration time
 * @param {string} key
 * @param {string} value
 * @param {number} ttl expiration time in milliseconds
 */
const setItemWithExpiry = (key: string, value: string, ttl: number) => {
  const now = new Date();
  const item = {
    value: value,
    expiry: now.getTime() + ttl,
  };
  localStorage.setItem(key, JSON.stringify(item));
};

const refineNonNull = <T,>(
  input: T | null | undefined,
  errorMessage?: string
): T => {
  if (input == null) {
    throw new Error(errorMessage ?? `Unexpected ${JSON.stringify(input)}`);
  }

  return input;
};
