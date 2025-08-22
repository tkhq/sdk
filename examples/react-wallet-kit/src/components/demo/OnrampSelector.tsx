"use client";

import { useState, useEffect, useRef } from "react";
import { Button, Field, RadioGroup, Radio, Label } from "@headlessui/react";
import { useTurnkey, WalletAccount } from "@turnkey/react-wallet-kit";
import {
  FiatOnRampBlockchainNetwork,
  FiatOnRampCryptoCurrency,
  FiatOnRampCurrency,
  FiatOnRampPaymentMethod,
  FiatOnRampProvider,
} from "@turnkey/sdk-types";

import { CoinbaseSVG, MoonPaySVG } from "../Svg";

import { loadMoonPay } from "@moonpay/moonpay-js";

type DisplayOption = "iframe" | "popup" | "new tab";

const displayOptions = ["iframe", "popup", "new tab"] as const;

export default function OnrampSelector({
  selectedWalletAccount,
}: {
  selectedWalletAccount: WalletAccount;
}) {
  const { initFiatOnramp, session } = useTurnkey();
  const [onrampDisplayOption, setOnrampDisplayOption] =
    useState<DisplayOption>("popup");
  const [moonpayUrl, setMoonpayUrl] = useState<string | null>(null);

  const [showMoonpayIframe, setShowMoonpayIframe] = useState(false);
  const moonpaySdkRef = useRef<any>(null);

  const generateCoinbaseUrl = async () => {
    try {
      if (!session) {
        throw new Error("Session not found");
      }

      const response = await initFiatOnramp({
        organizationId: session?.organizationId!,
        onrampProvider: FiatOnRampProvider.COINBASE,
        walletAddress: selectedWalletAccount.address,
        network: FiatOnRampBlockchainNetwork.ETHEREUM,
        cryptoCurrencyCode: FiatOnRampCryptoCurrency.ETHEREUM,
        fiatCurrencyCode: FiatOnRampCurrency.USD,
        fiatCurrencyAmount: "10",
        paymentMethod: FiatOnRampPaymentMethod.CREDIT_DEBIT_CARD,
        countryCode: "US",
        countrySubdivisionCode: "ME",
        sandboxMode: true,
      });

      if (response?.onRampUrl) {
        if (onrampDisplayOption === "popup") {
          window.open(
            response.onRampUrl,
            "_blank",
            "popup,width=500,height=700,scrollbars=yes,resizable=yes"
          );
          return;
        } else if (onrampDisplayOption === "new tab") {
          window.open(response.onRampUrl, "_blank", "noopener,noreferrer");
          return;
        }
      }
    } catch (error) {
      console.error("Failed to init Coinbase on-ramp:", error);
    }
  };

  const generateMoonPayUrl = async () => {
    try {
      if (!session) {
        throw new Error("Session not found");
      }

      const response = await initFiatOnramp({
        organizationId: session?.organizationId!,
        onrampProvider: FiatOnRampProvider.MOONPAY,
        walletAddress: selectedWalletAccount.address,
        network: FiatOnRampBlockchainNetwork.ETHEREUM,
        cryptoCurrencyCode: FiatOnRampCryptoCurrency.ETHEREUM,
        fiatCurrencyCode: FiatOnRampCurrency.USD,
        fiatCurrencyAmount: "10",
        paymentMethod: FiatOnRampPaymentMethod.CREDIT_DEBIT_CARD,
        sandboxMode: true,
      });

      if (response?.onRampUrl) {
        if (onrampDisplayOption === "iframe") {
          setMoonpayUrl(response.onRampUrl);
          return;
        } else if (onrampDisplayOption === "popup") {
          window.open(
            response.onRampUrl,
            "_blank",
            "popup,width=500,height=700,scrollbars=yes,resizable=yes"
          );
          return;
        } else if (onrampDisplayOption === "new tab") {
          window.open(response.onRampUrl, "_blank", "noopener,noreferrer");
          return;
        }
      }
    } catch (error) {
      console.error("Failed to init MoonPay on-ramp:", error);
    }
  };

  const generateMoonPay = async () => {
    try {
      if (!session) throw new Error("Session not found");

      const baseRequest = {
        organizationId: session.organizationId!,
        onrampProvider: FiatOnRampProvider.MOONPAY,
        walletAddress: selectedWalletAccount.address,
        network: FiatOnRampBlockchainNetwork.ETHEREUM,
        cryptoCurrencyCode: FiatOnRampCryptoCurrency.ETHEREUM,
        fiatCurrencyCode: FiatOnRampCurrency.USD,
        fiatCurrencyAmount: "10",
        paymentMethod: FiatOnRampPaymentMethod.CREDIT_DEBIT_CARD,
        sandboxMode: true,
      } as const;

      if (onrampDisplayOption === "iframe") {
        setShowMoonpayIframe(true);

        await Promise.resolve();

        const moonPay = await loadMoonPay();
        if (!moonPay) throw new Error("MoonPay SDK failed to load");

        const sdkParams = {
          apiKey: process.env.NEXT_PUBLIC_MOONPAY_API_KEY!,
          currencyCode: "eth",
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
            onLogin: async (p) => console.log("onLogin", p),
            onTransactionCreated: async (p) =>
              console.log("onTransactionCreated", p),
            onTransactionCompleted: async (p) => {
              console.log("onTransactionCompleted", p);
              setShowMoonpayIframe(false);
            },
            onUnsupportedRegion: async () => console.log("onUnsupportedRegion"),
          },
        });
        moonpaySdkRef.current = sdk;

        const urlForSignature = sdk?.generateUrlForSigning();

        const response = await initFiatOnramp({
          ...baseRequest,
          urlForSignature,
        } as any);

        if (!response?.onRampSignatureRaw) {
          throw new Error("Backend did not return onRampSignatureRaw");
        }

        sdk?.updateSignature(response.onRampSignatureRaw);
        sdk?.show();
        return;
      }

      const response = await initFiatOnramp(baseRequest as any);

      if (!response?.onRampUrl) return;

      if (onrampDisplayOption === "popup") {
        window.open(
          response.onRampUrl,
          "_blank",
          "popup,width=500,height=700,scrollbars=yes,resizable=yes"
        );
      } else if (onrampDisplayOption === "new tab") {
        window.open(response.onRampUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      console.error("Failed to init MoonPay on-ramp:", e);
      setShowMoonpayIframe(false);
    }
  };
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
      {moonpayUrl && (
        <iframe
          src={moonpayUrl}
          allow="payment https://buy.moonpay.com https://buy-sandbox.moonpay.com"
          title="MoonPay OnRamp"
          style={{
            width: "500px",
            height: "600px",
            border: "none",
            borderRadius: "12px",
            marginTop: "30px",
          }}
        ></iframe>
      )}
      {!moonpayUrl && (
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
                {displayOptions.map((displayOption) => (
                  <Radio
                    key={displayOption}
                    value={displayOption}
                    className="inline-flex items-center justify-center cursor-pointer select-none rounded-full border border-white/15 bg-white/5 text-zinc-300 px-2 py-1 text-xs hover:bg-white/10 transition-colors data-[checked]:bg-primary-light data-[checked]:text-white dark:data-[checked]:bg-primary-dark focus:outline-none data-[focus]:outline data-[focus]:outline-2 data-[focus]:outline-blue-500 shrink-0"
                  >
                    {displayOption}
                  </Radio>
                ))}
              </div>
            </RadioGroup>
            <div className="w-full flex flex-col gap-4 mt-2">
              <Button
                onClick={async () => await generateMoonPayUrl()}
                className="inline-flex items-center justify-center w-full gap-2 h-10 px-3 text-sm font-medium rounded-lg border border-white/10 shadow-none text-text-light dark:text-text-dark bg-background-light dark:bg-background-dark hover:bg-background-light/80 dark:hover:bg-background-dark/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 cursor-pointer gap-2"
              >
                <MoonPaySVG className="w-5 h-5" />
                Buy With MoonPay
              </Button>
              {onrampDisplayOption != "iframe" && (
                <Button
                  onClick={async () => await generateCoinbaseUrl()}
                  className="inline-flex items-center justify-center w-full gap-2 h-10 px-3 text-sm font-medium rounded-lg border border-white/10 shadow-none text-text-light dark:text-text-dark bg-background-light dark:bg-background-dark hover:bg-background-light/80 dark:hover:bg-background-dark/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 cursor-pointer gap-2"
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
