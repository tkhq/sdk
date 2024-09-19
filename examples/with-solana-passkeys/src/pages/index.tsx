import {
  PublicKey,
  Transaction,
  VersionedTransaction,
  MessageV0,
  VersionedMessage,
  TransactionInstruction,
} from "@solana/web3.js";
import Image from "next/image";
import { useForm } from "react-hook-form";
import axios from "axios";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { useState, useEffect } from "react";

import styles from "./index.module.css";
import { TWalletDetails } from "../types";

import { useTurnkey } from "@turnkey/sdk-react";
import { TurnkeySigner } from "@turnkey/solana";
import { recentBlockhash } from "@/utils";
import { TransactionMessage } from "@solana/web3.js";
import { SystemProgram } from "@solana/web3.js";
import { TSignedTransaction } from "./api/signTransaction";

type subOrgFormData = {
  subOrgName: string;
};

type signMessageFormData = {
  messageToSign: string;
};

type signTransactionFormData = {
  // signerAddress: string;
  destinationAddress: string;
  amount: string;
  // transaction: Transaction;
};

type TWalletState = TWalletDetails | null;

type TSignedTransactionState = Transaction | VersionedTransaction | null;

type TSignedMessage = {
  message: string;
  base58Signature: string;
  base64Signature: string;
  rawSignature: string;
} | null;

const base64Encode = (payload: ArrayBuffer): string =>
  Buffer.from(payload).toString("base64");

const humanReadableDateTime = (): string => {
  return new Date().toLocaleString().replaceAll("/", "-").replaceAll(":", ".");
};

export default function Home() {
  const { turnkey, passkeyClient } = useTurnkey();

  // Wallet is used as a proxy for logged-in state
  const [wallet, setWallet] = useState<TWalletState>(null);
  const [signedMessage, setSignedMessage] = useState<TSignedMessage>(null);
  const [signedTransaction, setSignedTransaction] =
    useState<TSignedTransactionState>(null);

  const { handleSubmit: subOrgFormSubmit } = useForm<subOrgFormData>();
  const {
    register: signMessageFormRegister,
    handleSubmit: signMessageFormSubmit,
  } = useForm<signMessageFormData>();
  const {
    register: signTransactionFormRegister,
    handleSubmit: signTransactionFormSubmit,
  } = useForm<signTransactionFormData>({
    defaultValues: {
      destinationAddress: "tkhqC9QX2gkqJtUFk2QKhBmQfFyyqZXSpr73VFRi35C",
    },
  });
  const { register: _loginFormRegister, handleSubmit: loginFormSubmit } =
    useForm();

  // First, logout user if there is no current wallet set
  useEffect(() => {
    (async () => {
      if (!wallet) {
        await turnkey?.logoutUser();
      }
    })();
  });

  const signMessage = async (data: signMessageFormData) => {
    if (!wallet) {
      throw new Error("wallet not found");
    }

    const turnkeySigner = new TurnkeySigner({
      organizationId: wallet.subOrgId,
      client: passkeyClient!,
    });

    const messageAsUint8Array = Buffer.from(data.messageToSign);

    const signedMessage = await turnkeySigner.signMessage(
      messageAsUint8Array,
      wallet.address
    );

    const base58EncodedSignature = bs58.encode(signedMessage);
    const base64EncodedSignature = base64Encode(signedMessage);
    const rawSignature = Buffer.from(signedMessage).toString("hex");

    setSignedMessage({
      message: data.messageToSign,
      base58Signature: base58EncodedSignature,
      base64Signature: base64EncodedSignature,
      rawSignature,
    });
  };

  const signTransaction = async (data: signTransactionFormData) => {
    if (!wallet) {
      throw new Error("wallet not found");
    }

    const turnkeySigner = new TurnkeySigner({
      organizationId: wallet.subOrgId,
      client: passkeyClient!,
    });

    // const fromKey = new PublicKey(wallet.address);
    // const toKey = new PublicKey(data.destinationAddress);
    // const blockhash = await recentBlockhash();

    // create transaction on the backend
    // const txMessage = new TransactionMessage({
    //   payerKey: fromKey,
    //   recentBlockhash: blockhash,
    //   instructions: [
    //     SystemProgram.transfer({
    //       fromPubkey: fromKey,
    //       toPubkey: toKey,
    //       lamports: Number(data.amount),
    //     }),
    //   ],
    // });

    // const versionedTxMessage = txMessage.compileToV0Message();
    // const transferTransaction = new VersionedTransaction(versionedTxMessage);

    // console.log("client transaction", transferTransaction);

    const blockhash = await recentBlockhash();

    // separate stuff TEMP
    const txMessage = new TransactionMessage({
      payerKey: new PublicKey(wallet.address),
      recentBlockhash: blockhash,
      instructions: [
        SystemProgram.transfer({
          fromPubkey: new PublicKey(wallet.address),
          toPubkey: new PublicKey(wallet.address),
          lamports: Number(data.amount),
        }),
      ],
    });

    const versionedTxMessage = txMessage.compileToV0Message();
    console.log("just the message", txMessage);
    const freshTx = new VersionedTransaction(versionedTxMessage);
    console.log("freshtx message", freshTx.message);
    console.log("freshtx serialize", freshTx.message.serialize());

    // END TEMP

    // request backend to sign
    const res = await axios.post("/api/signTransaction", {
      fromAddress: wallet.address,
      destinationAddress: data.destinationAddress,
      amount: data.amount,
    });

    console.log("res", res);

    const {
      txMessage: freshTxMessageCopy,
      transaction,
      message,
      signatures,
      serializedTransaction,
    } = res.data as TSignedTransaction;
    console.log("res data", res.data);
    console.log("transaction", transaction);
    console.log("serializedTransaction", serializedTransaction);

    freshTxMessageCopy.payerKey = new PublicKey(freshTxMessageCopy.payerKey);
    // convert nested public keys to PublicKey objects

    const freshTxMessage = Object.assign({}, freshTxMessageCopy); // clone
    for (let i = 0; i < freshTxMessageCopy.instructions.length; i++) {
      let instruction = freshTxMessageCopy.instructions[i];

      freshTxMessage.instructions[i] = new TransactionInstruction(instruction);

      for (let j = 0; j < freshTxMessage.instructions[i].keys.length; j++) {
        freshTxMessage.instructions[i].keys[j].pubkey = new PublicKey(
          instruction.keys[j].pubkey
        );
      }

      freshTxMessage.instructions[i].programId = new PublicKey(instruction.programId);
    }

    // const reconstructedMessage = new MessageV0(message);
    console.log("freshtx message", freshTxMessage);
    console.log("new txmessage", new TransactionMessage(freshTxMessage));
    const reconstructedMessage = new TransactionMessage(
      freshTxMessage
    ).compileToV0Message();

    // const resultingMessage = VersionedMessage.deserialize(message);
    const reconstructedTransaction = new VersionedTransaction(
      reconstructedMessage,
      signatures
    );

    console.log("reconstructedTransaction", reconstructedTransaction);
    console.log(
      "reconstructedTransaction.message",
      reconstructedTransaction.message
    );
    console.log(
      "reconstructedTransaction.message.serialize()",
      reconstructedTransaction.message.serialize()
    );

    // let txMsg = TransactionMessage
    // let tx = transaction as VersionedTransaction;
    // tx.message = new MessageV0(tx.message)
    // console.log('tx', tx)
    // console.log('tx.message', tx.message)
    // console.log('tx.message.serialize', tx.message.serialize())

    // add user signature
    await turnkeySigner.addSignature(reconstructedTransaction, wallet.address);

    setSignedTransaction(reconstructedTransaction);
  };

  const createSubOrgAndWallet = async () => {
    const subOrgName = `Turnkey Solana + Passkey Demo - ${humanReadableDateTime()}`;
    const credential = await passkeyClient?.createUserPasskey({
      publicKey: {
        rp: {
          id: "localhost",
          name: "Turnkey Solana Passkey Demo",
        },
        user: {
          name: subOrgName,
          displayName: subOrgName,
        },
      },
    });

    if (!credential?.encodedChallenge || !credential?.attestation) {
      return false;
    }

    const res = await axios.post("/api/createSubOrg", {
      subOrgName: subOrgName,
      challenge: credential?.encodedChallenge,
      attestation: credential?.attestation,
    });

    const response = res.data as TWalletDetails;
    setWallet(response);
  };

  const login = async () => {
    try {
      // Initiate login (read-only passkey session)
      const loginResponse = await passkeyClient?.login();
      if (!loginResponse?.organizationId) {
        return;
      }

      const currentUserSession = await turnkey?.currentUserSession();
      if (!currentUserSession) {
        return;
      }

      const walletsResponse = await currentUserSession?.getWallets();
      if (!walletsResponse?.wallets[0].walletId) {
        return;
      }

      const walletId = walletsResponse?.wallets[0].walletId;
      const walletAccountsResponse =
        await currentUserSession?.getWalletAccounts({
          organizationId: loginResponse?.organizationId,
          walletId,
        });
      if (!walletAccountsResponse?.accounts[0].address) {
        return;
      }

      setWallet({
        id: walletId,
        address: walletAccountsResponse?.accounts[0].address,
        subOrgId: loginResponse.organizationId,
      } as TWalletDetails);
    } catch (e: any) {
      const message = `caught error: ${e.toString()}`;
      console.error(message);
      alert(message);
    }
  };

  return (
    <main className={styles.main}>
      <a
        href="https://turnkey.com"
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
      <div>
        {wallet !== null && (
          <div className={styles.info}>
            Your sub-org ID: <br />
            <span className={styles.code}>{wallet.subOrgId}</span>
          </div>
        )}
        {wallet && (
          <div className={styles.info}>
            SOL address: <br />
            <span className={styles.code}>{wallet.address}</span>
          </div>
        )}
        {signedMessage && (
          <div className={styles.info}>
            Message: <br />
            <span className={styles.code}>{signedMessage.message}</span>
            <br />
            <br />
            Signature: <br />
            <span className={styles.code}>{signedMessage.base58Signature}</span>
          </div>
        )}
        {wallet && signedMessage && (
          <div className={styles.info}>
            Raw public key: <br />
            <span className={styles.code}>
              {base64Encode(bs58.decode(wallet.address))}
            </span>
            <br />
            <br />
            Signature (for verifying): <br />
            <span className={styles.code}>{signedMessage.base64Signature}</span>
            <br />
            <br />
            <a
              href="https://tweetnacl.js.org/#/sign"
              target="_blank"
              rel="noopener noreferrer"
            >
              Verify with tweetnacl
            </a>
          </div>
        )}
      </div>
      {!wallet && (
        <div>
          <h2>Create a new wallet</h2>
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
            </a>{" "}
            and a new{" "}
            <a
              href="https://docs.turnkey.com/getting-started/wallets"
              target="_blank"
              rel="noopener noreferrer"
            >
              Wallet
            </a>{" "}
            within it.
            <br />
            <br />
            This request to Turnkey will be created and signed by the backend
            API key pair.
          </p>
          <form
            className={styles.form}
            onSubmit={subOrgFormSubmit(createSubOrgAndWallet)}
          >
            <input
              className={styles.button}
              type="submit"
              value="Create new wallet"
            />
          </form>
          <br />
          <br />
          <h2>Already created your wallet? Log back in</h2>
          <p className={styles.explainer}>
            Based on the parent organization ID and a stamp from your passkey
            used to created the sub-organization and wallet, we can look up your
            sub-organization using the{" "}
            <a
              href="https://docs.turnkey.com/api#tag/Who-am-I"
              target="_blank"
              rel="noopener noreferrer"
            >
              Whoami endpoint.
            </a>
          </p>
          <form
            className={styles.form}
            onSubmit={loginFormSubmit(login)}
          >
            <input
              className={styles.button}
              type="submit"
              value="Login to sub-org with existing passkey"
            />
          </form>
        </div>
      )}
      {wallet && (
        <div>
          <h2>Now let&apos;s sign a message!</h2>
          <p className={styles.explainer}>
            We&apos;ll use a{" "}
            <a
              href="https://solana.com/docs/clients/javascript"
              target="_blank"
              rel="noopener noreferrer"
            >
              Solana web3js account
            </a>{" "}
            to do this, using{" "}
            <a
              href="https://www.npmjs.com/package/@turnkey/solana"
              target="_blank"
              rel="noopener noreferrer"
            >
              @turnkey/solana
            </a>
            .
          </p>
          <form
            className={styles.form}
            onSubmit={signMessageFormSubmit(signMessage)}
          >
            <input
              className={styles.input}
              {...signMessageFormRegister("messageToSign")}
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
      {wallet && (
        <div>
          <h2>... and now let&apos;s sign a transaction!</h2>
          <form
            className={styles.form}
            onSubmit={signTransactionFormSubmit(signTransaction)}
          >
            <input
              className={styles.input}
              {...signTransactionFormRegister("amount")}
              placeholder="Amount (Lamports)"
            />
            <input
              className={styles.input}
              {...signTransactionFormRegister("destinationAddress")}
            />
            <input
              className={styles.button}
              type="submit"
              value="Sign and Broadcast Transaction"
            />
          </form>
        </div>
      )}
    </main>
  );
}
