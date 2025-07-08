import crypto from "crypto";
import { MoonPayBuyWidget } from "@moonpay/moonpay-react";
import {
  FundButton,
  getOnrampBuyUrl,
  fetchOnrampConfig,
  fetchOnrampOptions,
} from "@coinbase/onchainkit/fund";
import { useEffect, useState } from "react";
import { useTurnkey } from "@turnkey/sdk-react";
// import { Buy } from "@coinbase/onchainkit/buy";
// import { Token } from "@coinbase/onchainkit/token";

export const OnRamp = () => {
  const { turnkey, indexedDbClient } = useTurnkey();
  // const [isMoonPayVisible, setIsMoonPayVisible] = useState(false);
  const [coinbaseOnRampBuyUrl, setCoinbaseOnRampBuyUrl] = useState("");
  const [moonPayOnRampBuyUrl, setMoonPayOnRampBuyUrl] = useState("");
  const [isCoinbaseToggled, setIsCoinbaseToggled] = useState(false);
  const [isMoonPayToggled, setIsMoonPayToggled] = useState(false);

  useEffect(() => {
    const generateCoinbaseUrl = async () => {
      try {
        // get session
        const session = await turnkey?.getSession();

        const initFiatOnRampResponse = await indexedDbClient?.initFiatOnRamp({
          organizationId: session?.organizationId!,
          onrampProvider: "FIAT_ON_RAMP_PROVIDER_COINBASE",
          walletAddress: "0x958E4A3364a25e5555f3e1b1171e91322DEe0589",
          network: "FIAT_ON_RAMP_BLOCKCHAIN_NETWORK_ETHEREUM",
          cryptoCurrencyCode: "FIAT_ON_RAMP_CRYPTO_CURRENCY_ETH",
          fiatCurrencyCode: "FIAT_ON_RAMP_CURRENCY_USD",
          countryCode: "US",
          countrySubdivisionCode: "ME",
        });

        console.log("initFiatOnRampResponse:", initFiatOnRampResponse);

        if (initFiatOnRampResponse?.onRampUrl) {
          window.open(initFiatOnRampResponse?.onRampUrl, "_blank");
        }
      } catch (error) {
        console.error("Failed to init fiat on ramp:", error);
      }
    };

    if (isCoinbaseToggled) {
      generateCoinbaseUrl();
    } else {
      setCoinbaseOnRampBuyUrl("");
    }
  }, [isCoinbaseToggled]);

  useEffect(() => {
    const generateMoonPayUrl = async () => {
      try {
        // get session
        const session = await turnkey?.getSession();

        const initMoonPayFiatOnRampResponse =
          await indexedDbClient?.initFiatOnRamp({
            organizationId: session?.organizationId!,
            onrampProvider: "FIAT_ON_RAMP_PROVIDER_MOONPAY",
            walletAddress: "0x958E4A3364a25e5555f3e1b1171e91322DEe0589",
            network: "FIAT_ON_RAMP_BLOCKCHAIN_NETWORK_ETHEREUM",
            cryptoCurrencyCode: "FIAT_ON_RAMP_CRYPTO_CURRENCY_ETH",
            fiatCurrencyCode: "FIAT_ON_RAMP_CURRENCY_USD",
          });

        console.log(
          "initMoonPayFiatOnRampResponse:",
          initMoonPayFiatOnRampResponse
        );

        if (initMoonPayFiatOnRampResponse?.onRampUrl) {
          window.open(initMoonPayFiatOnRampResponse?.onRampUrl, "_blank");
        }
      } catch (error) {
        console.error("Failed to init fiat on ramp:", error);
      }
    };

    if (isMoonPayToggled) {
      generateMoonPayUrl();
    } else {
      setMoonPayOnRampBuyUrl("");
    }
  }, [isMoonPayToggled]);

  return (
    <div>
      <h1>Fiat On Ramps</h1>
      <label>
        Coinbase
        <input
          type="checkbox"
          checked={isCoinbaseToggled}
          onChange={() => setIsCoinbaseToggled(!isCoinbaseToggled)}
        />
      </label>
      <label>
        MoonPay
        <input
          type="checkbox"
          checked={isMoonPayToggled}
          onChange={() => setIsMoonPayToggled(!isMoonPayToggled)}
        />
      </label>
    </div>
  );
};
