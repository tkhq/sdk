"use client";

import { useEffect, useRef, useState } from "react";
import { Button, RadioGroup, Radio } from "@headlessui/react";
import { useTurnkey, WalletAccount } from "@turnkey/react-wallet-kit";

import {
  FiatOnRampBlockchainNetwork,
  FiatOnRampCryptoCurrency,
  FiatOnRampCurrency,
  FiatOnRampPaymentMethod,
  FiatOnRampProvider,
} from "@turnkey/sdk-types";
import { loadMoonPay } from "@moonpay/moonpay-js";
import { CoinbaseSVG, MoonPaySVG } from "../Svg";
import { toast } from "react-toastify";

type FiatCurrency = {
  /** The identifier of the fiat currency */
  id: string;
  /** The human readable name of the currency such as "US Dollar" */
  name: string;
  /** The code of the currency such as "usd" */
  code: string;
};
/** Represents a Crypto currency such as ETH */
type CryptoCurrency = {
  /** The identifier of the crypto currency */
  id: string;
  /** The human readable name of the currency such as "Ethereum" */
  name: string;
  /** The code of the currency such as "eth" */
  code: string;
  /** The address location of the token contract on the blockchain */
  contractAddress: string | null;
  /** The chain's Chain ID */
  chainId: string | null;
  /** The coin type as defined in SLIP-0044 */
  coinType: string | null;
  /** The currency's network such as "bitcoin" or "ethereum" */
  networkCode: string | null;
};
type TransactionStatus =
  | "completed"
  | "failed"
  | "pending"
  | "waitingAuthorization"
  | "waitingPayment";

type OnTransactionCompletedProps = {
  /** The identifier of the transaction */
  id: string;
  /** When the transaction was created */
  createdAt: string;
  /** The base (fiat) currency */
  baseCurrency: FiatCurrency;
  /** The quote (crypto) currency */
  quoteCurrency: CryptoCurrency;
  /** The spent fiat amount */
  baseCurrencyAmount: number;
  /** The expected or received quote amount */
  quoteCurrencyAmount: number;
  /** The MoonPay fee amount, in the fiat currency */
  feeAmount: number;
  /** The partner's fee amount, in the fiat currency */
  extraFeeAmount: number;
  /** The network fees incurred in this transaction, in the fiat currency */
  networkFeeAmount: number;
  /** Whether the base currency amount includes fees */
  areFeesIncluded: boolean;
  /** The customer's destination wallet address */
  walletAddress: string;
  /** The customer's destination wallet address tag */
  walletAddressTag: string | null;
  /** The current status of the transaction */
  status: TransactionStatus;
};

type DisplayOption = "iframe" | "popup" | "new tab";
const displayOptions = ["iframe", "popup", "new tab"] as const;

export default function OnrampSelector({
  selectedWalletAccount,
}: {
  selectedWalletAccount: WalletAccount;
}) {
  const { initFiatOnramp, session } = useTurnkey();

  const [blockchainNetwork, setBlockchainNetwork] =
    useState<FiatOnRampBlockchainNetwork>(FiatOnRampBlockchainNetwork.ETHEREUM);
  const [cryptoCurrency, setCryptoCurrency] =
    useState<FiatOnRampCryptoCurrency>(FiatOnRampCryptoCurrency.ETHEREUM);
  const [cryptoCurrencyCode, setCryptoCurrencyCode] = useState<string>("eth");

  const [onrampDisplayOption, setOnrampDisplayOption] =
    useState<DisplayOption>("popup");

  useEffect(() => {
    console.log("Selected wallet account changed:", selectedWalletAccount);
    switch (selectedWalletAccount?.addressFormat) {
      case "ADDRESS_FORMAT_SOLANA":
        setBlockchainNetwork(FiatOnRampBlockchainNetwork.SOLANA);
        setCryptoCurrency(FiatOnRampCryptoCurrency.SOLANA);
        setCryptoCurrencyCode("sol");
        break;
      case "ADDRESS_FORMAT_BITCOIN_MAINNET_P2PKH":
      case "ADDRESS_FORMAT_BITCOIN_MAINNET_P2SH":
      case "ADDRESS_FORMAT_BITCOIN_MAINNET_P2WPKH":
      case "ADDRESS_FORMAT_BITCOIN_MAINNET_P2WSH":
      case "ADDRESS_FORMAT_BITCOIN_MAINNET_P2TR":
        setBlockchainNetwork(FiatOnRampBlockchainNetwork.BITCOIN);
        setCryptoCurrency(FiatOnRampCryptoCurrency.BITCOIN);
        setCryptoCurrencyCode("btc");
        break;
      case "ADDRESS_FORMAT_ETHEREUM":
      default:
        setBlockchainNetwork(FiatOnRampBlockchainNetwork.ETHEREUM);
        setCryptoCurrency(FiatOnRampCryptoCurrency.ETHEREUM);
        setCryptoCurrencyCode("eth");
        break;
    }
  }, []);

  // Controls whether the SDK container is visible
  const [showMoonpayIframe, setShowMoonpayIframe] = useState(false);
  const moonpaySdkRef = useRef<any>(null);

  const handleOnrampSuccess = async (payload: OnTransactionCompletedProps) => {
    console.log("Onramp success:", payload);
    toast.success("Onramp completed successfully!");
  };

  const handleOnrampError = async (errorMessage: string) => {
    console.log("Onramp error:", errorMessage);
    toast.error("Onramp failed. Please try again.");
  };

  const generateCoinbase = async () => {
    if (!session) {
      console.error("Session not found");
      return;
    }
    try {
      const res = await initFiatOnramp({
        organizationId: session.organizationId!,
        onrampProvider: FiatOnRampProvider.COINBASE,
        walletAddress: selectedWalletAccount.address,
        network: blockchainNetwork,
        cryptoCurrencyCode: cryptoCurrency,
        fiatCurrencyCode: FiatOnRampCurrency.USD,
        fiatCurrencyAmount: "10",
        paymentMethod: FiatOnRampPaymentMethod.CREDIT_DEBIT_CARD,
        countryCode: "US",
        countrySubdivisionCode: "ME",
        sandboxMode: true,
      });

      if (!res?.onRampUrl) return;

      if (onrampDisplayOption === "popup") {
        window.open(
          res.onRampUrl,
          "_blank",
          "popup,width=500,height=700,scrollbars=yes,resizable=yes"
        );
      } else if (onrampDisplayOption === "new tab") {
        window.open(res.onRampUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error("Failed to init Coinbase on-ramp:", err);
    }
  };

  const generateMoonPay = async () => {
    if (!session) {
      console.error("Session not found");
      return;
    }

    const baseRequest = {
      organizationId: session.organizationId!,
      onrampProvider: FiatOnRampProvider.MOONPAY,
      walletAddress: selectedWalletAccount.address,
      network: blockchainNetwork,
      cryptoCurrencyCode: cryptoCurrency,
      fiatCurrencyCode: FiatOnRampCurrency.USD,
      fiatCurrencyAmount: "10",
      paymentMethod: FiatOnRampPaymentMethod.CREDIT_DEBIT_CARD,
      sandboxMode: true,
    } as const;

    try {
      if (onrampDisplayOption === "iframe") {
        try {
          moonpaySdkRef.current?.close?.();
        } catch {}
        moonpaySdkRef.current = null;

        setShowMoonpayIframe(true);

        await Promise.resolve();

        const moonPay = await loadMoonPay();
        if (!moonPay) throw new Error("MoonPay SDK failed to load");

        const sdkParams = {
          apiKey: process.env.NEXT_PUBLIC_MOONPAY_API_KEY!,
          currencyCode: cryptoCurrencyCode,
          baseCurrencyAmount: "10",
          walletAddress: selectedWalletAccount.address,
          paymentMethod: "credit_debit_card",
        } as const;

        const sdk = moonPay({
          flow: "buy",
          environment: "sandbox",
          variant: "embedded",
          containerNodeSelector: "#moonpay-container",
          params: sdkParams as any,
          handlers: {
            onClose: async () => {
              console.log("onClose");
              setShowMoonpayIframe(false);
              try {
                moonpaySdkRef.current?.close?.();
              } catch {}
              moonpaySdkRef.current = null;
            },
            onLogin: async (payload) => console.log("onLogin", payload),
            onTransactionCreated: async (payload) =>
              console.log("onTransactionCreated", payload),
            onTransactionCompleted: async (payload) => {
              handleOnrampSuccess(payload);
              setShowMoonpayIframe(false);
            },
            onUnsupportedRegion: async () => {
              handleOnrampError("Unsupported region");
            },
          },
        });
        moonpaySdkRef.current = sdk;

        const urlForSignature = sdk?.generateUrlForSigning();

        const res = await initFiatOnramp({
          ...baseRequest,
          urlForSignature,
        } as any);

        if (!res?.onRampUrlSignature) {
          throw new Error("Backend did not return onRampUrlSignature");
        }

        sdk?.updateSignature(res.onRampUrlSignature);
        sdk?.show();
        return;
      }

      const res = await initFiatOnramp(baseRequest as any);
      if (!res?.onRampUrl) return;

      if (onrampDisplayOption === "popup") {
        window.open(
          res.onRampUrl,
          "_blank",
          "popup,width=500,height=700,scrollbars=yes,resizable=yes"
        );
      } else if (onrampDisplayOption === "new tab") {
        window.open(res.onRampUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error("Failed to init MoonPay on-ramp:", err);
      setShowMoonpayIframe(false);
      try {
        moonpaySdkRef.current?.close?.();
      } catch {}
      moonpaySdkRef.current = null;
    }
  };

  // Cleanup MoonPay SDK on unmount
  useEffect(() => {
    return () => {
      try {
        moonpaySdkRef.current?.close?.();
      } catch {}
      moonpaySdkRef.current = null;
    };
  }, []);

  return (
    <>
      {onrampDisplayOption === "iframe" && showMoonpayIframe && (
        <div
          id="moonpay-container"
          style={{ width: 500, height: 600, borderRadius: 12, marginTop: 30 }}
        />
      )}

      {!showMoonpayIframe && (
        <div className="w-80 p-4 rounded-2xl">
          <div className="flex flex-col items-center text-center gap-2">
            <p className="text-xs pt-2 text-zinc-400">
              Your crypto will be deposited directly into your Turnkey wallet
            </p>

            <span className="text-sm pt-2">Onramp Widget Display Option</span>
            <RadioGroup
              value={onrampDisplayOption}
              onChange={setOnrampDisplayOption}
              aria-label="Onramp Display Option"
            >
              <div className="grid grid-cols-3 gap-2">
                {displayOptions.map((opt) => (
                  <Radio
                    key={opt}
                    value={opt}
                    className="inline-flex items-center justify-center cursor-pointer select-none rounded-full border border-white/15 bg-white/5 text-zinc-300 px-2 py-1 text-xs hover:bg-white/10 transition-colors data-[checked]:bg-primary-light data-[checked]:text-white dark:data-[checked]:bg-primary-dark focus:outline-none data-[focus]:outline data-[focus]:outline-2 data-[focus]:outline-blue-500 shrink-0"
                  >
                    {opt}
                  </Radio>
                ))}
              </div>
            </RadioGroup>

            <div className="w-full flex flex-col gap-4 mt-2">
              <Button
                onClick={generateMoonPay}
                className="inline-flex items-center justify-center w-full gap-2 h-10 px-3 text-sm font-medium rounded-lg border border-white/10 shadow-none text-text-light dark:text-text-dark bg-background-light dark:bg-background-dark hover:bg-background-light/80 dark:hover:bg-background-dark/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 cursor-pointer"
              >
                <MoonPaySVG className="w-5 h-5" />
                Buy With MoonPay
              </Button>

              {onrampDisplayOption !== "iframe" && (
                <Button
                  onClick={generateCoinbase}
                  className="inline-flex items-center justify-center w-full gap-2 h-10 px-3 text-sm font-medium rounded-lg border border-white/10 shadow-none text-text-light dark:text-text-dark bg-background-light dark:bg-background-dark hover:bg-background-light/80 dark:hover:bg-background-dark/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 cursor-pointer"
                >
                  <CoinbaseSVG className="w-5 h-5" />
                  Buy with Coinbase
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
