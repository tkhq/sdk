import { useEffect } from "react";
import { useTurnkey } from "@turnkey/sdk-react";

export const OnRamp = () => {
  const { turnkey, indexedDbClient } = useTurnkey();

  const generateCoinbaseUrl = async () => {
    try {
      const session = await turnkey?.getSession();

      const response = await indexedDbClient?.initFiatOnRamp({
        organizationId: session?.organizationId!,
        onrampProvider: "FIAT_ON_RAMP_PROVIDER_COINBASE",
        walletAddress: "0x958E4A3364a25e5555f3e1b1171e91322DEe0589",
        network: "FIAT_ON_RAMP_BLOCKCHAIN_NETWORK_ETHEREUM",
        cryptoCurrencyCode: "FIAT_ON_RAMP_CRYPTO_CURRENCY_ETH",
        fiatCurrencyCode: "FIAT_ON_RAMP_CURRENCY_USD",
        countryCode: "US",
        countrySubdivisionCode: "ME",
      });

      if (response?.onRampUrl) {
        window.open(response.onRampUrl, "_blank");
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
        walletAddress: "0x958E4A3364a25e5555f3e1b1171e91322DEe0589",
        network: "FIAT_ON_RAMP_BLOCKCHAIN_NETWORK_ETHEREUM",
        cryptoCurrencyCode: "FIAT_ON_RAMP_CRYPTO_CURRENCY_ETH",
        fiatCurrencyCode: "FIAT_ON_RAMP_CURRENCY_USD",
      });

      if (response?.onRampUrl) {
        window.open(response.onRampUrl, "_blank");
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
        Buy with MoonPay
      </button>
      <button className="whiteButton" onClick={generateCoinbaseUrl}>
        Buy with Coinbase
      </button>
    </div>
  );
};
