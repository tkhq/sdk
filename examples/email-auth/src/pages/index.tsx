import Image from "next/image";
import styles from "./index.module.css";
import { useTurnkey } from "@turnkey/sdk-react";
import { useForm } from "react-hook-form";
import axios from "axios";
import * as React from "react";
import { useState } from "react";

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

export default function AuthPage() {
  const [authResponse, setAuthResponse] = useState<AuthResponse | null>(null);
  const { authIframeClient } = useTurnkey();
  const { register: authFormRegister, handleSubmit: authFormSubmit } =
    useForm<AuthFormData>();
  const {
    register: injectCredentialsFormRegister,
    handleSubmit: injectCredentialsFormSubmit,
  } = useForm<InjectCredentialsFormData>();

  const auth = async (data: AuthFormData) => {
    if (authIframeClient === null) {
      throw new Error("cannot initialize auth without an iframe");
    }

    const response = await axios.post("/api/auth", {
      suborgID: data.suborgID,
      email: data.email,
      targetPublicKey: authIframeClient!.iframePublicKey,
      invalidateExisting: data.invalidateExisting,
    });

    setAuthResponse(response.data);
  };

  const injectCredentials = async (data: InjectCredentialsFormData) => {
    if (authIframeClient === null) {
      throw new Error("iframe client is null");
    }
    if (authResponse === null) {
      throw new Error("authResponse is null");
    }
    try {
      await authIframeClient!.injectCredentialBundle(data.authBundle);
    } catch (e) {
      const msg = `error while injecting bundle: ${e}`;
      console.error(msg);
      alert(msg);
      return;
    }

    // get whoami for suborg
    const whoamiResponse = await authIframeClient!.getWhoami({
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    const orgID = whoamiResponse.organizationId;

    const createWalletResponse = await authIframeClient!.createWallet({
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

    const address = refineNonNull(createWalletResponse.addresses[0]);

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

      {!authIframeClient && <p>Loading...</p>}

      {authIframeClient &&
        authIframeClient.iframePublicKey &&
        authResponse === null && (
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
              Encryption Target from iframe:
              <br />
              <code title={authIframeClient.iframePublicKey!}>
                {authIframeClient.iframePublicKey!.substring(0, 30)}...
              </code>
            </label>

            <input className={styles.button} type="submit" value="Auth" />
          </form>
        )}

      {authIframeClient &&
        authIframeClient.iframePublicKey &&
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

function refineNonNull<T>(
  input: T | null | undefined,
  errorMessage?: string
): T {
  if (input == null) {
    throw new Error(errorMessage ?? `Unexpected ${JSON.stringify(input)}`);
  }

  return input;
}
