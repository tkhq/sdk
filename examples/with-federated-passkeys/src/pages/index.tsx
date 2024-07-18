import Image from "next/image";
import styles from "./index.module.css";
import { useForm } from "react-hook-form";
import axios from "axios";
import * as React from "react";
import { useTurnkey } from "@turnkey/sdk-react";
import { CreateSubOrgResponse, TFormattedWallet } from "@/app/types";
import { getNextPath } from "@/app/util";

type subOrgFormData = {
  userEmail: string;
  subOrgName: string;
};

type walletAccountFormData = {
  path: string;
};

export default function Home() {
  const { turnkey, passkeyClient } = useTurnkey();

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

  const createWalletAccount = async (data: walletAccountFormData) => {
    if (subOrgId === null) {
      throw new Error("sub-org id not found");
    }
    if (wallet === null) {
      throw new Error("wallet not found");
    }

    try {
      const walletAccountsResult = await passkeyClient!.createWalletAccounts({
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
    const { encodedChallenge: challenge, attestation } =
      await passkeyClient!.createUserPasskey();

    const res = await axios.post("/api/createSubOrg", {
      userEmail: data.userEmail,
      subOrgName: data.subOrgName,
      attestation,
      challenge,
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
    try {
      const res = await passkeyClient!.login();
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
            <label className={styles.label}>
              Email
              <input
                className={styles.input}
                {...subOrgFormRegister("userEmail")}
                placeholder="User Email"
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
