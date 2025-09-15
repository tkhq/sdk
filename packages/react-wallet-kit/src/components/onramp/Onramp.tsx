import { useModal } from "../../providers/modal/Hook";
import {
  FiatOnRampBlockchainNetwork,
  FiatOnRampCryptoCurrency,
  FiatOnRampCurrency,
  FiatOnRampPaymentMethod,
  FiatOnRampProvider,
} from "@turnkey/sdk-types";
import { useTurnkey } from "../../providers/client/Hook";
import clsx from "clsx";
import { BaseButton } from "../design/Buttons";

interface OnRampProps {
  ethAddress: string;
}

export const OnRamp = ({ ethAddress }: OnRampProps) => {
  const { initFiatOnramp, session } = useTurnkey();
  const { isMobile } = useModal();

  const generateCoinbaseUrl = async () => {
    try {
      if (!session) {
        throw new Error("Session not found");
      }

      const response = await initFiatOnramp({
        organizationId: session?.organizationId!,
        onrampProvider: FiatOnRampProvider.COINBASE,
        walletAddress: ethAddress,
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
          "popup,width=500,height=700,scrollbars=yes,resizable=yes",
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
        walletAddress: ethAddress,
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
          "popup,width=500,height=700,scrollbars=yes,resizable=yes",
        );
      }
    } catch (error) {
      console.error("Failed to init MoonPay on-ramp:", error);
    }
  };

  return (
    <div
      className={clsx(
        "flex items-center justify-center space-x-2",
        isMobile ? "w-[95%]" : "w-full",
      )}
    >
      <div
        className={`flex flex-col items-center justify-center gap-6 transition-all duration-300`}
      >
        <BaseButton
          onClick={generateMoonPayUrl}
          className={`text-xs text-inherit font-semibold bg-transparent border-none`}
        ></BaseButton>
        <BaseButton
          onClick={generateCoinbaseUrl}
          className={`text-xs text-inherit font-semibold bg-transparent border-none`}
        ></BaseButton>
      </div>
    </div>
  );
};
