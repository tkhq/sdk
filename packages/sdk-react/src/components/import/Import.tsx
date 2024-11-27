import React, { useState } from "react";
import { Modal, Box, Typography, TextField } from "@mui/material";
import { useTurnkey } from "../../hooks/useTurnkey";
import { DEFAULT_ETHEREUM_ACCOUNTS, DEFAULT_SOLANA_ACCOUNTS, IframeStamper } from "@turnkey/sdk-browser";
import styles from "./Import.module.css";
import turnkeyIcon from "assets/turnkey.svg";
import importIcon from "assets/import.svg"
type ImportProps = {
  onSuccess?: () => void;
};

const Import: React.FC<ImportProps> = ({
  onSuccess = () => undefined,
}) => {
  const { authIframeClient } = useTurnkey();
  const [importIframeStamper, setImportIframeStamper] = useState<IframeStamper | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [walletName, setWalletName] = useState("");
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
            width: "240px",
            borderStyle: "none",
            backgroundColor: "#ffffff",
            overflowWrap: "break-word",
            overflow: "hidden",
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
  };

  const handleImport = async () => {
    const whoami = await authIframeClient!.getWhoami();
    if (!importIframeStamper) {
      console.error("IframeStamper is not initialized.");
      return;
    }
    const initResult = await authIframeClient!.initImportWallet({
      organizationId:       whoami.organizationId,
      userId: whoami.userId,
    });
    const injected = await importIframeStamper!.injectImportBundle(
      initResult.importBundle,
      whoami.organizationId,
      whoami.userId
    );
    if (!injected){
      console.error("error injecting import bundle")
      return;
    }
    const encryptedBundle = await importIframeStamper.extractWalletEncryptedBundle();
    if (!encryptedBundle || encryptedBundle.trim() === "") {
      console.error("failed to retrieve encrypted bundle.")
      return;
    }
    const response = await authIframeClient?.importWallet({
      organizationId: whoami.organizationId,
      userId: whoami.userId,
      walletName: walletName,
      encryptedBundle,
      accounts: [
        ...DEFAULT_ETHEREUM_ACCOUNTS,
        ...DEFAULT_SOLANA_ACCOUNTS,
      ],
    });

    if (response) {
      console.log("Wallet imported successfully!");;
      handleCloseModal()
      onSuccess();
    } else {
      console.error("Failed to import wallet")
    }
  };

  return (
    <>
      <button className={styles.importButton} onClick={handleOpenModal}>
      <img src = {importIcon}/>
        Import wallet
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
                Enter your seed phrase. Seed phrases are typically 12 - 24 words
              </Typography>


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
        marginBottom: "16px"
      }}
    />

<TextField
                type="walletName"
                placeholder="Wallet name"
                value={walletName}
                onChange={(e) => setWalletName(e.target.value)}
                fullWidth
                style = {{
                  "marginTop": "12px",
                  "marginBottom": "12px"
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": {
                      borderColor: "#D0D5DD",
                    },
                    "&:hover fieldset": {
                      borderColor: "#8A929E",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "#D0D5DD",
                      border: "1px solid",
                    },
                  },
                  "& .MuiInputBase-input": {
                    padding: "12px",
                  },
                  backgroundColor: "white",
                }}
                variant="outlined"
              />
              


            <button
              onClick={handleImport}
              className={styles.importButton}
            >
              Import
            </button>

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

export default Import;
