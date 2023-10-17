import Image from "next/image";
import styles from "./index.module.css";
import { getWebAuthnAttestation, TurnkeyClient } from "@turnkey/http";
import { IframeStamper } from "@turnkey/iframe-stamper";
import { useForm } from "react-hook-form";
import axios from "axios";
import * as React from "react";
import { useState } from "react";
import { Recovery } from "@/components/Recovery";

/**
 * Type definition for the server response coming back from `/api/initRecovery`
 */
type InitRecoveryResponse = {
  userId: string;
  organizationId: string;
};

/**
 * Type definitions for the form data (client-side forms)
 */
type RecoverUserFormData = {
  recoveryBundle: string;
  authenticatorName: string;
};
type InitRecoveryFormData = {
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

export default function RecoveryPage() {
  const [initRecoveryResponse, setInitRecoveryResponse] =
    useState<InitRecoveryResponse | null>(null);
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(
    null
  );
  const {
    register: initRecoveryFormRegister,
    handleSubmit: initRecoveryFormSubmit,
  } = useForm<InitRecoveryFormData>();
  const {
    register: recoverUserFormRegister,
    handleSubmit: recoverUserFormSubmit,
  } = useForm<RecoverUserFormData>();

  const initRecovery = async (data: InitRecoveryFormData) => {
    if (iframeStamper === null) {
      throw new Error("cannot initialize recovery without an iframe");
    }

    const response = await axios.post("/api/initRecovery", {
      email: data.email,
      targetPublicKey: iframeStamper.publicKey(),
    });
    setInitRecoveryResponse(response.data);
  };

  const recoverUser = async (data: RecoverUserFormData) => {
    if (iframeStamper === null) {
      throw new Error("iframeStamper is null");
    }
    if (initRecoveryResponse === null) {
      throw new Error("initRecoveryResponse is null");
    }

    let injected = await iframeStamper.injectRecoveryBundle(
      data.recoveryBundle
    );
    if (injected !== true) {
      throw new Error("unexpected error while injecting recovery bundle");
    }

    const challenge = generateRandomBuffer();
    const authenticatorUserId = generateRandomBuffer();

    // An example of possible options can be found here:
    // https://www.w3.org/TR/webauthn-2/#sctn-sample-registration
    const attestation = await getWebAuthnAttestation({
      publicKey: {
        authenticatorSelection: {
          residentKey: "preferred",
          requireResidentKey: false,
          userVerification: "preferred",
        },
        rp: {
          id: "localhost",
          name: "Turnkey Federated Passkey Demo",
        },
        challenge,
        pubKeyCredParams: [
          { type: publicKey, alg: es256 },
          { type: publicKey, alg: rs256 },
        ],
        user: {
          id: authenticatorUserId,
          name: data.authenticatorName,
          displayName: data.authenticatorName,
        },
      },
    });

    const client = new TurnkeyClient(
      {
        baseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
      },
      iframeStamper
    );

    // TODO: switch this to be `client.recoverUser`!
    // Similar in spirit though, we're adding a new authenticator.
    const response = await client.createAuthenticators({
      type: "ACTIVITY_TYPE_CREATE_AUTHENTICATORS_V2",
      timestampMs: String(Date.now()),
      organizationId: initRecoveryResponse.organizationId,
      parameters: {
        userId: initRecoveryResponse.userId,
        authenticators: [
          {
            authenticatorName: data.authenticatorName,
            challenge: base64UrlEncode(challenge),
            attestation: attestation,
          },
        ],
      },
    });

    // TODO: error handling goes here
    // We do not yet have passkey-friendly pollers
    // There is an interesting edge case here: if we poll using the recovery credential, it will fail as soon as the activity is successful!
    console.log(response);

    // Instead of simply alerting, redirect the user to your app's login page.
    alert("SUCCESS! Authenticator added. Recovery flow complete.");
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

      <Recovery
        setIframeStamper={setIframeStamper}
        iframeUrl={process.env.NEXT_PUBLIC_RECOVERY_IFRAME_URL!}
        turnkeyBaseUrl={process.env.NEXT_PUBLIC_BASE_URL!}
      ></Recovery>

      {!iframeStamper && <p>Loading...</p>}

      {iframeStamper &&
        iframeStamper.publicKey() &&
        initRecoveryResponse === null && (
          <form
            className={styles.form}
            onSubmit={initRecoveryFormSubmit(initRecovery)}
          >
            <label className={styles.label}>
              Email
              <input
                className={styles.input}
                {...initRecoveryFormRegister("email")}
                placeholder="Email"
              />
            </label>
            <label className={styles.label}>
              Encryption Target from iframe:<br/>
              <code title={iframeStamper.publicKey()!}>{iframeStamper.publicKey()!.substring(0,30)}...</code>
            </label>

            <input
              className={styles.button}
              type="submit"
              value="Start Recovery"
            />
          </form>
        )}

      {iframeStamper &&
        iframeStamper.publicKey() &&
        initRecoveryResponse !== null && (
          <form
            className={styles.form}
            onSubmit={recoverUserFormSubmit(recoverUser)}
          >
            <label className={styles.label}>
              Recovery Bundle
              <input
                className={styles.input}
                {...recoverUserFormRegister("recoveryBundle")}
                placeholder="Paste your recovery bundle here"
              />
            </label>
            <label className={styles.label}>
              New authenticator name
              <input
                className={styles.input}
                {...recoverUserFormRegister("authenticatorName")}
                placeholder="Authenticator Name"
              />
            </label>

            <input className={styles.button} type="submit" value="Recover" />
          </form>
        )}
    </main>
  );
}
