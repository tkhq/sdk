import Image from "next/image";
import styles from "./index.module.css";
import {
  Turnkey as TurnkeyBrowserSDK,
  TurnkeyPasskeyClient,
  getWebAuthnAttestation,
} from "@turnkey/sdk-browser";
import { useForm } from "react-hook-form";
import axios from "axios";
import * as React from "react";
import { useTurnkey } from "@turnkey/sdk-react";
import { CreateSubOrgResponse, TFormattedWallet } from "@/app/types";
import { getNextPath } from "@/app/util";

type subOrgFormData = {
  subOrgName: string;
};

type walletAccountFormData = {
  path: string;
};

type walletResult = {
  walletId: string;
  walletName: string;
  accounts: string;
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
  // TODO: useTurnkey
  // const { turnkey, passkeyClient, iframeClient } = useTurnkey();

  const [subOrgId, setSubOrgId] = React.useState<string | null>(null);
  const [wallet, setWallet] = React.useState<TFormattedWallet | null>(null);
  const { register: subOrgFormRegister, handleSubmit: subOrgFormSubmit } =
    useForm<subOrgFormData>();
  const {
    register: createWalletAccountFormRegister,
    handleSubmit: createWalletAccountFormSubmit,
  } = useForm<walletAccountFormData>();

  const getWallet = async (organizationId: string) => {
    const res = await axios.post("/api/getWallet", { organizationId });
    setWallet(res.data);
  };

  const { register: _loginFormRegister, handleSubmit: loginFormSubmit } =
    useForm();

  const turnkeyClient = new TurnkeyBrowserSDK({
    apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
    rpId: process.env.NEXT_PUBLIC_RPID!,
    defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
  });

  const createWalletAccount = async (data: walletAccountFormData) => {
    if (subOrgId === null) {
      throw new Error("sub-org id not found");
    }
    if (wallet === null) {
      throw new Error("wallet not found");
    }

    try {
      const walletAccountsResult = await turnkeyClient
        .passkeyClient()
        .createWalletAccounts({
          organizationId: subOrgId,
          walletId: wallet.id,
          accounts: [
            {
              path: data.path,
              pathFormat: "PATH_FORMAT_BIP32",
              curve: "CURVE_SECP256K1",
              addressFormat: "ADDRESS_FORMAT_ETHEREUM",
            },
          ],
        });

      await getWallet(subOrgId);
      alert(
        `Hooray! New address at path "${data.path}" created. Resulting address: ${walletAccountsResult.addresses[0]}`
      );
    } catch (e: any) {
      const message = `caught error: ${e.toString()}`;
      console.error(message);
      alert(message);
    }
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
          userVerification: "preferred",
        },
        rp: {
          id: process.env.NEXT_PUBLIC_RPID!,
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

    const subOrgResponse = res.data as CreateSubOrgResponse;

    setSubOrgId(subOrgResponse.subOrgId);
    setWallet(subOrgResponse.wallet);
  };

  const walletTable = (
    <table className={styles.table}>
      <tbody>
        <tr>
          <th className={styles.th}>Address</th>
          <th className={styles.th}>Path</th>
        </tr>
        {wallet?.accounts.map((account, key) => {
          return (
            <tr key={key}>
              <td className={styles.td}>{account.address}</td>
              <td className={styles.td}>{account.path}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const login = async () => {
    // We use the parent org ID, which we know at all times...
    try {
      const res = await turnkeyClient.passkeyClient().getWhoami({
        organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
      });

      // ...to get the sub-org ID, which we don't know at this point because we don't
      // have a DB. Note that we are able to perform this lookup by using the
      // credential ID from the users WebAuthn stamp.
      setSubOrgId(res.organizationId);
      await getWallet(res.organizationId);
    } catch (e: any) {
      const message = `Error caught during login: ${e.toString()}`;
      console.error(message);
      alert(message);
    }
  };

  return (
    <main className={styles.main}>
      <a
        href="https://turnkey.com"
        className={styles.logo}
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
      {!subOrgId && (
        <div className={styles.base}>
          <h2 className={styles.prompt}>Create your sub-organization:</h2>
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
      {subOrgId && wallet !== null && (
        <>
          <div className={styles.base}>
            <h2 className={styles.prompt}>
              🚀 🥳 🎉 <br />
              Success! Your wallet:
            </h2>
            {walletTable}
          </div>
          <div className={styles.base}>
            <h2 className={styles.prompt}>
              👀 👀 👀
              <br />
              Want more addresses? <br />
              Create another one using your passkey{" "}
            </h2>
            <form
              className={styles.form}
              onSubmit={createWalletAccountFormSubmit(createWalletAccount)}
            >
              <label className={styles.label}>
                Path
                <input
                  className={styles.input}
                  {...createWalletAccountFormRegister("path")}
                  defaultValue={getNextPath(wallet)}
                />
              </label>
              <input
                className={styles.button}
                type="submit"
                value="Create new address"
              />
            </form>
          </div>
        </>
      )}
    </main>
  );
}
