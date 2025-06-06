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
import { Buy } from "@coinbase/onchainkit/buy";
import { Token } from "@coinbase/onchainkit/token";

export const OnRamp = () => {
  const { turnkey, indexedDbClient } = useTurnkey();
  const [isMoonPayVisible, setIsMoonPayVisible] = useState(false);
  const [coinbaseOnRampBuyUrl, setCoinbaseOnRampBuyUrl] = useState("");
  const [moonPayOnRampBuyUrl, setMoonPayOnRampBuyUrl] = useState("");
  const [isCoinbaseToggled, setIsCoinbaseToggled] = useState(false);
  const [isMoonPayToggled, setIsMoonPayToggled] = useState(false);

  const ethToken: Token = {
    name: "ETH",
    address: "0x652bd17D489F283A03bb52DAFa138764Be04Bc66",
    symbol: "ETH",
    decimals: 6,
    chainId: 8453,
    image: "",
  };
  // useEffect(() => {
  //   const loadMoonPaySdk = async () => {
  //     try {
  //       const moonPay = await loadMoonPay();
  //       const moonPaySdk = moonPay!({
  //         flow: 'buy',
  //         environment: 'sandbox',
  //         variant: 'overlay',
  //         params: {
  //           apiKey: process.env.NEXT_PUBLIC_MOONPAY_API_KEY!,
  //         },
  //         debug: true
  //       });
  //       setMoonPaySDK(moonPaySdk);
  //     } catch (error) {
  //       console.error("Failed to load MoonPay SDK:", error);
  //     }
  //   };
  //   loadMoonPaySdk();
  // }, []);

  useEffect(() => {
    const generateCoinbaseUrl = async () => {
      try {
        // get session
        const session = await turnkey?.getSession();
        console.log("session response:", session);

        const initFiatOnRampResponse = await indexedDbClient?.initFiatOnRamp({
          organizationId: session?.organizationId!,
          onrampProvider: "FIAT_ON_RAMP_PROVIDER_COINBASE",
          transactionType: "FIAT_ON_RAMP_TRANSACTION_TYPE_BUY",
          walletAddress: "0x652bd17D489F283A03bb52DAFa138764Be04Bc66",
          fiatCurrencyCode: "USD",
        });

        const onrampConfig = await fetchOnrampConfig();
        console.log("onrampConfig:", onrampConfig);

        const onrampOptions = await fetchOnrampOptions({
          country: "US",
          subdivision: "ME",
        });
        console.log("onrampOptions:", onrampOptions);

        const onrampBuyUrl = getOnrampBuyUrl({
          projectId: "aefedf19-488c-426c-b7be-133fab72807c",
          addresses: {
            ["0x652bd17D489F283A03bb52DAFa138764Be04Bc66"]: ["base"],
          },
          assets: ["ETH"],
          presetFiatAmount: 20,
          fiatCurrency: "USD",
        });

        // <FundButton fundingUrl={onrampBuyUrl} />;

        console.log("Coinbase onrampBuyUrl:", onrampBuyUrl);
        setCoinbaseOnRampBuyUrl(onrampBuyUrl);
        console.log("initFiatOnRampResponse:", initFiatOnRampResponse);
        // if (initFiatOnRampResponse?.onRampUrl) {
        //   setCoinbaseOnRampBuyUrl(initFiatOnRampResponse?.onRampUrl);
        // }
      } catch (error) {
        console.error("Failed to init fiat on ramp:", error);
      }
    };

    // https://pay.coinbase.com/buy?sessionToken=MWYwNDE2YTItYWMwZC02OTA0LThjMDAtMTY3NzNhNGRkNGRk&appId=aefedf19-488c-426c-b7be-133fab72807c&destinationWallets=%5B%7B%22address%22%3A%220x652bd17D489F283A03bb52DAFa138764Be04Bc66%22%2C%22blockchains%22%3A%5B%22ethereum%22%5D%7D%5D&defaultAsset=ETH&defaultPaymentMethod=CARD&fiatCurrency=USD&presetFiatAmount=10
    // https://pay.coinbase.com/buy/select-payment-method?appId=58a3fa2e-617f-4198-81e7-096f5e498c00&defaultAsset=ETH&defaultPaymentMethod=CARD&destinationWallets=%5B%7B%22address%22%3A%220x652bd17D489F283A03bb52DAFa138764Be04Bc66%22%2C%22blockchains%22%3A%5B%22ethereum%22%5D%7D%5D&fiatCurrency=USD&presetFiatAmount=10
    // https://pay.coinbase.com/buy?token=MWYwNDE2YmQtZjEyOS02NTk1LWIxYjMtODIxNTE0ZDI3MTM5&appId=aefedf19-488c-426c-b7be-133fab72807c&destinationWallets=%5B%7B%22address%22%3A%220x652bd17D489F283A03bb52DAFa138764Be04Bc66%22%2C%22blockchains%22%3A%5B%22ethereum%22%5D%7D%5D&defaultAsset=ETH&defaultPaymentMethod=CARD&fiatCurrency=USD&presetFiatAmount=10
    // https://pay.coinbase.com/buy?sessionToken=MWYwNDE2Y2MtMDhlZC02MjdmLTgwNDgtMTY5MmQ0NGIwMTFh&defaultAsset=ETH&defaultPaymentMethod=CARD&fiatCurrency=USD&presetFiatAmount=10

    // example from coinbase docs https://docs.cdp.coinbase.com/onramp/docs/api-oneclickbuy#generating-one-click-buy-urls
    // https://pay.coinbase.com/buy/select-asset?appId=58a3fa2e-617f-4198-81e7-096f5e498c00&destinationWallets=[{"address":"0x652bd17D489F283A03bb52DAFa138764Be04Bc66","blockchains":["ethereum"]}]&defaultAsset=ETH&defaultPaymentMethod=CARD&fiatCurrency=USD&presetFiatAmount=10

    // my url
    // https://pay.coinbase.com/buy/select-asset?appId=aefedf19-488c-426c-b7be-133fab72807c&destinationWallets=[{"address":"0x652bd17D489F283A03bb52DAFa138764Be04Bc66","blockchains":["ethereum"]}]&defaultAsset=ETH&defaultPaymentMethod=CARD&fiatCurrency=USD&presetFiatAmount=10
    // appId=aefedf19-488c-426c-b7be-133fab72807c

    // https://pay.coinbase.com/buy?token=MWYwNDE3MjEtYTk1Mi02ZGNlLTg2MTEtOGVhNDZjN2QzNWRh
    // https://pay.coinbase.com/buy?token=MWYwNDE3MmEtNGM1Yy02OGY4LWIxYjMtODIxNTE0ZDI3MTM5
    // https://pay.coinbase.com/buy/select-asset?sessionToken=MWYwNDE3MmEtNGM1Yy02OGY4LWIxYjMtODIxNTE0ZDI3MTM5&destinationWallets=[{"address":"0x652bd17D489F283A03bb52DAFa138764Be04Bc66","blockchains":["ethereum"]}]&defaultAsset=ETH&defaultPaymentMethod=CARD&fiatCurrency=USD&presetFiatAmount=10
    // https://pay.coinbase.com/buy/select-asset?appId=aefedf19-488c-426c-b7be-133fab72807c&destinationWallets=[{"address":"0x652bd17D489F283A03bb52DAFa138764Be04Bc66","blockchains":["ethereum"]}]&defaultAsset=ETH&defaultPaymentMethod=CARD&fiatCurrency=USD&presetFiatAmount=10

    // https://pay.coinbase.com/buy/select-asset?appId=aefedf19-488c-426c-b7be-133fab72807c&addresses={"0x652bd17D489F283A03bb52DAFa138764Be04Bc66":["baseSepolia"]}&assets=["ETH"]
    if (isCoinbaseToggled) {
      generateCoinbaseUrl();
    } else {
      setCoinbaseOnRampBuyUrl("");
    }
  }, [isCoinbaseToggled]);

  const openMoonPay = () => {
    window.open(moonPayOnRampBuyUrl, "_blank");
  };

  useEffect(() => {
    const generateMoonPayUrl = async () => {
      try {
        // get session
        const session = await turnkey?.getSession();
        console.log("session response:", session);
        const secretKey = "sk_test_QVIzIpqMuAtqUKRFaMcF6jwwgL96vwD";
        const originalUrl =
          "https://buy-sandbox.moonpay.com?apiKey=pk_test_zEGwLvmLma8crfMBnJwzom7jzKeu6Jsk&currencyCode=eth&walletAddress=0xc7c10b3f98Be080DC2d6052BFd6d70F32B6b9e53";
        const signature = crypto
          .createHmac("sha256", secretKey) // Use your secret key
          .update(new URL(originalUrl).search) // Use the query string part of the URL
          .digest("base64"); // Convert the result to a base64 string

        const urlWithSignature = `${originalUrl}&signature=${encodeURIComponent(signature)}`; // Add the signature to the URL

        console.log("urlWithSignature", urlWithSignature);
        const initMoonPayFiatOnRampResponse =
          await indexedDbClient?.initFiatOnRamp({
            organizationId: session?.organizationId!,
            onrampProvider: "FIAT_ON_RAMP_PROVIDER_MOONPAY",
            transactionType: "FIAT_ON_RAMP_TRANSACTION_TYPE_BUY",
            walletAddress: "0x652bd17D489F283A03bb52DAFa138764Be04Bc66",
            fiatCurrencyCode: "USD",
          });

        console.log(
          "initMoonPayFiatOnRampResponse:",
          initMoonPayFiatOnRampResponse
        );
        // console.log(
        //   "https://buy-sandbox.moonpay.com?apiKey=pk_test_zEGwLvmLma8crfMBnJwzom7jzKeu6Jsk&currencyCode=ETH&walletAddress=0xf2C35a22F398a00097E7621638D3931173850811&signature=wecT6rA1h8Fo5xL3wtjMH2nvUdAwGbHHTu8NRI85Xeo%3D"
        // );
        if (initMoonPayFiatOnRampResponse?.onRampUrl) {
          setMoonPayOnRampBuyUrl(initMoonPayFiatOnRampResponse?.onRampUrl);
        }
        // setMoonPayOnRampBuyUrl(urlWithSignature);
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

  // const handleGetMoonPayUrlSignature = async (url: string): Promise<string> => {
  //   try {
  //     // get session
  //     const session = await turnkey?.getSession();
  //     console.log("session response:", session);

  //     const initMoonPayFiatOnRampResponse =
  //       await indexedDbClient?.initFiatOnRamp({
  //         organizationId: session?.organizationId!,
  //         onrampProvider: "MOONPAY",
  //         transactionType: "BUY",
  //       });

  //     console.log(
  //       "initMoonPayFiatOnRampResponse:",
  //       initMoonPayFiatOnRampResponse
  //     );
  //   } catch (error) {
  //     console.error("Failed to init fiat on ramp:", error);
  //   }
  //   // console.log("Generating signature for URL:", url);
  //   // const signature = crypto
  //   //   .createHmac("sha256", secretKey)
  //   //   .update(new URL(url).search) // Use the query string part of the URL
  //   //   .digest("base64"); // Convert the result to a base64 string

  //   // console.log(signature); // Print the signature
  //   // return signature; // Return the signature
  // };

  // const handleGetSignature = async (url: string): Promise<string> => {
  //   const signature = await fetch(`https://http://localhost:3001//sign-url?url=${url}`)
  //   console.log("Signature received:", signature);
  //   return signature as unknown as string;
  // }

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
      {isCoinbaseToggled ? (
        <>
          {coinbaseOnRampBuyUrl && (
            <>
              <FundButton text="Coinbase" fundingUrl={coinbaseOnRampBuyUrl} />
              <Buy toToken={ethToken} />
            </>
          )}
        </>
      ) : (
        <></>
      )}
      {/* <MoonPayBuyWidget
                      variant="newWindow"
                      walletAddress="0xc7c10b3f98Be080DC2d6052BFd6d70F32B6b9e53"
                      baseCurrencyAmount="20"
                      currencyCode="eth"
                      onUrlSignatureRequested={handleGetMoonPayUrlSignature}
                      visible={isMoonPayVisible}
                    /> */}
      {moonPayOnRampBuyUrl && (
        <>
          <button
            onClick={() => {
              openMoonPay();
            }}
          >
            Buy with MoonPay
          </button>
        </>
      )}
      {/* <button
                      onClick={() => setIsMoonPayVisible(true)}
                      className="moonPayButton"
                    >
                      Go to the moon
                    </button> */}

      {/* <button onClick={() => {
                      console.log("MoonPay SDK:", moonPaySDK);
                      moonPaySDK?.show()}} className="moonPayButton">
                      Go to the moon
                    </button> */}
    </div>
  );
};
