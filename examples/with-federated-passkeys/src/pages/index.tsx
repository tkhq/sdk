import Image from "next/image";
import styles from "./index.module.css";
import { getWebAuthnAttestation, TurnkeyClient } from "@turnkey/http";
import { WebauthnStamper } from "@turnkey/webauthn-stamper";
import { useForm } from "react-hook-form";
import axios from "axios";
import * as React from "react";

type subOrgFormData = {
  subOrgName: string;
};

type privateKeyFormData = {
  privateKeyName: string;
};

type privateKeyResult = {
  privateKeyId: string;
  privateKeyName: string;
  privateKeyAddress: string;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

export default function Home() {
  const [subOrgId, setSubOrgId] = React.useState<string | null>(null);
  const [privateKeys, setPrivateKeys] = React.useState<privateKeyResult[]>([]);
  const { register: subOrgFormRegister, handleSubmit: subOrgFormSubmit } =
    useForm<subOrgFormData>();
  const {
    register: privateKeyFormRegister,
    handleSubmit: privateKeyFormSubmit,
  } = useForm<privateKeyFormData>();

  const getPrivateKeys = async (organizationId: string) => {
    const res = await axios.post("/api/getPrivateKeys", { organizationId });

    setPrivateKeys(res.data.privateKeys);
  };

  const { register: _loginFormRegister, handleSubmit: loginFormSubmit } =
    useForm();

  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.NEXT_PUBLIC_BASE_URL! },
    new WebauthnStamper({
      rpId: "localhost",
    })
  );

  const createPrivateKey = async (data: privateKeyFormData) => {
    if (!subOrgId) {
      throw new Error("sub-org id not found");
    }

    const signedRequest = await turnkeyClient.stampCreatePrivateKeys({
      type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
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
    });

    await axios.post("/api/proxyRequest", signedRequest);
    await sleep(1000); // alternative would be to poll the activity itself repeatedly
    await getPrivateKeys(subOrgId);
    alert(`Hooray! Key "${data.privateKeyName}" created.`);
  };

  const createSubOrg = async (data: subOrgFormData) => {
    const challenge = generateRandomBuffer();
    const authenticatorUserId = generateRandomBuffer();

    // An example of possible options can be found here:
    // https://www.w3.org/TR/webauthn-2/#sctn-sample-registration
    const attestation = await getWebAuthnAttestation({
      publicKey: {
         authenticatorSelection: {
          residentKey: "preferred",
          requireResidentKey: false,
          userVerification: "preferred"
        },
        rp: {
          id: "localhost",
          name: "Turnkey Federated Passkey Demo",
        },
        challenge,
        pubKeyCredParams: [
          {
            type: publicKey,
            alg: es256,
          },
          {
            type: publicKey,
            alg: rs256,
          },
        ],
        user: {
          id: authenticatorUserId,
          name: data.subOrgName,
          displayName: data.subOrgName,
        },
      },
    });

    const res = await axios.post("/api/createSubOrg", {
      subOrgName: data.subOrgName,
      attestation,
      challenge: base64UrlEncode(challenge),
    });

    setSubOrgId(res.data.subOrgId);
    setPrivateKeys([
      ...privateKeys,
      {
        privateKeyId: res.data.privateKeyId,
        privateKeyName: res.data.privateKeyName,
        privateKeyAddress: res.data.privateKeyAddress,
      },
    ]);
  };

  const privateKeysTable = (
    <div className={styles.baseTable}>
      <table className={styles.table}>
        <tbody>
          <tr>
            <th className={styles.th}>Name</th>
            <th className={styles.th}>Address</th>
          </tr>
          {privateKeys.map((val, key) => {
            return (
              <tr key={key}>
                <td className={styles.td}>{val.privateKeyName}</td>
                <td className={styles.td}>{val.privateKeyAddress}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const privateKeyElements = privateKeys.map((pk) => (
    <li key={pk.privateKeyId} className={styles.prompt}>
      {pk.privateKeyAddress}
    </li>
  ));

  const login = async () => {
    // We use the parent org ID, which we know at all times,
    const res = await turnkeyClient.getWhoami({
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });
    // to get the sub-org ID, which we don't know at this point because we don't
    // have a DB. Note that we are able to perform this lookup by using the
    // credential ID from the users WebAuthn stamp.
    setSubOrgId(res.organizationId);

    await getPrivateKeys(res.organizationId);
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
      {!subOrgId && (
        <div className={styles.base}>
          <h2 className={styles.prompt}>
            First, create your sub-organization:
          </h2>
          <form
            className={styles.form}
            onSubmit={subOrgFormSubmit(createSubOrg)}
          >
            <label className={styles.label}>
              Name
              <input
                className={styles.input}
                {...subOrgFormRegister("subOrgName")}
                placeholder="Sub-Organization Name"
              />
            </label>
            <input
              className={styles.button}
              type="submit"
              value="Create new sub-organization"
            />
          </form>
          <br />
          <br />
          <h2 className={styles.prompt}>
            OR already created a sub-org? Login!
          </h2>
          <form className={styles.form} onSubmit={loginFormSubmit(login)}>
            <input
              className={styles.button}
              type="submit"
              value="Log back into your sub-organization"
            />
          </form>
        </div>
      )}
      {subOrgId && privateKeys.length === 1 && (
        <div className={styles.base}>
          <h2 className={styles.prompt}>
            🚀🥳🎉 Hooray! Here's your first private key address:
          </h2>
          {privateKeyElements}
        </div>
      )}
      {subOrgId && privateKeys.length > 1 && (
        <div className={styles.base}>
          <h2 className={styles.prompt}>
            🚀🥳🎉 Hooray! Here are your private keys:
          </h2>
          {privateKeysTable}
        </div>
      )}
      {subOrgId && (
        <div className={styles.base}>
          <h2 className={styles.prompt}>
            👀 Want more? Create another using your passkey{" "}
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
                placeholder="Private Key Name"
              />
            </label>
            <input
              className={styles.button}
              type="submit"
              value="Create new private key"
            />
          </form>
        </div>
      )}
    </main>
  );
}
