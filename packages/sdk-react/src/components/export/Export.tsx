import React, { useState } from "react";
import { Modal, Box, Typography } from "@mui/material";
import { useTurnkey } from "../../hooks/useTurnkey";
import { IframeStamper } from "@turnkey/sdk-browser";
import styles from "./Export.module.css";
import unlockIcon from "assets/unlock.svg";
import eyeIcon from "assets/eye.svg";
import cautionIcon from "assets/caution.svg";
import turnkeyIcon from "assets/turnkey.svg";
import exportIcon from "assets/export.svg"
type ExportProps = {
  walletId: string;
};

const Export: React.FC<ExportProps> = ({
  walletId,
}) => {
  const { authIframeClient } = useTurnkey();
  const [exportIframeStamper, setExportIframeStamper] = useState<IframeStamper | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isIframeVisible, setIsIframeVisible] = useState(false);
  const TurnkeyExportIframeContainerId = "turnkey-export-iframe-container-id";
  const TurnkeyIframeElementId = "turnkey-export-iframe-element-id";

  const handleOpenModal = async () => {
    setIsModalOpen(true);

    // Wait for the modal and its content to render
    requestAnimationFrame(async () => {
      const iframeContainer = document.getElementById(TurnkeyExportIframeContainerId);
      if (!iframeContainer) {
        console.error("Iframe container not found.");
        return;
      }

      const existingIframe = document.getElementById(TurnkeyIframeElementId);

      if (!existingIframe) {
        try {
          const iframeStamper = new IframeStamper({
            iframeContainer,
            iframeUrl: "https://export.preprod.turnkey.engineering",
            iframeElementId: TurnkeyIframeElementId,
          });

          await iframeStamper.init();
          const styles = {
            padding: "20px",
            fontFamily: "monospace",
            color: "#333",
            height: "240px",
            width: "240px",
            borderStyle: "none",
            backgroundColor: "#ffffff",
            overflowWrap: "break-word",
            wordWrap: "break-word",
            overflow: "hidden",
            resize: "none",
          };
          iframeStamper.applySettings({ styles });

          setExportIframeStamper(iframeStamper);
          console.log("IframeStamper initialized successfully.");
        } catch (error) {
          console.error("Error initializing IframeStamper:", error);
        }
      }
    });
  };

  const handleCloseModal = () => {
    // Clear the iframe stamper
    if (exportIframeStamper) {
      exportIframeStamper.clear();
      setExportIframeStamper(null);

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
    await exportWallet()  
    setIsIframeVisible(true);
  };

  const exportWallet = async () => {
    const whoami = await authIframeClient!.getWhoami();
    const exportResponse = await authIframeClient?.exportWallet({
      organizationId:         whoami.organizationId,
      walletId: walletId!,
      targetPublicKey: exportIframeStamper!.iframePublicKey!,
    });
    if (exportResponse?.exportBundle) {
      await exportIframeStamper?.injectWalletExportBundle(
        exportResponse.exportBundle,
        whoami.organizationId
      );
    }
  };

  return (
    <>
      <button className={styles.exportButton} onClick={handleOpenModal}>
      <img src = {exportIcon}/>
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
      width: "336px"
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

        {!isIframeVisible ?
        <div className={styles.rowsContainer}>
            <div className={styles.row}>
              <img src={cautionIcon} className={styles.rowIcon} />
              <span>Keep your seed phrase private.</span>
            </div>
            <div className={styles.row}>
              <img src={unlockIcon} className={styles.rowIcon} />
              <span>Anyone who has your seed phrase can access your wallet.</span>
            </div>
            <div className={styles.row}>
              <img src={eyeIcon} className={styles.rowIcon} />
              <span>Make sure nobody can see your screen when viewing your seed phrase</span>
            </div>
          </div>  :

<Typography
variant="subtitle2"
sx={{
  color: "#6C727E",
  mb: 2,
}}
>
Your seed phrase is the key to your wallet. Save it in a secure location.
</Typography>

}
    {!isIframeVisible && (
      <>
        <button
          onClick={handleExport}
          className={styles.exportButton}
        >
          Show seed phrase
        </button>
      </>
    )}
    <div
      id={TurnkeyExportIframeContainerId}
      style={{
        display: isIframeVisible ? "block" : "none",
        backgroundColor: "#ffffff",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.06)",
        borderStyle: "none",
        overflow: "hidden",
        borderRadius: "16px",
        padding: "16px",
      }}
    />
        {isIframeVisible && (
      <div className = {styles.doneButtonContainer}>
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
