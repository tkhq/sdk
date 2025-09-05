import { useState } from "react";
import { useTurnkey } from "@turnkey/sdk-react";
import { Box, Modal, Typography } from "@mui/material";
import {
  FiatOnRampBlockchainNetwork,
  FiatOnRampCryptoCurrency,
  FiatOnRampCurrency,
  FiatOnRampPaymentMethod,
  FiatOnRampProvider,
} from "@turnkey/sdk-types";

interface OnRampProps {
  ethAddress: string;
}

type DisplayOption = "iframe" | "popup" | "newTab";

const displayOptions = ["iframe", "popup", "newTab"] as const;

export const OnRamp = ({ ethAddress }: OnRampProps) => {
  const { turnkey, indexedDbClient } = useTurnkey();
  const [isOnrampModalOpen, setIsOnrampModalOpen] = useState(false);
  const [onrampDisplayOption, setOnrampDisplayOption] =
    useState<DisplayOption>("popup");

  const [moonpayUrl, setMoonpayUrl] = useState<string | null>(null);
  const [coinbaseUrl, setCoinbaseUrl] = useState<string | null>(null);

  const handleModalOpen = () => setIsOnrampModalOpen(true);
  const handleModalClose = () => setIsOnrampModalOpen(false);

  const generateCoinbaseUrl = async () => {
    try {
      const session = await turnkey?.getSession();

      const response = await indexedDbClient?.initFiatOnRamp({
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
        if (onrampDisplayOption === "iframe") {
          setCoinbaseUrl(response.onRampUrl);
          return;
        } else if (onrampDisplayOption === "popup") {
          window.open(
            response.onRampUrl,
            "_blank",
            "popup,width=500,height=700,scrollbars=yes,resizable=yes",
          );
          return;
        } else if (onrampDisplayOption === "newTab") {
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
      const session = await turnkey?.getSession();

      const response = await indexedDbClient?.initFiatOnRamp({
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
        if (onrampDisplayOption === "iframe") {
          setMoonpayUrl(response.onRampUrl);
          return;
        } else if (onrampDisplayOption === "popup") {
          window.open(
            response.onRampUrl,
            "_blank",
            "popup,width=500,height=700,scrollbars=yes,resizable=yes",
          );
          return;
        } else if (onrampDisplayOption === "newTab") {
          window.open(response.onRampUrl, "_blank", "noopener,noreferrer");
          return;
        }
      }
    } catch (error) {
      console.error("Failed to init MoonPay on-ramp:", error);
    }
  };

  return (
    <>
      <button className="whiteButton" onClick={handleModalOpen}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="25"
          height="24"
          viewBox="0 0 25 24"
          fill="none"
        >
          <path
            d="M11.5 13H5.5V11H11.5V5H13.5V11H19.5V13H13.5V19H11.5V13Z"
            fill="#878C94"
          />
        </svg>
        Add Funds
      </button>

      <Modal open={isOnrampModalOpen} onClose={handleModalClose}>
        <Box
          sx={{
            outline: "none",
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 400,
            bgcolor: "var(--Greyscale-20, #f5f7fb)",
            boxShadow: 24,
            p: 4,
            borderRadius: 2,
          }}
        >
          <div
            onClick={handleModalClose}
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              background: "none",
              border: "none",
              fontSize: "20px",
              fontWeight: "bold",
              cursor: "pointer",
              color: "#6C727E",
            }}
          >
            &times;
          </div>
          <Typography variant="h6" className="modalTitle">
            Add Funds to your wallet
          </Typography>
          <Typography variant="subtitle2" sx={{ color: "#6C727E", mb: 2 }}>
            Your crypto will be deposited directly into your Turnkey wallet
          </Typography>
          {displayOptions.map((displayOption) => {
            const id = `plan-${displayOption}`;
            return (
              <label
                key={displayOption}
                htmlFor={id}
                style={{ display: "block" }}
              >
                <input
                  id={id}
                  type="radio"
                  name="plan"
                  value={displayOption}
                  checked={onrampDisplayOption === displayOption}
                  onChange={(e) =>
                    setOnrampDisplayOption(e.target.value as DisplayOption)
                  }
                />
                {displayOption}
              </label>
            );
          })}
          <div className="purchaseButtons">
            <button className="whiteButton" onClick={generateMoonPayUrl}>
              <img src="/images/moonpay.jpg" alt="MoonPay" />
              Buy with MoonPay
            </button>
            <button className="whiteButton" onClick={generateCoinbaseUrl}>
              <img src="/images/coinbase.png" alt="Coinbase" />
              Buy with Coinbase
            </button>
          </div>
          {moonpayUrl && (
            <iframe
              src={moonpayUrl}
              title="MoonPay OnRamp"
              style={{
                width: "100%",
                height: "500px",
                border: "none",
                marginTop: "20px",
              }}
            ></iframe>
          )}
        </Box>
      </Modal>
    </>
  );
};
