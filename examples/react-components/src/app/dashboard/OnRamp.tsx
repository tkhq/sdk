import crypto from "crypto";
import { MoonPayBuyWidget } from "@moonpay/moonpay-react";
import { FundButton } from "@coinbase/onchainkit/fund";
import { useEffect, useState } from "react";
import { useTurnkey } from "@turnkey/sdk-react";

export const OnRamp = () => {
  const { turnkey, indexedDbClient } = useTurnkey();
  const [isMoonPayVisible, setIsMoonPayVisible] = useState(false);
  const [coinbaseOnRampBuyUrl, setCoinbaseOnRampBuyUrl] = useState("");
  const [moonPayOnRampBuyUrl, setMoonPayOnRampBuyUrl] = useState("");
  const [isCoinbaseToggled, setIsCoinbaseToggled] = useState(false);
  const [isMoonPayToggled, setIsMoonPayToggled] = useState(false);

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
        });

        console.log("initFiatOnRampResponse:", initFiatOnRampResponse);
        if (initFiatOnRampResponse?.onRampUrl) {
          setCoinbaseOnRampBuyUrl(initFiatOnRampResponse?.onRampUrl);
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
              <FundButton
                text={"Coinbase On Ramp"}
                fundingUrl={coinbaseOnRampBuyUrl}
              />
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
