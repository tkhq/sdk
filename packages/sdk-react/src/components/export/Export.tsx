import React, { useState } from "react";
import { Modal, Box, Typography } from "@mui/material";
import { useTurnkey } from "../../hooks/use-turnkey";
import type { TurnkeyIframeClient } from "@turnkey/sdk-browser";
import styles from "./Export.module.css";
import unlockIcon from "assets/unlock.svg";
import eyeIcon from "assets/eye.svg";
import cautionIcon from "assets/caution.svg";
import turnkeyIcon from "assets/turnkey.svg";
import exportIcon from "assets/export.svg";
type ExportProps = {
  walletId: string;
};

const Export: React.FC<ExportProps> = ({ walletId }) => {
  const { authIframeClient, turnkey } = useTurnkey();
  const [exportIframeClient, setExportIframeClient] =
    useState<TurnkeyIframeClient | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isIframeVisible, setIsIframeVisible] = useState(false);
  const TurnkeyExportIframeContainerId = "turnkey-export-iframe-container-id";
  const TurnkeyIframeElementId = "turnkey-default-iframe-element-id";

  const handleOpenModal = async () => {
    setIsModalOpen(true);

    // Wait for the modal and its content to render
    requestAnimationFrame(async () => {
      const iframeContainer = document.getElementById(
        TurnkeyExportIframeContainerId
      );
      if (!iframeContainer) {
        console.error("Iframe container not found.");
        return;
      }

      const existingIframe = document.getElementById(TurnkeyIframeElementId);

      if (!existingIframe) {
        try {
          const newExportIframeClient = await turnkey?.iframeClient({
            iframeContainer: document.getElementById(
              TurnkeyExportIframeContainerId
            ),
            iframeUrl: process.env.NEXT_PUBLIC_EXPORT_IFRAME_URL!,
          });
          setExportIframeClient(newExportIframeClient!);
        } catch (error) {
          console.error("Error initializing IframeStamper:", error);
        }
      }
    });
  };

  const handleCloseModal = () => {
    // Clear the iframe stamper
    if (exportIframeClient) {
      setExportIframeClient(null);

      const existingIframe = document.getElementById(TurnkeyIframeElementId);
      if (existingIframe) {
        existingIframe.remove();
      }
    }

    // Reset modal and iframe states
    setIsModalOpen(false);
    setIsIframeVisible(false);
  };

  const handleExport = async () => {
    await exportWallet();
    setIsIframeVisible(true);
  };

  const exportWallet = async () => {
    const whoami = await authIframeClient!.getWhoami();
    const exportResponse = await authIframeClient?.exportWallet({
      organizationId: whoami.organizationId,
      walletId: walletId!,
      targetPublicKey: exportIframeClient!.iframePublicKey!,
    });
    if (exportResponse?.exportBundle) {
      await exportIframeClient?.injectWalletExportBundle(
        exportResponse.exportBundle,
        whoami.organizationId
      );
    }
  };

  return (
    <>
      <button className={styles.exportButton} onClick={handleOpenModal}>
        <img src={exportIcon} />
        Export wallet
      </button>

      <Modal open={isModalOpen} onClose={handleCloseModal}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            bgcolor: "var(--Greyscale-20, #f5f7fb)",
            boxShadow: 24,
            p: 4,
            borderRadius: 2,
            width: "336px",
          }}
        >
          <div
            onClick={handleCloseModal}
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
            Export wallet
          </Typography>

          {!isIframeVisible ? (
            <div className={styles.rowsContainer}>
              <div className={styles.row}>
                <img src={cautionIcon} className={styles.rowIcon} />
                <span>Keep your seed phrase private.</span>
              </div>
              <div className={styles.row}>
                <img src={unlockIcon} className={styles.rowIcon} />
                <span>
                  Anyone who has your seed phrase can access your wallet.
                </span>
              </div>
              <div className={styles.row}>
                <img src={eyeIcon} className={styles.rowIcon} />
                <span>
                  Make sure nobody can see your screen when viewing your seed
                  phrase.
                </span>
              </div>
            </div>
          ) : (
            <Typography
              variant="subtitle2"
              sx={{
                color: "#6C727E",
                mb: 2,
              }}
            >
              Your seed phrase is the key to your wallet. Save it in a secure
              location.
            </Typography>
          )}
          {!isIframeVisible && (
            <>
              <button onClick={handleExport} className={styles.exportButton}>
                Show seed phrase
              </button>
            </>
          )}
          <div
            id={TurnkeyExportIframeContainerId}
            style={{
              display: isIframeVisible ? "block" : "none",
              backgroundColor: "#ffffff",
              width: "100%",
              boxSizing: "border-box",
              padding: "20px",
              borderStyle: "solid",
              borderWidth: "1px",
              borderRadius: "8px",
              borderColor: "rgba(216, 219, 227, 1)",
            }}
          />
          {isIframeVisible && (
            <div className={styles.doneButtonContainer}>
              <button
                onClick={handleCloseModal}
                className={styles.exportButton}
              >
                Done
              </button>
            </div>
          )}

          <div
            onClick={() => (window.location.href = "https://www.turnkey.com/")}
            className={styles.poweredBy}
          >
            <span>Secured by</span>
            <img src={turnkeyIcon} />
          </div>
        </Box>
      </Modal>
    </>
  );
};

export default Export;
