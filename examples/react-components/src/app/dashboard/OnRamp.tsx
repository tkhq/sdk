import { useEffect } from "react";
import { useTurnkey } from "@turnkey/sdk-react";

type OnRampProps = {
  ethAddress: string;
};

export const OnRamp = ({ ethAddress }: OnRampProps) => {
  const { turnkey, indexedDbClient } = useTurnkey();

  const generateCoinbaseUrl = async () => {
    try {
      const session = await turnkey?.getSession();

      const response = await indexedDbClient?.initFiatOnRamp({
        organizationId: session?.organizationId!,
        onrampProvider: "FIAT_ON_RAMP_PROVIDER_COINBASE",
        walletAddress: ethAddress,
        network: "FIAT_ON_RAMP_BLOCKCHAIN_NETWORK_ETHEREUM",
        cryptoCurrencyCode: "FIAT_ON_RAMP_CRYPTO_CURRENCY_ETH",
        fiatCurrencyCode: "FIAT_ON_RAMP_CURRENCY_USD",
        countryCode: "US",
        countrySubdivisionCode: "ME",
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
      const session = await turnkey?.getSession();

      const response = await indexedDbClient?.initFiatOnRamp({
        organizationId: session?.organizationId!,
        onrampProvider: "FIAT_ON_RAMP_PROVIDER_MOONPAY",
        walletAddress: ethAddress,
        network: "FIAT_ON_RAMP_BLOCKCHAIN_NETWORK_ETHEREUM",
        cryptoCurrencyCode: "FIAT_ON_RAMP_CRYPTO_CURRENCY_ETH",
        fiatCurrencyCode: "FIAT_ON_RAMP_CURRENCY_USD",
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
    <div className="onRamp">
      <div className="fundingText">
        <div className="fundingTitle">Funding</div>
        <div className="fundingSub">Add funds via Coinbase or MoonPay.</div>
      </div>
      <button className="whiteButton" onClick={generateMoonPayUrl}>
        <img src="/images/moonpay.jpg" />
        Buy with MoonPay
      </button>
      <button className="whiteButton" onClick={generateCoinbaseUrl}>
        <img src="/images/coinbase.png" />
        Buy with Coinbase
      </button>
    </div>
  );
};
