"use client";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import { useEffect, useState } from "react";
import { useBalance } from "wagmi";
import { createAccount } from "@turnkey/viem";
import {
  Account,
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatEther,
  formatUnits,
  getContract,
  http,
  maxUint256,
  parseEther,
  parseUnits,
  PublicClient,
  WalletClient,
} from "viem";
import { mainnet } from "viem/chains";
import { getChains, getPrice, getQuote, PriceParams } from "./actions/0x";

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

export default function SwapPage() {
  const { httpClient, session, fetchWalletAccounts, wallets } = useTurnkey();
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [fromToken, setFromToken] = useState<"USDC" | "ETH">("ETH");
  const [toToken, setToToken] = useState<"USDC" | "ETH">("USDC");
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [swapButtonText, setSwapButtonText] = useState("Please login");
  const [viemWalletClient, setViemWalletClient] = useState<
    WalletClient | undefined
  >(undefined);
  const [viemPublicClient, setViemPublicClient] = useState<
    PublicClient | undefined
  >(undefined);
  const [swapButtonDisabled, setSwapButtonDisabled] = useState(true);
  const [viemAccount, setViemAccount] = useState<Account | undefined>(
    undefined,
  );
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [swapHash, setSwapHash] = useState("");

  const ETH_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  const USDC_MAINNET_TOKEN_ADDRESS =
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
  const USDC_SEPOLIA_TOKEN_ADDRESS =
    "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  // public provider, you might want to use a dedicated provider like alchemy or infura in production
  const MAINNET_RPC_PROVIDER = "https://ethereum-rpc.publicnode.com";
  // the allowance holder contract address more here: https://0x.org/docs/0x-swap-api/advanced-topics/how-to-set-your-token-allowances
  const MAINNET_0X_ALLOWANCE_HOLDER_ADDRESS =
    "0x0000000000001fF3684f28c67538d4D072C22734";

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
        setAddress(walletAccountResponse[0].address);

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
            transport: http(MAINNET_RPC_PROVIDER),
          }),
        );

        // create a public client for querying the blockchain without signing
        setViemPublicClient(
          createPublicClient({
            chain: mainnet,
            transport: http(MAINNET_RPC_PROVIDER),
          }),
        );

        setSwapButtonDisabled(false);
        setSwapButtonText("Swap");
      } catch (e: any) {
        setAddress(undefined);
        setViemWalletClient(undefined);
        setViemPublicClient(undefined);
      }
    };

    getWalletAccounts();
  }, [wallets, session]);

  // get the users USDC balance with wagmi
  const usdcBalance = useBalance({
    address: address as `0x${string}`,
    token: USDC_MAINNET_TOKEN_ADDRESS,
    query: {
      enabled: !!address,
    },
  });

  // get the users ETH balance with wagmi
  const ethBalance = useBalance({
    address: address as `0x${string}`,
    query: {
      enabled: !!address,
    },
  });

  const handleFlip = async () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const handleFromAmountChange = async (value: string) => {
    setFromAmount(value);

    try {
      if (
        usdcBalance?.data &&
        ethBalance?.data &&
        (fromToken === "ETH" ? parseEther(value) : parseUnits(value, 6)) >
          (fromToken === "ETH"
            ? ethBalance?.data.value
            : usdcBalance?.data?.value)
      ) {
        setSwapButtonText("Insufficient Balance");
        setSwapButtonDisabled(true);
      } else if (!usdcBalance?.data) {
        setSwapButtonText("Please log in");
        setSwapButtonDisabled(false);
      } else {
        setSwapButtonText("Swap");
        setSwapButtonDisabled(false);
      }

      // get an initial price to display to the user
      const priceParams: PriceParams = {
        chainId: mainnet.id.toString(),
        sellToken:
          fromToken === "ETH" ? ETH_TOKEN_ADDRESS : USDC_MAINNET_TOKEN_ADDRESS,
        buyToken:
          fromToken === "ETH" ? USDC_MAINNET_TOKEN_ADDRESS : ETH_TOKEN_ADDRESS,
        sellAmount:
          fromToken === "ETH"
            ? parseEther(value).toString()
            : parseUnits(value, 6).toString(),
        taker: address
          ? (address as `0x${string}`)
          : USDC_SEPOLIA_TOKEN_ADDRESS, // use a random address as the taker just so the price can be seen without logging in
      };

      const getPriceResponse = await getPrice(priceParams);
      setToAmount(
        toToken === "ETH"
          ? formatEther(getPriceResponse.buyAmount)
          : formatUnits(getPriceResponse.buyAmount, 6),
      );
      // setConversionRate(fromToken === 'ETH' ? Number(parseUnits(formatUnits(resp.buyAmount, 0), 0) / parseEther(value)) : Number(parseUnits(value, 6) / resp.buyAmount as bigint));
    } catch (e: any) {
      setToAmount("0.0");
    }
  };

  const handleSwap = async () => {
    setSwapModalOpen(true);
    setSwapping(true);
    setToAmount("");
    setFromAmount("");
    // handle approval for USDC contract: https://0x.org/docs/0x-swap-api/advanced-topics/how-to-set-your-token-allowances
    if (fromToken === "USDC") {
      const currentAllowance = await viemPublicClient?.readContract({
        address: USDC_MAINNET_TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address as `0x${string}`, MAINNET_0X_ALLOWANCE_HOLDER_ADDRESS],
      });

      // check if allowance is greater than the requested swap amount
      if (!currentAllowance || currentAllowance < parseUnits(fromAmount, 6)) {
        // update allowance if its too little
        const approveAllowanceHash = await viemWalletClient?.writeContract({
          address: USDC_MAINNET_TOKEN_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [MAINNET_0X_ALLOWANCE_HOLDER_ADDRESS, maxUint256], //setting the allowance to max int, but can set it to parseUnits(fromAmount, 6) to approve exactly the desired amount for this transaction
          chain: mainnet,
          account: viemAccount!,
        });

        // wait for the approval to be successful
        const receipt = await viemPublicClient!.waitForTransactionReceipt({
          hash: approveAllowanceHash!,
        });
      }
    }

    // request a firm quote
    const quoteParams: PriceParams = {
      chainId: mainnet.id.toString(),
      sellToken:
        fromToken === "ETH" ? ETH_TOKEN_ADDRESS : USDC_MAINNET_TOKEN_ADDRESS,
      buyToken:
        fromToken === "ETH" ? USDC_MAINNET_TOKEN_ADDRESS : ETH_TOKEN_ADDRESS,
      sellAmount:
        fromToken === "ETH"
          ? parseEther(fromAmount).toString()
          : parseUnits(fromAmount, 6).toString(),
      taker: address as `0x${string}`,
    };

    const getQuoteResponse = await getQuote(quoteParams);

    // sign/submit swap transaction with viemWalletClient
    const sendTransactionResponse = await viemWalletClient?.sendTransaction({
      to: getQuoteResponse?.transaction.to,
      data: getQuoteResponse?.transaction.data,
      value: getQuoteResponse?.transaction.value
        ? BigInt(getQuoteResponse.transaction.value)
        : undefined,
      account: viemAccount!,
      chain: mainnet,
    });
    setSwapHash(sendTransactionResponse!);

    const receipt = await viemPublicClient!.waitForTransactionReceipt({
      hash: sendTransactionResponse!,
    });
    setSwapping(false);

    // allow the successful modal to stay visible for 5 seconds
    const timer = setTimeout(() => {
      setSwapModalOpen(false);
    }, 5000);
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
              {session && usdcBalance?.data && ethBalance?.data && (
                <span className="text-sm text-gray-600">
                  Balance:{" "}
                  {fromToken === "USDC"
                    ? usdcBalance?.data.formatted
                    : ethBalance.data?.formatted}{" "}
                  {fromToken}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <input
                type="number"
                value={fromAmount}
                onChange={(e) => handleFromAmountChange(e.target.value)}
                placeholder="0.00"
                className="bg-transparent text-3xl font-semibold text-black outline-none flex-1 placeholder:text-gray-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className="flex items-center gap-2 bg-white rounded-lg px-4 py-2 border border-gray-200">
                <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold">
                  {fromToken === "USDC" ? "$" : "Ξ"}
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
              {session && usdcBalance?.data && ethBalance?.data && (
                <span className="text-sm text-gray-600">
                  Balance:{" "}
                  {toToken === "USDC"
                    ? usdcBalance?.data.formatted
                    : ethBalance.data?.formatted}{" "}
                  {toToken}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <input
                type="text"
                value={toAmount}
                readOnly
                placeholder="0.00"
                className="bg-transparent text-3xl font-semibold text-black outline-none flex-1 placeholder:text-gray-300"
              />
              <div className="flex items-center gap-2 bg-white rounded-lg px-4 py-2 border border-gray-200">
                <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold">
                  {toToken === "USDC" ? "$" : "Ξ"}
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
                    Please wait while your swap is confirmed
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
                    Swap successful
                  </h2>
                  <p className="text-sm text-gray-600">
                    Your transaction has been completed
                  </p>
                  <a
                    href={`https://etherscan.io/tx/${swapHash}`}
                    target="_blank"
                    className="text-sm text-blue-600"
                  >
                    Confirmation
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
