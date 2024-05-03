import { useEffect, useRef, useState } from "react";
import { useTurnkey } from "../hooks/useTurnkey";
import type { TurnkeyIframeClient } from "@turnkey/sdk-browser";

type ImportWalletProps = {
  onCancel?: () => void;
  onWalletImportSuccess?: () => void;
  onWalletAccountImportSuccess?: () => void;
}

export const ImportWallet: React.FC<ImportWalletProps> = ({
  onCancel = () => undefined,
  onWalletImportSuccess = () => undefined,
  onWalletAccountImportSuccess = () => undefined
}) => {
  const { turnkey, passkeyClient } = useTurnkey();
  const [iframeClient, setIframeClient] = useState<TurnkeyIframeClient | undefined>(undefined);
  const [iframeStyle, setIframeStyle] = useState<Record<any, any>>({ display: "none" });
  const iframeInit = useRef<boolean>(false);

  const [initImportWalletComplete, setInitImportWalletComplete] = useState<boolean>(false);
  const [initImportWalletAccountComplete, setInitImportWalletAccountComplete] = useState<boolean>(false);

  const [newWalletName, setNewWalletName] = useState<string>('');

  const TurnkeyImportIframeContainerId = "turnkey-import-iframe-container-id";

  useEffect(() => {
    if (initImportWalletComplete) {
      setIframeStyle({
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        padding: "20px",
        borderStyle: "solid",
        borderWidth: "1px",
        borderRadius: "8px",
        borderColor: "rgba(216, 219, 227, 1)"
      });
    }
  }, [initImportWalletComplete])

  useEffect(() => {
    (async () => {
      if (!iframeInit.current) {

        iframeInit.current = true;

        const newImportIframeClient = await turnkey?.iframeClient({
          iframeContainer: document.getElementById(TurnkeyImportIframeContainerId),
          iframeUrl: "https://import.turnkey.com"
        });
        setIframeClient(newImportIframeClient);

      }
    })();
  }, []);

  const initImportWallet = async () => {

    const currentUser = await turnkey?.getCurrentUser();
    const initImportResponse = await passkeyClient?.initImportWallet({
      userId: `${currentUser?.userId}`
    });

    if (initImportResponse?.importBundle) {
      const injectResponse = await iframeClient?.injectImportBundle(
        initImportResponse.importBundle,
        `${currentUser?.organization.organizationId}`,
        `${currentUser?.userId}`
      );
      if (injectResponse) {
        setInitImportWalletComplete(true);
      }
    }

  }

  const importWallet = async () => {
    const currentUser = await turnkey?.getCurrentUser();
    const encryptedBundle = await iframeClient?.extractWalletEncryptedBundle();

    if (encryptedBundle) {
      const importResponse = await passkeyClient?.importWallet({
        userId: `${currentUser?.userId}`,
        walletName: newWalletName,
        encryptedBundle,
        accounts: []
      });

      if (importResponse) {
        onWalletImportSuccess();
      }

    }

  }

  const initImportWalletAccount = async () => {

  }

  const importWalletAccount = async () => {
    console.log(`Called Import Wallet Account`);
  }

  return (
    <div className="import-container">
      <p className="title-text">Import Wallet</p>

      <div className="action-buttons">
        <div
          className={`action-button primary ${initImportWalletComplete ? "disabled" : ""}`}
          onClick={initImportWallet}>
          <p className="action-button-text">Begin Wallet Import</p>
        </div>

        <div
          className={`action-button primary ${initImportWalletComplete ? "disabled" : ""}`}
          onClick={importWalletAccount}>
          <p className="action-button-text">Begin Account Private Key Import</p>
        </div>

        <div
          className="action-button secondary"
          onClick={onCancel}>
          <p className="action-button-text">Cancel</p>
        </div>
      </div>

      {initImportWalletComplete ? (
        <p className="label paste-mnemonic">Paste your Mnemonic Here</p>
      ) : (<></>)}

      <div id={TurnkeyImportIframeContainerId} style={iframeStyle} />

      {initImportWalletComplete ? (
        <>
          <div className="wallet-name-section">
            <p className="label">Wallet Name</p>
            <input
              type="text"
              placeholder="Example Wallet"
              value={newWalletName}
              onChange={(e) => setNewWalletName(e.target.value) } />
          </div>

          <div
            className="action-button primary"
            onClick={importWallet}>
            <p className="action-button-text">Import Wallet</p>
          </div>
        </>
      ) : (<></>)}
    </div>
  )
}
