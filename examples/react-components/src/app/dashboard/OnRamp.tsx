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

export const OnRamp = ({ ethAddress }: OnRampProps) => {
  const { turnkey, indexedDbClient } = useTurnkey();
  const [isSignModalOpen, setSignModalOpen] = useState(false);

  const handleModalOpen = () => setSignModalOpen(true);
  const handleModalClose = () => setSignModalOpen(false);

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

      <Modal open={isSignModalOpen} onClose={handleModalClose}>
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
          <div className="purchaseButtons">
            <button className="whiteButton" onClick={generateMoonPayUrl}>
              <img src="/images/moonpay.jpg" alt="MoonPay" />
              Buy with MoonPay
            </button>
          </div>
        </Box>
      </Modal>
    </>
  );
};
