import Image from "next/image";
import styles from "./index.module.css";
import { getWebAuthnAttestation, TurnkeyApi } from "@turnkey/http";
import { useForm } from "react-hook-form";
import axios from "axios";
import { buffer } from "stream/consumers";
import { useState } from "react";

type subOrgFormData = {
  orgName: string;
};

type privateKeyFormData = {
  privateKeyName: string;
};

const es256 = -7;
const publicKey = "public-key";

const generateRandomBuffer = (): ArrayBuffer => {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return arr.buffer;
};

export default function Home() {
  const [subOrgId, setSubOrgId] = useState<string | null>(null);
  const { register: subOrgFormRegister, handleSubmit: subOrgFormSubmit } =
    useForm<subOrgFormData>();
  const {
    register: privateKeyFormRegister,
    handleSubmit: privateKeyFormSubmit,
  } = useForm<privateKeyFormData>();

  const createPrivateKey = async (data: privateKeyFormData) => {
    if (!subOrgId) {
      throw new Error("sub org id id not found");
    }

    const federatedRequest = await TurnkeyApi.federatedPostCreatePrivateKeys({
      body: {
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS",
        organizationId: subOrgId,
        timestampMs: String(Date.now()),
        parameters: {
          privateKeys: [
            {
              privateKeyName: data.privateKeyName,
              curve: "CURVE_SECP256K1",
              addressFormats: ["ADDRESS_FORMAT_ETHEREUM"],
              privateKeyTags: [],
            },
          ],
        },
      },
    });

    await axios.post("/api/proxyRequest", federatedRequest);

    alert(`Hooray! Key ${data.privateKeyName} created.`);
  };

  const createSubOrg = async (data: subOrgFormData) => {
    const challenge = generateRandomBuffer();
    const authenticatorUserId = generateRandomBuffer();

    const attestation = await getWebAuthnAttestation({
      publicKey: {
        rp: {
          id: "localhost",
          name: "Turnkey WebaAuthn Demo",
        },
        challenge,
        pubKeyCredParams: [
          {
            type: publicKey,
            alg: es256,
          },
        ],
        user: {
          id: authenticatorUserId,
          name: data.orgName,
          displayName: data.orgName,
        },
      },
    });

    const res = await axios.post("/api/subOrg", {
      orgName: data.orgName,
      attestation,
      // The challenge must be base64 url encoded
      challenge: Buffer.from(challenge)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, ""),
    });

    setSubOrgId(res.data.subOrgId);
  };

  return (
    <main className={styles.main}>
      <a href="https://turnkey.io" target="_blank" rel="noopener noreferrer">
        <Image
          src="/logo.svg"
          alt="Turnkey Logo"
          className={styles.turnkeyLogo}
          width={100}
          height={24}
          priority
        />
      </a>
      {!subOrgId && (
        <div>
          <h2 className={styles.prompt}>
            First, we create a sub organization for the user:
          </h2>
          <form
            className={styles.form}
            onSubmit={subOrgFormSubmit(createSubOrg)}
          >
            <label className={styles.label}>
              Name
              <input
                className={styles.input}
                {...subOrgFormRegister("orgName")}
                placeholder="Your user's sub org"
              />
            </label>
            <input
              className={styles.button}
              type="submit"
              value="Create sub org"
            />
          </form>
        </div>
      )}
      {subOrgId && (
        <div>
          <h2 className={styles.prompt}>
            Next, we generate a key for the user using their credentials{" "}
          </h2>
          <form
            className={styles.form}
            onSubmit={privateKeyFormSubmit(createPrivateKey)}
          >
            <label className={styles.label}>
              Name
              <input
                className={styles.input}
                {...privateKeyFormRegister("privateKeyName")}
                placeholder="Your user's private key"
              />
            </label>
            <input className={styles.button} type="submit" value="Create key" />
          </form>
        </div>
      )}
    </main>
  );
}
