import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import Image from "next/image";
import styles from "./index.module.css";
import { useTurnkey } from "@turnkey/sdk-react";
import { useForm } from "react-hook-form";
import axios from "axios";
import * as React from "react";
import { useState, useEffect } from "react";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";

/**
 * Type definition for the server response coming back from /api/auth
 */
type AuthResponse = {
  session: any;
};

/**
 * Type definitions for the form data (client-side forms)
 */
type walletFormData = {
  walletName: string;
};

export default function AuthPage() {
  const [authResponse, setAuthResponse] = useState<AuthResponse | null>(null);
  const { indexedDbClient } = useTurnkey();

  const { register: walletFormRegister, handleSubmit: walletFormSubmit } =
    useForm<walletFormData>();

  const [pubKey, setPubKey] = useState<string | null>(null);
  const [nonce, setNonce] = useState<string | undefined>(undefined);

  useEffect(() => {
    const getKey = async () => {
      if (indexedDbClient) {
        await indexedDbClient.resetKeyPair();
        const key = await indexedDbClient.getPublicKey();
        setPubKey(key);
        setNonce(bytesToHex(sha256(key!)));
      }
    };
    getKey();
  }, [indexedDbClient]);

  const handleGoogleLogin = async (response: any) => {
    let targetSubOrgId: string;

    if (!pubKey) throw new Error("Public key not available");

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
    await auth(response.credential, targetSubOrgId, pubKey);
  };

  const auth = async (
    oidcCredential: string,
    suborgID: string,
    pubKey: string,
  ) => {
    const response = await axios.post("/api/auth", {
      suborgID,
      publicKey: pubKey!,
      oidcToken: oidcCredential,
    });

    const session = response.data.session;

    setAuthResponse(session);
  };

  const wallet = async (data: walletFormData) => {
    if (indexedDbClient === null) {
      throw new Error("indexedDbClient client is null");
    }
    if (authResponse === null) {
      throw new Error("authResponse is null");
    }

    // get whoami for suborg
    const whoamiResponse = await indexedDbClient!.getWhoami({
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    const orgID = whoamiResponse.organizationId;

    const createWalletResponse = await indexedDbClient!.createWallet({
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
    console.log(address);

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

      {!indexedDbClient && <p>Loading...</p>}

      {indexedDbClient && pubKey && authResponse === null && (
        <form className={styles.form}>
          <GoogleOAuthProvider
            clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}
          >
            <GoogleLogin
              nonce={nonce}
              onSuccess={handleGoogleLogin}
              useOneTap
            />
          </GoogleOAuthProvider>
        </form>
      )}

      {indexedDbClient && pubKey && authResponse !== null && (
        <form className={styles.form} onSubmit={walletFormSubmit(wallet)}>
          <label className={styles.label}>
            New wallet name
            <input
              className={styles.input}
              {...walletFormRegister("walletName")}
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
  errorMessage?: string,
): T {
  if (input == null) {
    throw new Error(errorMessage ?? `Unexpected ${JSON.stringify(input)}`);
  }

  return input;
}
