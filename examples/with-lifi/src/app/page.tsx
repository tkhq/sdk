"use client";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import { useEffect, useState } from "react";
import { useBalance } from "wagmi";
import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
} from "@solana/web3.js";
import { createAccount } from "@turnkey/viem";
import { TurnkeySigner } from "@turnkey/solana";
import {
  Account,
  createWalletClient,
  formatEther,
  http,
  parseEther,
  WalletClient,
} from "viem";
import { mainnet } from "viem/chains";
import { getQuote, getStatus, QuoteParams, StatusParams } from "./actions/lifi";

function LoginButton() {
  const { handleLogin } = useTurnkey();

  return (
    <button
      className="w-full mt-6 bg-black hover:bg-gray-800 text-white font-semibold py-4 rounded-xl transition-all active:scale-98"
      onClick={handleLogin}
    >
      Login / Sign Up
    </button>
  );
}

function LogoutButton() {
  const { logout } = useTurnkey();

  const handleLogout = () => {
    logout();
  };

  return (
    <button
      className="w-full mt-6 bg-red-500 hover:bg-red-400 text-white font-semibold py-4 rounded-xl transition-all active:scale-98"
      onClick={handleLogout}
    >
      Log out
    </button>
  );
}

function SolIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 256 256"
    >
      <linearGradient
        id="a"
        x1="44.9"
        x2="211.4"
        y1="43.8"
        y2="214.8"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#00FFA3" />
        <stop offset="1" stopColor="#DC1FFF" />
      </linearGradient>
      <path
        fill="url(#a)"
        d="M64.2 163.6a4.5 4.5 0 0 1 3.2-1.3h159.4a2.5 2.5 0 0 1 1.8 4.2l-36.5 38.3a4.5 4.5 0 0 1-3.2 1.3H29.5a2.5 2.5 0 0 1-1.8-4.2zm0-109.2A4.5 4.5 0 0 1 67.4 53h159.4a2.5 2.5 0 0 1 1.8 4.2l-36.5 38.3a4.5 4.5 0 0 1-3.2 1.3H29.5a2.5 2.5 0 0 1-1.8-4.2zm0 54.6a4.5 4.5 0 0 1 3.2-1.3h159.4a2.5 2.5 0 0 1 1.8 4.2l-36.5 38.3a4.5 4.5 0 0 1-3.2 1.3H29.5a2.5 2.5 0 0 1-1.8-4.2z"
      />
    </svg>
  );
}

function EthIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 256 256"
    >
      <linearGradient
        id="ethGradient"
        x1="44.9"
        x2="211.4"
        y1="43.8"
        y2="214.8"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#627EEA" />
        <stop offset="1" stopColor="#8A92B2" />
      </linearGradient>
      <g fill="url(#ethGradient)">
        <path fillOpacity="0.6" d="M128 20L50 128l78 46.5L206 128z" />
        <path fillOpacity="0.8" d="M128 20v94.5L206 128z" />
        <path fillOpacity="0.6" d="M128 184.5L50 138.5 128 236z" />
        <path d="M128 236l78-97.5-78 46z" />
      </g>
    </svg>
  );
}

export default function BridgePage() {
  const { httpClient, session, fetchWalletAccounts, wallets } = useTurnkey();
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [fromToken, setFromToken] = useState<"SOL" | "ETH">("ETH");
  const [toToken, setToToken] = useState<"SOL" | "ETH">("SOL");
  const [ethAddress, setEthAddress] = useState<string | undefined>(undefined);
  const [solAddress, setSolAddress] = useState<string | undefined>(undefined);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [swapButtonText, setSwapButtonText] = useState("Please login");
  const [viemWalletClient, setViemWalletClient] = useState<
    WalletClient | undefined
  >(undefined);
  const [swapButtonDisabled, setSwapButtonDisabled] = useState(true);
  const [viemAccount, setViemAccount] = useState<Account | undefined>(
    undefined,
  );
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [ethSwapHash, setEthSwapHash] = useState("");
  const [solSwapHash, setSolSwapHash] = useState("");
  const [transactionRequest, setTransactionRequest] = useState<
    any | undefined
  >();
  const [turnkeySolanaSigner, setTurnkeySolanaSigner] = useState<
    TurnkeySigner | undefined
  >(undefined);

  // public providers, you might want to use a dedicated provider like alchemy or infura in production
  const ETH_MAINNET_RPC_PROVIDER = "https://ethereum-rpc.publicnode.com";
  const SOL_MAINNET_RPC_PROVIDER = "https://solana-rpc.publicnode.com";

  // "fake" addresses to be used as the receiving address, so that quotes can be received without having to log in
  const USDC_SEPOLIA_TOKEN_ADDRESS =
    "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const SOL_USDC_TOKEN_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

  useEffect(() => {
    const getWalletAccounts = async () => {
      if (wallets.length == 0) {
        return;
      }

      try {
        // obtain a users turnkey wallets
        const walletAccountResponse = await fetchWalletAccounts({
          wallet: wallets[0],
        });
        setEthAddress(walletAccountResponse[0].address);
        setSolAddress(walletAccountResponse[1].address);

        // create a viem account with the turnkey wallet
        const turnkeyAccount = await createAccount({
          client: httpClient!,
          organizationId: walletAccountResponse[0].organizationId,
          signWith: walletAccountResponse[0].address,
          ethereumAddress: walletAccountResponse[0].address,
        });
        setViemAccount(turnkeyAccount as Account);

        // create a viem wallet client for signing transactions + approvals
        setViemWalletClient(
          createWalletClient({
            account: turnkeyAccount as Account,
            chain: mainnet,
            transport: http(ETH_MAINNET_RPC_PROVIDER),
          }),
        );

        // create a Turnkey Solana signer
        const turnkeySolSigner = new TurnkeySigner({
          organizationId: walletAccountResponse[0].organizationId,
          client: httpClient!,
        });

        setTurnkeySolanaSigner(turnkeySolSigner);

        setSwapButtonDisabled(false);
        setSwapButtonText("Swap");
      } catch (e: any) {
        setEthAddress(undefined);
        setSolAddress(undefined);
        setViemWalletClient(undefined);
      }
    };

    getWalletAccounts();
  }, [wallets, session]);

  // get the users SOL balance with @solana/web3.js
  useEffect(() => {
    const getBalance = async () => {
      if (!solAddress) return;

      const connection = new Connection(SOL_MAINNET_RPC_PROVIDER);
      const publicKey = new PublicKey(solAddress);

      const balanceInLamports = await connection.getBalance(publicKey);

      setSolBalance(balanceInLamports);
    };

    getBalance();
  }, [solAddress, fromToken, swapping]);

  // get the users ETH balance with wagmi
  const ethBalance = useBalance({
    address: ethAddress as `0x${string}`,
    query: {
      enabled: !!ethAddress,
    },
  });

  const handleFlip = async () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  function solToLamports(sol: string | number): number {
    return Math.floor(Number(sol) * LAMPORTS_PER_SOL);
  }

  function lamportsToSol(lamports: number): number {
    return lamports / LAMPORTS_PER_SOL;
  }

  const handleFromAmountChange = async (value: string) => {
    setFromAmount(value);

    try {
      if (
        solBalance &&
        ethBalance?.data &&
        (fromToken === "ETH" ? parseEther(value) : solToLamports(value)) >
          (fromToken === "ETH" ? ethBalance?.data.value : solBalance)
      ) {
        setSwapButtonText("Insufficient Balance");
        setSwapButtonDisabled(true);
      } else if (!solBalance) {
        setSwapButtonText("Please log in");
        setSwapButtonDisabled(false);
      } else {
        setSwapButtonText("Swap");
        setSwapButtonDisabled(false);
      }

      // get an initial price to display to the user
      const quoteParams: QuoteParams = {
        fromChain: fromToken === "ETH" ? "ETH" : "SOL",
        toChain: toToken === "ETH" ? "ETH" : "SOL",
        fromToken: fromToken === "ETH" ? "ETH" : "SOL",
        toToken: toToken === "ETH" ? "ETH" : "SOL",
        fromAmount:
          fromToken === "ETH"
            ? parseEther(value).toString()
            : solToLamports(value).toString(),
        fromAddress:
          fromToken === "ETH"
            ? ethAddress
              ? ethAddress
              : USDC_SEPOLIA_TOKEN_ADDRESS // use a random address as the fromAddress just so the price can be seen without logging in
            : solAddress
              ? solAddress
              : SOL_USDC_TOKEN_ADDRESS, // use a random address as the fromAddress just so the price can be seen without logging in
        toAddress:
          toToken === "ETH"
            ? ethAddress
              ? ethAddress
              : USDC_SEPOLIA_TOKEN_ADDRESS // use a random address as the toAddress just so the price can be seen without logging in
            : solAddress
              ? solAddress
              : SOL_USDC_TOKEN_ADDRESS, // use a random address as the toAddress just so the price can be seen without logging in
      };

      const getPriceResponse = await getQuote(quoteParams);

      setTransactionRequest(getPriceResponse.transactionRequest);
      setToAmount(
        toToken === "ETH"
          ? formatEther(getPriceResponse.estimate.toAmount)
          : lamportsToSol(getPriceResponse.estimate.toAmount).toString(),
      );
    } catch (e: any) {
      setToAmount("0.0");
    }
  };

  const handleSwap = async () => {
    setSwapModalOpen(true);
    setSwapping(true);
    setToAmount("");
    setFromAmount("");

    let statusParams: StatusParams = {
      txHash: "",
    };

    if (fromToken === "ETH") {
      // construct the ETH transaction to send for the bridge
      const sendTransactionResponse = await viemWalletClient?.sendTransaction({
        to: transactionRequest.to,
        value: transactionRequest.value,
        data: transactionRequest.data,
        chain: mainnet,
        account: viemAccount!,
      });

      setEthSwapHash(sendTransactionResponse!);
      statusParams.txHash = sendTransactionResponse as string;
    } else if (fromToken === "SOL") {
      // construct the SOL transaction to send for the bridge
      const txBuffer = Buffer.from(transactionRequest.data, "base64");
      const hexTransaction = VersionedTransaction.deserialize(
        new Uint8Array(txBuffer),
      );

      await turnkeySolanaSigner?.addSignature(hexTransaction, solAddress!);

      const connection = new Connection(SOL_MAINNET_RPC_PROVIDER);
      const signature = await connection.sendTransaction(hexTransaction, {
        skipPreflight: true,
      });

      setSolSwapHash(signature);
      statusParams.txHash = signature;
    } else {
      return;
    }

    // poll the status of the bridge with LiFi
    while (true) {
      const getStatusResponse = await getStatus(statusParams);

      if (getStatusResponse.status == "DONE") {
        if (fromToken === "ETH") {
          setSolSwapHash(getStatusResponse.receiving.txHash);
          console.log(getStatusResponse.receiving.txHash);
        } else if (fromToken === "SOL") {
          setEthSwapHash(getStatusResponse.receiving.txHash);
        }
        setSwapping(false);

        // stay on the success page containing links to the confirmed transactions for 5 seconds
        const timer = setTimeout(() => {
          setSwapModalOpen(false);
        }, 5000);
        break;
      }

      // sleep for 2 seconds before re-checking the status of the bridge
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  };

  return (
    <main className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col gap-4">
        {!session ? <LoginButton /> : <LogoutButton />}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          {/* Header */}
          <h1 className="text-2xl font-bold text-black mb-6">Swap</h1>

          {/* From Section */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">You pay</span>
              {session && solBalance && ethBalance?.data && (
                <span className="text-sm text-gray-600">
                  Balance:{" "}
                  {fromToken === "SOL"
                    ? lamportsToSol(solBalance).toString()
                    : ethBalance.data?.formatted}{" "}
                  {fromToken}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={fromAmount}
                onChange={(e) => handleFromAmountChange(e.target.value)}
                placeholder="0.00"
                className="bg-transparent text-3xl font-semibold text-black outline-none flex-1 min-w-0 placeholder:text-gray-300"
              />
              <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200 flex-shrink-0">
                <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold">
                  {fromToken === "SOL" ? <SolIcon /> : <EthIcon />}
                </div>
                <span className="text-black font-semibold">{fromToken}</span>
              </div>
            </div>
          </div>

          {/* Flip Button */}
          <div className="flex justify-center -my-3 relative z-10">
            <button
              onClick={handleFlip}
              className="bg-white hover:bg-gray-50 border-4 border-white rounded-xl p-2 transition-all hover:scale-110 active:scale-95 shadow-sm ring-1 ring-gray-200"
            >
              <svg
                className="w-5 h-5 text-black"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                />
              </svg>
            </button>
          </div>

          {/* To Section */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">You receive</span>
              {session && solBalance && ethBalance?.data && (
                <span className="text-sm text-gray-600">
                  Balance:{" "}
                  {toToken === "SOL"
                    ? lamportsToSol(solBalance).toString()
                    : ethBalance.data?.formatted}{" "}
                  {toToken}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={toAmount}
                readOnly
                placeholder="0.00"
                className="bg-transparent text-3xl font-semibold text-black outline-none flex-1 min-w-0 placeholder:text-gray-300"
              />
              <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200 flex-shrink-0">
                <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold">
                  {toToken === "SOL" ? <SolIcon /> : <EthIcon />}
                </div>
                <span className="text-black font-semibold">{toToken}</span>
              </div>
            </div>
          </div>

          {/* Swap Button */}
          <button
            disabled={swapButtonDisabled}
            onClick={handleSwap}
            className="w-full mt-6 bg-black hover:bg-gray-800 text-white font-semibold py-4 rounded-xl transition-all active:scale-98"
          >
            {swapButtonText}
          </button>
        </div>
      </div>

      {swapModalOpen && (
        <div className="absolute inset-0 bg-white bg-opacity-95 backdrop-blur-sm rounded-2xl flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-6 p-8">
            {swapping ? (
              <>
                {/* Loading Spinner */}
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                </div>

                {/* Loading Text */}
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-black mb-1">
                    Sending transaction...
                  </h2>
                  <p className="text-sm text-gray-600">
                    Please wait while your bridge is confirmed
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="relative w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-10 h-10 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>

                {/* Success Text */}
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-black mb-1">
                    Bridge successful
                  </h2>
                  <p className="text-sm text-gray-600">
                    Your transaction has been completed
                  </p>
                  <a
                    href={`https://etherscan.io/tx/${ethSwapHash}`}
                    target="_blank"
                    className="text-sm text-blue-600"
                  >
                    ETH Confirmation
                  </a>
                  <br />
                  <a
                    href={`https://solscan.io/tx/${solSwapHash}`}
                    target="_blank"
                    className="text-sm text-blue-600"
                  >
                    SOL Confirmation
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
