"use client";

import { Button } from "@headlessui/react";
import { useTurnkey, WalletAccount } from "@turnkey/react-wallet-kit";
import {
  FiatOnRampBlockchainNetwork,
  FiatOnRampCryptoCurrency,
  FiatOnRampCurrency,
  FiatOnRampPaymentMethod,
  FiatOnRampProvider,
} from "@turnkey/sdk-types";
import { CoinbaseSVG, MoonPaySVG, SolanaSVG } from "../Svg";
export default function OnrampSelector({
  selectedWalletAccount,
}: {
  selectedWalletAccount: WalletAccount;
}) {
  const { initFiatOnramp, session } = useTurnkey();

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
        window.open(
          response.onRampUrl,
          "_blank",
          "popup,width=500,height=700,scrollbars=yes,resizable=yes"
        );
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
        window.open(
          response.onRampUrl,
          "_blank",
          "popup,width=500,height=700,scrollbars=yes,resizable=yes"
        );
      }
    } catch (error) {
      console.error("Failed to init MoonPay on-ramp:", error);
    }
  };

  return (
    <div className="flex flex-col justify-center w-72 p-2">
      <div
        className="flex flex-col items-center justify-center"
        style={{ height: "auto", width: "auto" }}
      >
        <h2>Add funds to your wallet</h2>
        <p className="text-xs text-icon-text-light dark:text-icon-text-dark">
          Your crypto will be deposited directly into your Turnkey wallet
        </p>
        <Button
          onClick={async () => await generateCoinbaseUrl()}
          className="bg-primary-light dark:bg-primary-dark text-primary-text-light dark:text-primary-text-dark rounded-lg px-10 py-2 active:scale-95 transition-transform cursor-pointer"
        >
          <CoinbaseSVG className="w-8 h-8" />
          Buy with Coinbase
        </Button>
        <Button
          onClick={async () => generateMoonPayUrl()}
          className="bg-primary-light dark:bg-primary-dark text-primary-text-light dark:text-primary-text-dark rounded-lg px-4 py-2 active:scale-95 transition-transform cursor-pointer"
        >
          <MoonPaySVG className="w-8 h-8" />
          Buy With MoonPay
        </Button>
      </div>
    </div>
  );
}
