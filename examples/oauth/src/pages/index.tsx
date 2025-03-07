import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import Image from "next/image";
import styles from "./index.module.css";
import { useTurnkey } from "@turnkey/sdk-react";
import { useForm } from "react-hook-form";
import axios from "axios";
import * as React from "react";
import { useState } from "react";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";

/**
 * Type definition for the server response coming back from `/api/auth`
 */
type AuthResponse = {
  userId: string;
  apiKeyId: string;
  credentialBundle: string;
};

/**
 * Type definitions for the form data (client-side forms)
 */
type InjectCredentialsFormData = {
  walletName: string;
};
type AuthFormData = {
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

  const handleGoogleLogin = async (response: any) => {
    let targetSubOrgId: string;
    const getSuborgsResponse = await axios.post("api/getSuborgs", {
      filterType: "OIDC_TOKEN",
      filterValue: response.credential,
    });
    targetSubOrgId = getSuborgsResponse.data.organizationIds[0]; // If you don't have a 1:1 relationship for suborgs:oauthProviders you will need to manage this yourself in a database

    if (getSuborgsResponse.data.organizationIds.length == 0) {
      const createSuborgResponse = await axios.post("api/createSuborg", {
        oauthProviders: [
          { providerName: "Google-Test", oidcToken: response.credential },
        ],
      });
      targetSubOrgId = createSuborgResponse.data.subOrganizationId;
    }
    authFormSubmit((data) => auth(data, response.credential, targetSubOrgId))();
  };

  const auth = async (
    data: AuthFormData,
    oidcCredential: string,
    suborgID: string
  ) => {
    if (authIframeClient === null) {
      throw new Error("cannot initialize auth without an iframe");
    }
    const response = await axios.post("/api/auth", {
      suborgID,
      targetPublicKey: authIframeClient!.iframePublicKey!,
      oidcToken: oidcCredential,
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
      await authIframeClient!.injectCredentialBundle(
        authResponse.credentialBundle
      );
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
          <form className={styles.form}>
            <label className={styles.label}>
              Invalidate previously issued oauth authentication token(s)?
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

            <GoogleOAuthProvider
              clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}
            >
              <GoogleLogin
                nonce={bytesToHex(sha256(authIframeClient.iframePublicKey!))}
                onSuccess={handleGoogleLogin}
                useOneTap
              />
            </GoogleOAuthProvider>
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
