import React, { useState } from "react";
import { Modal, Box, Typography, TextField } from "@mui/material";
import { useTurnkey } from "../../hooks/use-turnkey";
import {
  DEFAULT_ETHEREUM_ACCOUNTS,
  DEFAULT_SOLANA_ACCOUNTS,
  TurnkeyIframeClient,
} from "@turnkey/sdk-browser";
import styles from "./Import.module.css";
import turnkeyIcon from "assets/turnkey.svg";
import importIcon from "assets/import.svg";
type ImportProps = {
  onError: (errorMessage: string) => void;
  onHandleImportSuccess: () => Promise<void>;
};

const Import: React.FC<ImportProps> = ({ onHandleImportSuccess, onError}) => {
  const { authIframeClient, turnkey } = useTurnkey();
  const [importIframeClient, setImportIframeClient] =
    useState<TurnkeyIframeClient | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [walletName, setWalletName] = useState("");
  const TurnkeyImportIframeContainerId = "turnkey-import-iframe-container-id";
  const TurnkeyIframeElementId = "turnkey-default-iframe-element-id";

  const handleOpenModal = async () => {
    setIsModalOpen(true);

    requestAnimationFrame(async () => {
      const iframeContainer = document.getElementById(
        TurnkeyImportIframeContainerId
      );
      if (!iframeContainer) {
        console.error("Iframe container not found.");
        return;
      }

      const existingIframe = document.getElementById(TurnkeyIframeElementId);

      if (!existingIframe) {
        try {
          const newImportIframeClient = await turnkey?.iframeClient({
            iframeContainer: document.getElementById(
              TurnkeyImportIframeContainerId
            ),
            iframeUrl: process.env.NEXT_PUBLIC_IMPORT_IFRAME_URL!,
          });
          setImportIframeClient(newImportIframeClient!);
        } catch (error) {
          console.error("Error initializing IframeStamper:", error);
        }
      }
    });
  };

  const handleCloseModal = () => {
    if (importIframeClient) {
      setImportIframeClient(null);

      const existingIframe = document.getElementById(TurnkeyIframeElementId);
      if (existingIframe) {
        existingIframe.remove();
      }
    }

    setIsModalOpen(false);
  };

  const handleImport = async () => {
    try {
      const whoami = await authIframeClient!.getWhoami();
      if (!importIframeClient) {
        throw new Error("Import iframe client not initialized");
      }

      const initResult = await authIframeClient!.initImportWallet({
        organizationId: whoami.organizationId,
        userId: whoami.userId,
      });

      const injected = await importIframeClient!.injectImportBundle(
        initResult.importBundle,
        whoami.organizationId,
        whoami.userId
      );

      if (!injected) {
        throw new Error("Failed to inject import bundle");
      }

      const encryptedBundle =
        await importIframeClient.extractWalletEncryptedBundle();

      if (!encryptedBundle || encryptedBundle.trim() === "") {
        throw new Error("Encrypted wallet bundle is empty or invalid");
      }

      const response = await authIframeClient?.importWallet({
        organizationId: whoami.organizationId,
        userId: whoami.userId,
        walletName: walletName,
        encryptedBundle,
        accounts: [...DEFAULT_ETHEREUM_ACCOUNTS, ...DEFAULT_SOLANA_ACCOUNTS],
      });

      if (response?.walletId) {
        handleCloseModal();
        onHandleImportSuccess();
      } else {
        throw new Error("Failed to import wallet");
      }
    } catch (error) {
      console.error("Error during wallet import:", error);
      onError("Failed to import wallet");
    }
  };

  return (
    <>
      <button className={styles.importButton} onClick={handleOpenModal}>
        <img src={importIcon} />
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
            width: "366px",
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
            Import wallet
          </Typography>
          <Typography
            variant="subtitle2"
            sx={{
              color: "#6C727E",
              mb: 2,
            }}
          >
            Enter your seed phrase. Seed phrases are typically 12-24 words.
          </Typography>

          <div
            id={TurnkeyImportIframeContainerId}
            style={{
              height: "100%",
              overflow: "hidden",
              display: "block",
              backgroundColor: "#ffffff",
              width: "100%",
              boxSizing: "border-box",
              padding: "5px",
              borderStyle: "solid",
              borderWidth: "1px",
              borderRadius: "8px",
              borderColor: "rgba(216, 219, 227, 1)",
            }}
          />
          {/* <div id = "import-iframe-container" className = {styles.iframeContainer}>
    <iframe id = {TurnkeyIframeElementId} src = "https://import.turnkey.com"/>
    </div> */}
          <TextField
            type="walletName"
            placeholder="Wallet name"
            value={walletName}
            onChange={(e) => setWalletName(e.target.value)}
            fullWidth
            style={{
              marginTop: "12px",
              marginBottom: "12px",
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

          <button onClick={handleImport} className={styles.importButton}>
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
