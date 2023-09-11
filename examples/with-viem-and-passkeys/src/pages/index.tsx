import Image from "next/image";
import styles from "./index.module.css";
import { getWebAuthnAttestation, TurnkeyClient } from "@turnkey/http";
import { createAccount } from "@turnkey/viem";
import { useForm } from "react-hook-form";
import axios from "axios";
import { WebauthnStamper } from "@turnkey/webauthn-stamper";
import { useState } from "react";
import { createWalletClient, http } from "viem";
import { sepolia } from "viem/chains";

type subOrgFormData = {
  subOrgName: string;
};

type privateKeyFormData = {
  privateKeyName: string;
};

type signingFormData = {
  messageToSign: string;
};

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

type TPrivateKeyState = {
  id: string;
  address: string;
} | null;

type TSignedMessage = {
  message: string;
  signature: string;
} | null;

const humanReadableDateTime = (): string => {
  return new Date().toLocaleString().replaceAll("/", "-").replaceAll(":", ".");
};

export default function Home() {
  const [subOrgId, setSubOrgId] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<TPrivateKeyState>(null);
  const [signedMessage, setSignedMessage] = useState<TSignedMessage>(null);

  const { handleSubmit: subOrgFormSubmit } = useForm<subOrgFormData>();
  const { register: signingFormRegister, handleSubmit: signingFormSubmit } =
    useForm<signingFormData>();
  const { handleSubmit: privateKeyFormSubmit } = useForm<privateKeyFormData>();
  const { register: _loginFormRegister, handleSubmit: loginFormSubmit } =
    useForm();

  const stamper = new WebauthnStamper({
    rpId: "localhost",
  });

  const passkeyHttpClient = new TurnkeyClient(
    {
      baseUrl: process.env.NEXT_PUBLIC_TURNKEY_API_BASE_URL!,
    },
    stamper
  );

  const createPrivateKey = async () => {
    if (!subOrgId) {
      throw new Error("sub-org id not found");
    }

    const signedRequest = await passkeyHttpClient.stampCreatePrivateKeys({
      type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
      organizationId: subOrgId,
      timestampMs: String(Date.now()),
      parameters: {
        privateKeys: [
          {
            privateKeyName: `ETH Key ${Math.floor(Math.random() * 1000)}`,
            curve: "CURVE_SECP256K1",
            addressFormats: ["ADDRESS_FORMAT_ETHEREUM"],
            privateKeyTags: [],
          },
        ],
      },
    });

    const response = await axios.post("/api/createKey", signedRequest);

    setPrivateKey({
      id: response.data["privateKeyId"],
      address: response.data["address"],
    });
  };

  const signMessage = async (data: signingFormData) => {
    if (!subOrgId || !privateKey) {
      throw new Error("sub-org id or private key not found");
    }

    const viemAccount = await createAccount({
      client: passkeyHttpClient,
      organizationId: subOrgId,
      privateKeyId: privateKey.id,
      ethereumAddress: privateKey.address,
    });

    const viemClient = createWalletClient({
      account: viemAccount,
      chain: sepolia,
      transport: http(),
    });

    const signedMessage = await viemClient.signMessage({
      message: data.messageToSign,
    });

    setSignedMessage({
      message: data.messageToSign,
      signature: signedMessage,
    });
  };

  const createSubOrg = async () => {
    const challenge = generateRandomBuffer();
    const subOrgName = `Turnkey Viem+Passkey Demo - ${humanReadableDateTime()}`;
    const authenticatorUserId = generateRandomBuffer();

    const attestation = await getWebAuthnAttestation({
      publicKey: {
        rp: {
          id: "localhost",
          name: "Turnkey Viem Passkey Demo",
        },
        challenge,
        pubKeyCredParams: [
          {
            type: "public-key",
            // All algorithms can be found here: https://www.iana.org/assignments/cose/cose.xhtml#algorithms
            // Turnkey only supports ES256 at the moment.
            alg: -7,
          },
        ],
        user: {
          id: authenticatorUserId,
          name: subOrgName,
          displayName: subOrgName,
        },
      },
    });

    const res = await axios.post("/api/createSubOrg", {
      subOrgName: subOrgName,
      attestation,
      challenge: base64UrlEncode(challenge),
    });

    setSubOrgId(res.data.subOrgId);
  };

  const login = async () => {
    // We use the parent org ID, which we know at all times,
    const res = await passkeyHttpClient.getWhoami({
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });
    // to get the sub-org ID, which we don't know at this point because we don't
    // have a DB. Note that we are able to perform this lookup by using the
    // credential ID from the users WebAuthn stamp.
    setSubOrgId(res.organizationId);
  };

  return (
    <main className={styles.main}>
      <a href="https://turnkey.com" target="_blank" rel="noopener noreferrer">
        <Image
          src="/logo.svg"
          alt="Turnkey Logo"
          className={styles.turnkeyLogo}
          width={100}
          height={24}
          priority
        />
      </a>
      <div>
        {subOrgId && (
          <div className={styles.info}>
            Your sub-org ID: <br />
            <span className={styles.code}>{subOrgId}</span>
          </div>
        )}
        {privateKey && (
          <div className={styles.info}>
            ETH address: <br />
            <span className={styles.code}>{privateKey.address}</span>
          </div>
        )}
        {signedMessage && (
          <div className={styles.info}>
            Message: <br />
            <span className={styles.code}>{signedMessage.message}</span>
            <br />
            <br />
            Signature: <br />
            <span className={styles.code}>{signedMessage.signature}</span>
            <br />
            <br />
            <a
              href="https://etherscan.io/verifiedSignatures"
              target="_blank"
              rel="noopener noreferrer"
            >
              Verify with Etherscan
            </a>
          </div>
        )}
      </div>
      {!subOrgId && (
        <div>
          <h2>First, create a new sub-organization</h2>
          <p className={styles.explainer}>
            We&apos;ll prompt your browser to create a new passkey. The details
            (credential ID, authenticator data, client data, attestation) will
            be used to create a new{" "}
            <a
              href="https://docs.turnkey.com/getting-started/sub-organizations"
              target="_blank"
              rel="noopener noreferrer"
            >
              Turnkey Sub-Organization
            </a>
            .
            <br />
            <br />
            This request to Turnkey will be created and signed by the backend
            API key pair.
          </p>
          <form
            className={styles.form}
            onSubmit={subOrgFormSubmit(createSubOrg)}
          >
            <input
              className={styles.button}
              type="submit"
              value="Create new passkey & sub-org"
            />
          </form>
          <br />
          <br />
          <h2>Already created a sub-organization? Log back in</h2>
          <p className={styles.explainer}>
            Based on the parent organization ID and a stamp from your passkey
            used to created the sub-organization, we can look up your
            sug-organization using the{" "}
            <a
              href="https://docs.turnkey.com/api#tag/Who-am-I"
              target="_blank"
              rel="noopener noreferrer"
            >
              Whoami endpoint.
            </a>
          </p>
          <form className={styles.form} onSubmit={loginFormSubmit(login)}>
            <input
              className={styles.button}
              type="submit"
              value="Login to sub-org with existing passkey"
            />
          </form>
        </div>
      )}
      {subOrgId && !privateKey && (
        <div>
          <h2>Next, create a new Ethereum address using your passkey </h2>
          <p className={styles.explainer}>
            We will sign the key creation request (
            <a
              href="https://docs.turnkey.com/api#tag/Private-Keys/operation/PublicApiService_CreatePrivateKeys"
              target="_blank"
              rel="noopener noreferrer"
            >
              /public/v1/submit/create_private_keys
            </a>
            ) with your passkey, and forward it to Turnkey through the NextJS
            backend.
            <br />
            <br />
            This ensures we can safely poll for activity completion and handle
            errors.
          </p>
          <form
            className={styles.form}
            onSubmit={privateKeyFormSubmit(createPrivateKey)}
          >
            <input
              className={styles.button}
              type="submit"
              value="Create ETH address"
            />
          </form>
        </div>
      )}
      {subOrgId && privateKey && (
        <div>
          <h2>Now let&apos;s sign something!</h2>
          <p className={styles.explainer}>
            We&apos;ll use a{" "}
            <a
              href="https://viem.sh/docs/accounts/custom.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              Viem custom account
            </a>{" "}
            to do this, using{" "}
            <a
              href="https://www.npmjs.com/package/@turnkey/viem"
              target="_blank"
              rel="noopener noreferrer"
            >
              @turnkey/viem
            </a>
            . You can kill your NextJS server if you want, everything happens on
            the client-side!
          </p>
          <form
            className={styles.form}
            onSubmit={signingFormSubmit(signMessage)}
          >
            <input
              className={styles.input}
              {...signingFormRegister("messageToSign")}
              placeholder="Write something to sign..."
            />
            <input
              className={styles.button}
              type="submit"
              value="Sign Message"
            />
          </form>
        </div>
      )}
    </main>
  );
}
