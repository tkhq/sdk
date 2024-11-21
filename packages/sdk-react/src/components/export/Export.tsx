import React, { useState } from "react";
import { Modal, Box, Typography } from "@mui/material";
import { useTurnkey } from "../../hooks/useTurnkey";
import { IframeStamper } from "@turnkey/sdk-browser";
import styles from "./Export.module.css";

type ExportProps = {
  walletId?: string;
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
    const exportResponse = await authIframeClient?.exportWallet({
      walletId: walletId!,
      targetPublicKey: exportIframeStamper!.iframePublicKey!,
    });
    const whoami = await authIframeClient!.getWhoami();
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

{!isIframeVisible &&
<>
    <Typography variant="h6" className="modalTitle">
          Export wallet
        </Typography>
        <Typography
      variant="subtitle2"
      sx={{
        color: "#6C727E",
        mb: 2,
      }}
    >
      Exporting your seed phrase poses significant security risks. Ensure it is stored securely and never shared with anyone. Anyone with access to your seed phrase can gain full control over your wallet and funds. Proceed with caution.
    </Typography>
    </>
}
    {!isIframeVisible && (
      <>
      <center>
        <Typography variant="body1" sx={{ mb: 1}}>
          Are you sure you want to export?
        </Typography>
        </center>
        <button
          onClick={handleExport}
          className={styles.exportButton}
        >
          Yes, Continue
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
  </Box>
</Modal>


    </>
  );
};

export default Export;
