import { useState, useEffect } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import axios from "axios";

import { Turnkey } from "@turnkey/sdk-server";
import {
  generateP256KeyPair,
  decryptCredentialBundle,
  getPublicKey,
} from "@turnkey/crypto";
import {
  uint8ArrayToHexString,
  uint8ArrayFromHexString,
} from "@turnkey/encoding";

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
  authBundle: string;
};
type CreateWalletFormData = {
  walletName: string;
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
  const {
    register: createWalletFormRegister,
    handleSubmit: createWalletFormSubmit,
  } = useForm<CreateWalletFormData>();
  const [targetPublicKey, setTargetPublicKey] = useState("");
  const [turnkeyPrivateKey, setTurnkeyPrivateKey] = useState("");
  const [turnkeyPublicKey, setTurnkeyPublicKey] = useState("");
  const [useLocalBundle, setUseLocalBundle] = useState(false);

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

  // This emulates injecting an email auth credential bundle into an iframe. The difference is that here,
  // instead of decrypting the bundle using a target key stored within an iframe, we use a target key stored
  // within the app's local storage.
  const injectCredentials = (data: InjectCredentialsFormData) => {
    if (authResponse === null && !useLocalBundle) {
      throw new Error("No credentials found");
    }

    let decryptedData;
    try {
      const embeddedKey = getItemWithExpiry(TURNKEY_EMBEDDED_KEY);
      const parsed = JSON.parse(embeddedKey);

      // This is decrypting the user-provided email auth bundle using the locally stored target embedded key
      decryptedData = decryptCredentialBundle(
        data.authBundle,
        parsed.privateKey
      );

      // Save the email auth bundle to local storage as well. This can be reused in order for the
      // end user to avoid having to email auth repeatedly
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

    // The decrypted credential is an API keypair that can be used to authenticate Turnkey requests
    setTurnkeyPrivateKey(decryptedData);
    setTurnkeyPublicKey(getPublicKeyFromPrivateKeyHex(decryptedData));

    alert("Credential bundle injected from user input!");
  };

  const createWallet = async (data: CreateWalletFormData) => {
    const turnkeyClient = new Turnkey({
      apiBaseUrl: "https://api.turnkey.com",
      apiPublicKey: turnkeyPublicKey,
      apiPrivateKey: turnkeyPrivateKey,
      defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    // Get whoami response for suborg
    const whoamiResponse = await turnkeyClient.apiClient().getWhoami({
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    const orgID = whoamiResponse.organizationId;

    const response = await turnkeyClient.apiClient().createWallet({
      organizationId: orgID,
      walletName: data.walletName,
      accounts: [
        {
          curve: "CURVE_SECP256K1",
          pathFormat: "PATH_FORMAT_BIP32",
          path: "m/44'/60'/0'/0/0",
          addressFormat: "ADDRESS_FORMAT_ETHEREUM",
        },
      ],
    });

    const walletId = refineNonNull(response.walletId);
    const address = refineNonNull(response.addresses[0]);

    alert(`SUCCESS! New address ${address} created for wallet ${walletId}`);
  };

  const handleInjectLocallyStoredBundle = () => {
    let decryptedData;
    try {
      const embeddedKey = getItemWithExpiry(TURNKEY_EMBEDDED_KEY);
      const parsedKey = JSON.parse(embeddedKey);

      const localCredentialBundle = getItemWithExpiry(
        TURNKEY_CREDENTIAL_BUNDLE
      );

      // This is decrypting the locally stored email auth bundle using the locally stored target embedded key
      decryptedData = decryptCredentialBundle(
        localCredentialBundle,
        parsedKey.privateKey
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

    // The decrypted credential is an API keypair that can be used to authenticate Turnkey requests
    setTurnkeyPrivateKey(decryptedData);
    setTurnkeyPublicKey(getPublicKeyFromPrivateKeyHex(decryptedData));
    setUseLocalBundle(true);

    alert("Credential bundle injected from localStorage!");
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

      {targetPublicKey && authResponse === null && !useLocalBundle && (
        <div>
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
              Suborg ID (Optional — if not provided, attempt for standalone
              parent org)
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
              Encryption Target (from Local Storage):
              <br />
              <code title={targetPublicKey!}>
                {targetPublicKey!.substring(0, 30)}...
              </code>
            </label>

            <input className={styles.button} type="submit" value="Auth" />
          </form>

          <label className={styles.label}>OR...</label>

          <form className={styles.form}>
            {" "}
            <button
              className={styles.button}
              type="submit"
              onClick={handleInjectLocallyStoredBundle}
            >
              Use Locally Stored Credential Bundle
            </button>
          </form>
        </div>
      )}

      {targetPublicKey && (authResponse !== null || useLocalBundle) && (
        <div>
          <form
            className={styles.form}
            onSubmit={injectCredentialsFormSubmit(injectCredentials)}
          >
            <label className={styles.label}>
              Auth Bundle {useLocalBundle ? "From Local Storage" : ""}
              <input
                defaultValue={getItemWithExpiry(TURNKEY_CREDENTIAL_BUNDLE)}
                className={styles.input}
                {...injectCredentialsFormRegister("authBundle")}
                placeholder="Paste your auth bundle here"
              />
            </label>

            <input
              className={styles.button}
              type="submit"
              disabled={useLocalBundle}
              value={
                useLocalBundle ? "Bundle Already Injected" : "Inject Bundle"
              }
            />
          </form>
          <form
            className={styles.form}
            onSubmit={createWalletFormSubmit(createWallet)}
          >
            <label className={styles.label}>
              New Wallet Name
              <input
                className={styles.input}
                {...createWalletFormRegister("walletName")}
                placeholder="Wallet Name"
              />
            </label>

            <input
              className={styles.button}
              type="submit"
              value="Create Wallet"
            />
          </form>
        </div>
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
