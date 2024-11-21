import React, { useState } from "react";
import { Modal, Box, Typography } from "@mui/material";
import { useTurnkey } from "../../hooks/useTurnkey";
import { DEFAULT_ETHEREUM_ACCOUNTS, DEFAULT_SOLANA_ACCOUNTS, IframeStamper } from "@turnkey/sdk-browser";
import styles from "./Import.module.css";

type ImportProps = {
  onCancel?: () => void;
  onSuccess?: () => void;
};

const Import: React.FC<ImportProps> = ({
  onCancel = () => undefined,
  onSuccess = () => undefined,
}) => {
  const { authIframeClient } = useTurnkey();
  const [importIframeStamper, setImportIframeStamper] = useState<IframeStamper | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isIframeVisible, setIsIframeVisible] = useState(false);
  const TurnkeyImportIframeContainerId = "turnkey-import-iframe-container-id";
  const TurnkeyIframeElementId = "turnkey-import-iframe-element-id";

  const handleOpenModal = async () => {
    setIsModalOpen(true);

    requestAnimationFrame(async () => {
      const iframeContainer = document.getElementById(TurnkeyImportIframeContainerId);
      if (!iframeContainer) {
        console.error("Iframe container not found.");
        return;
      }

      const existingIframe = document.getElementById(TurnkeyIframeElementId);

      if (!existingIframe) {
        try {
          const iframeStamper = new IframeStamper({
            iframeContainer,
            iframeUrl: "https://import.preprod.turnkey.engineering",
            iframeElementId: TurnkeyIframeElementId,
          });

          await iframeStamper.init();
          const styles = {
            padding: "20px",
            fontFamily: "monospace",
            color: "#333",
            height: "240px",
            width: "280px",
            borderStyle: "none",
            backgroundColor: "#ffffff",
            overflowWrap: "break-word",
            wordWrap: "break-word",
            resize: "none",
          };
          iframeStamper.applySettings({ styles });

          setImportIframeStamper(iframeStamper);
          console.log("IframeStamper initialized successfully.");
        } catch (error) {
          console.error("Error initializing IframeStamper:", error);
        }
      }
    });
  };

  const handleCloseModal = () => {
    if (importIframeStamper) {
      importIframeStamper.clear();
      setImportIframeStamper(null);

      const existingIframe = document.getElementById(TurnkeyIframeElementId);
      if (existingIframe) {
        existingIframe.remove();
      }
    }

    setIsModalOpen(false);
    setIsIframeVisible(false);
  };

  const handleImport = async () => {
    if (!importIframeStamper) {
      console.error("IframeStamper is not initialized.");
      return;
    }

    const encryptedBundle = await importIframeStamper.extractWalletEncryptedBundle();
    if (!encryptedBundle || encryptedBundle.trim() === "") {
      alert("Failed to retrieve encrypted bundle.");
      return;
    }
    const whoami = await authIframeClient!.getWhoami();
    const response = await authIframeClient?.importWallet({
      organizationId: whoami.organizationId,
      userId: whoami.userId,
      walletName: "TEST",
      encryptedBundle,
      accounts: [
        ...DEFAULT_ETHEREUM_ACCOUNTS,
        ...DEFAULT_SOLANA_ACCOUNTS,
      ],
    });

    if (response) {
      console.log("Wallet imported successfully!");
      setIsIframeVisible(false);
      onSuccess();
    } else {
      alert("Failed to import wallet! Please try again.");
    }
  };

  return (
    <>
      {/* Button to open the modal */}
      <button className={styles.importButton} onClick={handleOpenModal}>
        Import Wallet
      </button>

      {/* Combined Modal */}
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
            width: "340px",
          }}
        >
          {/* Close Button */}
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

          {!isIframeVisible && (
            <>
              <Typography variant="h6" className="modalTitle">
                Import Wallet
              </Typography>
              <Typography
                variant="subtitle2"
                sx={{
                  color: "#6C727E",
                  mb: 2,
                }}
              >
                Import an existing wallet using your secret recovery phrase.
                Ensure that the phrase is entered securely.
              </Typography>
            </>
          )}

          {/* Import Flow */}
          {!isIframeVisible ? (
            <button
              onClick={handleImport}
              className={styles.importButton}
            >
              Continue to Import
            </button>
          ) : (
            <div
              id={TurnkeyImportIframeContainerId}
              style={{
                display: "block",
                backgroundColor: "#ffffff",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.06)",
                borderStyle: "none",
                overflow: "hidden",
                borderRadius: "16px",
                padding: "16px",
              }}
            />
          )}
        </Box>
      </Modal>
    </>
  );
};

export default Import;
