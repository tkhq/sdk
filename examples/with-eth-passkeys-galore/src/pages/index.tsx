import Image from "next/image";
import { useForm } from "react-hook-form";
import axios from "axios";
import { useState, useEffect } from "react";
import { Account, createWalletClient, http, type WalletClient } from "viem";
import { ethers } from "ethers";
import { sepolia } from "viem/chains";
import {
  createSmartAccountClient,
  BiconomySmartAccountV2,
  PaymasterMode,
  LightSigner,
} from "@biconomy/account";

import { TurnkeySigner } from "@turnkey/ethers";
import { createAccount } from "@turnkey/viem";
import { useTurnkey } from "@turnkey/sdk-react";

import styles from "./index.module.css";
import { TWalletDetails } from "../types";

type subOrgFormData = {
  subOrgName: string;
};

type signMessageFormData = {
  messageToSign: string;
};

type signTransactionFormData = {
  destinationAddress: string;
  amount: string;
};

type TWalletState = TWalletDetails | null;

type TSignedMessage = {
  message: string;
  signature: string;
} | null;

const humanReadableDateTime = (): string => {
  return new Date().toLocaleString().replaceAll("/", "-").replaceAll(":", ".");
};

export default function Home() {
  const { turnkey, passkeyClient } = useTurnkey();

  // Wallet is used as a proxy for logged-in state
  const [wallet, setWallet] = useState<TWalletState>(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState<string>("");
  const [signedMessage, setSignedMessage] = useState<TSignedMessage>(null);
  const [signedTransaction, setSignedTransaction] = useState<string | null>(
    null
  );
  const [useViem, setUseViem] = useState(true);
  const [viemClient, setViemClient] = useState<WalletClient | null>(null);
  const [ethersClient, setEthersClient] = useState<TurnkeySigner | null>(null);

  const { handleSubmit: subOrgFormSubmit } = useForm<subOrgFormData>();
  const { register: signingFormRegister, handleSubmit: signingFormSubmit } =
    useForm<signMessageFormData>();
  const { register: _loginFormRegister, handleSubmit: loginFormSubmit } =
    useForm();
  const {
    register: signTransactionFormRegister,
    handleSubmit: signTransactionFormSubmit,
  } = useForm<signTransactionFormData>({
    defaultValues: {
      destinationAddress: "0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7",
    },
  });

  // First, logout user if there is no current wallet set
  useEffect(() => {
    (async () => {
      if (!wallet) {
        await turnkey?.logoutUser();
      }
    })();
  });

  useEffect(() => {
    const initializeClients = async () => {
      if (!wallet || !passkeyClient) return;

      let smartAccount;
      if (useViem) {
        const viemAccount = await createAccount({
          client: passkeyClient,
          organizationId: wallet.subOrgId,
          signWith: wallet.address,
          ethereumAddress: wallet.address,
        });

        const viemClient = createWalletClient({
          account: viemAccount as Account,
          chain: sepolia,
          transport: http(),
        });

        setViemClient(viemClient);

        smartAccount = await connectViemClient(viemClient);
      } else {
        const ethersClient = new TurnkeySigner({
          organizationId: wallet.subOrgId,
          client: passkeyClient,
          signWith: wallet.address,
        });

        const provider = new ethers.JsonRpcProvider(
          `https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`
        );

        const connectedSigner = ethersClient.connect(provider);

        setEthersClient(connectedSigner);

        smartAccount = await connectEthersClient(connectedSigner);
      }

      const smartAccountAddress = await smartAccount.getAccountAddress();
      setSmartAccountAddress(smartAccountAddress);
    };

    initializeClients();
  }, [wallet, passkeyClient, useViem]);

  // Connect a TurnkeySigner to a Biconomy Smart Account Client, defaulting to Sepolia
  const connectEthersClient = async (
    turnkeyClient: TurnkeySigner
  ): Promise<BiconomySmartAccountV2> => {
    try {
      const smartAccount = await createSmartAccountClient({
        signer: turnkeyClient as LightSigner,
        bundlerUrl: process.env.NEXT_PUBLIC_BICONOMY_BUNDLER_URL!, // <-- Read about this at https://docs.biconomy.io/dashboard#bundler-url
        biconomyPaymasterApiKey:
          process.env.NEXT_PUBLIC_BICONOMY_PAYMASTER_API_KEY!, // <-- Read about at https://docs.biconomy.io/dashboard/paymaster
        rpcUrl: `https://sepolia.infura.io/v3/${process.env
          .NEXT_PUBLIC_INFURA_KEY!}`, // <-- read about this at https://docs.biconomy.io/account/methods#createsmartaccountclient
        chainId: Number(sepolia.id),
      });

      return smartAccount;
    } catch (error: any) {
      throw new Error(error);
    }
  };

  // Connect a TurnkeySigner to a Biconomy Smart Account Client, defaulting to Sepolia
  const connectViemClient = async (
    turnkeyClient: WalletClient
  ): Promise<BiconomySmartAccountV2> => {
    try {
      const smartAccount = await createSmartAccountClient({
        signer: turnkeyClient,
        bundlerUrl: process.env.NEXT_PUBLIC_BICONOMY_BUNDLER_URL!, // <-- Read about this at https://docs.biconomy.io/dashboard#bundler-url
        biconomyPaymasterApiKey:
          process.env.NEXT_PUBLIC_BICONOMY_PAYMASTER_API_KEY!, // <-- Read about at https://docs.biconomy.io/dashboard/paymaster
        rpcUrl: `https://sepolia.infura.io/v3/${process.env
          .NEXT_PUBLIC_INFURA_KEY!}`, // <-- read about this at https://docs.biconomy.io/account/methods#createsmartaccountclient
        chainId: Number(sepolia.id),
      });

      return smartAccount;
    } catch (error: any) {
      throw new Error(error);
    }
  };

  const signMessage = async (data: signMessageFormData) => {
    if (!wallet) {
      throw new Error("wallet not found");
    }

    if (useViem) {
      if (!viemClient) throw new Error("viem client not initialized");
      await signMessageViem(data);
    } else {
      if (!ethersClient) throw new Error("ethers client not initialized");
      await signMessageEthers(data);
    }
  };

  const signMessageViem = async (data: signMessageFormData) => {
    const signedMessage = await viemClient!.signMessage({
      message: data.messageToSign,
      account: viemClient!.account!,
    });

    setSignedMessage({
      message: data.messageToSign,
      signature: signedMessage,
    });
  };

  const signMessageEthers = async (data: signMessageFormData) => {
    const signedMessage = await ethersClient!.signMessage(data.messageToSign);

    setSignedMessage({
      message: data.messageToSign,
      signature: signedMessage,
    });
  };

  const createSubOrgAndWallet = async () => {
    const subOrgName = `Turnkey ETH+Passkey Demo - ${humanReadableDateTime()}`;
    const credential = await passkeyClient?.createUserPasskey({
      publicKey: {
        rp: {
          id: "localhost",
          name: "Turnkey ETH Passkey Demo",
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

    if (passkeyClient && passkeyClient.config) {
      passkeyClient.config.organizationId = response.subOrgId;
    }
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

  const signTransactionWithAAClient = async (
    data: signTransactionFormData,
    getSmartAccount: (
      data: signTransactionFormData
    ) => Promise<BiconomySmartAccountV2>,
    options?: { nonceOptions?: { nonceKey: number } }
  ) => {
    const { destinationAddress, amount } = data;

    const smartAccount = await getSmartAccount(data);
    const transactionRequest = {
      to: destinationAddress,
      value: amount,
      type: 2,
    };

    const userOpResponse = await smartAccount?.sendTransaction(
      transactionRequest,
      {
        ...options,
        paymasterServiceData: { mode: PaymasterMode.SPONSORED },
      }
    );

    const { transactionHash } = await userOpResponse.waitForTxHash();

    setSignedTransaction(
      `https://v2.jiffyscan.xyz/tx/${transactionHash}?network=sepolia&pageNo=0&pageSize=10`
    );
  };

  const signTransactionWithClient = async (
    data: signTransactionFormData,
    client: WalletClient | TurnkeySigner,
    isViem: boolean
  ) => {
    const { destinationAddress, amount } = data;

    const transactionRequest = {
      to: destinationAddress as `0x${string}`,
      value: BigInt(amount),
      ...(isViem && {
        account: (client as WalletClient).account!,
        chain: sepolia,
      }),
    };

    const result = await client.sendTransaction({
      ...transactionRequest,
      chain: transactionRequest.chain,
      account: transactionRequest.account || null,
    });
    const txHash = isViem ? result : (result as any).hash;

    setSignedTransaction(`https://sepolia.etherscan.io/tx/${txHash}`);
  };

  const signTransactionWithProvider = async (
    data: signTransactionFormData,
    client: WalletClient | TurnkeySigner,
    isViem: boolean
  ) => {
    if (supportsAA()) {
      await signTransactionWithAAClient(
        data,
        async () =>
          isViem
            ? connectViemClient(client as WalletClient)
            : connectEthersClient(client as TurnkeySigner),
        { nonceOptions: { nonceKey: Number(0) } }
      );
    } else {
      await signTransactionWithClient(data, client, isViem);
    }
  };

  const signTransaction = async (data: signTransactionFormData) => {
    if (!wallet) {
      throw new Error("wallet not found");
    }

    await signTransactionWithProvider(
      data,
      useViem ? viemClient! : ethersClient!,
      useViem
    );
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
        {wallet && (
          <div className={styles.info}>
            Your sub-org ID: <br />
            <span className={styles.code}>{wallet.subOrgId}</span>
          </div>
        )}
        {wallet && (
          <div className={styles.info}>
            ETH signer address: <br />
            <span className={styles.code}>{wallet.address}</span>
          </div>
        )}
        {smartAccountAddress && (
          <div className={styles.info}>
            Smart account address: <br />
            <span className={styles.code}>{smartAccountAddress}</span>
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
          <form className={styles.form} onSubmit={loginFormSubmit(login)}>
            <input
              className={styles.button}
              type="submit"
              value="Login to sub-org with existing passkey"
            />
          </form>
        </div>
      )}
      {wallet !== null && (
        <div>
          <div className={styles.toggleContainer}>
            <button
              className={`${styles.toggleButton} ${
                useViem ? styles.active : ""
              }`}
              onClick={() => setUseViem(true)}
            >
              Viem
            </button>
            <button
              className={`${styles.toggleButton} ${
                !useViem ? styles.active : ""
              }`}
              onClick={() => setUseViem(false)}
            >
              Ethers
            </button>
          </div>
          <h2>Now let&apos;s sign something!</h2>
          {useViem ? (
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
              . You can kill your NextJS server if you want, everything happens
              on the client-side!
            </p>
          ) : (
            <p className={styles.explainer}>
              We&apos;ll use an{" "}
              <a
                href="https://docs.ethers.org/v6/api/providers/#Signer"
                target="_blank"
                rel="noopener noreferrer"
              >
                Ethers signer
              </a>{" "}
              to do this, using{" "}
              <a
                href="https://www.npmjs.com/package/@turnkey/ethers"
                target="_blank"
                rel="noopener noreferrer"
              >
                @turnkey/ethers
              </a>
              . You can kill your NextJS server if you want, everything happens
              on the client-side!
            </p>
          )}
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
              placeholder="Amount (wei)"
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
          {signedTransaction && (
            <div className={styles.info}>
              <p>
                🚀 Transaction broadcasted and confirmed!
                <br />
                <br />
                <a
                  href={signedTransaction}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {signedTransaction}
                </a>
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

const supportsAA = () => {
  return (
    process.env.NEXT_PUBLIC_BICONOMY_BUNDLER_URL &&
    process.env.NEXT_PUBLIC_BICONOMY_PAYMASTER_API_KEY
  );
};
