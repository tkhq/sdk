import axios from "axios";
import { useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";

import styles from "./index.module.css";

import { useTurnkey } from "@turnkey/sdk-react";

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

export default function RecoveryPage() {
  const { passkeyClient, authIframeClient } = useTurnkey();

  const [initRecoveryResponse, setInitRecoveryResponse] =
    useState<InitRecoveryResponse | null>(null);
  const {
    register: initRecoveryFormRegister,
    handleSubmit: initRecoveryFormSubmit,
  } = useForm<InitRecoveryFormData>();
  const {
    register: recoverUserFormRegister,
    handleSubmit: recoverUserFormSubmit,
  } = useForm<RecoverUserFormData>();

  const initRecovery = async (data: InitRecoveryFormData) => {
    if (authIframeClient === null) {
      throw new Error("cannot initialize recovery without an iframe");
    }

    const response = await axios.post("/api/initRecovery", {
      email: data.email,
      targetPublicKey: authIframeClient!.iframePublicKey!,
    });
    setInitRecoveryResponse(response.data);
  };

  const recoverUser = async (data: RecoverUserFormData) => {
    if (authIframeClient === null) {
      throw new Error("iframe client is null");
    }
    if (initRecoveryResponse === null) {
      throw new Error("initRecoveryResponse is null");
    }

    try {
      await authIframeClient!.injectCredentialBundle(data.recoveryBundle);
    } catch (e) {
      const msg = `error while injecting bundle: ${e}`;
      console.error(msg);
      alert(msg);
      return;
    }

    const { encodedChallenge, attestation } =
      await passkeyClient?.createUserPasskey({
        publicKey: {
          pubKeyCredParams: [
            { type: publicKey, alg: es256 },
            { type: publicKey, alg: rs256 },
          ],
          rp: {
            id: "localhost",
            name: "Turnkey Federated Passkey Demo",
          },
          user: {
            name: data.authenticatorName,
            displayName: data.authenticatorName,
          },
        },
      })!;

    const response = await authIframeClient!.recoverUser({
      organizationId: initRecoveryResponse.organizationId, // need to specify the suborg ID
      userId: initRecoveryResponse.userId,
      authenticator: {
        authenticatorName: data.authenticatorName,
        challenge: encodedChallenge,
        attestation,
      },
    });

    // There is an interesting edge case here: if we poll using the recovery credential,
    // it will fail as soon as the activity is successful!
    // I think there is a strategy we can implement potentially:
    // - assert that the status of the activity is "PENDING" or "COMPLETE". Anything else should be an error.
    // - on subsequent polls, assert that the status is "PENDING" or that an error "no user found for authenticator" is returned
    // When the error is returned it means the recovery has taken place (the recovery credential has been deleted from org data!)
    // Another solution is to poll this using a read-only API key, from the backend (proxying)
    console.log(response);

    // Instead of simply alerting, redirect the user to your app's login page.
    alert(
      "SUCCESS! Authenticator added. Recovery flow complete. Try logging back in!"
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

      {!authIframeClient && <p>Loading...</p>}

      {authIframeClient &&
        authIframeClient.iframePublicKey &&
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
              Encryption Target from iframe:
              <br />
              <code title={authIframeClient.iframePublicKey!}>
                {authIframeClient.iframePublicKey!.substring(0, 30)}...
              </code>
            </label>

            <input
              className={styles.button}
              type="submit"
              value="Start Recovery"
            />
          </form>
        )}

      {authIframeClient &&
        authIframeClient.iframePublicKey &&
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
