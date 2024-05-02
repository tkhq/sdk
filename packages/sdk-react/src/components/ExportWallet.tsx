import { useEffect, useRef, useState } from "react";
import { useTurnkey } from "../hooks/useTurnkey";
import type { TurnkeyIframeClient } from "@turnkey/sdk-browser";

type ExportWalletProps = {
  wallet: {
    walletName: string;
    walletId: string;
  },
  walletAccount: {
    address: string;
  },
  onCancel?: () => void
}

export const ExportWallet: React.FC<ExportWalletProps> = ({
  wallet,
  walletAccount,
  onCancel = () => undefined
}) => {
  const { turnkey, passkeyClient } = useTurnkey();
  const [iframeClient, setIframeClient] = useState<TurnkeyIframeClient | undefined>(undefined);
  const [iframeStyle, setIframeStyle] = useState<Record<any, any>>({ display: "none" });
  const iframeInit = useRef<boolean>(false);

  const TurnkeyExportIframeContainerId = "turnkey-export-iframe-container-id";

  useEffect(() => {
    (async () => {
      if (!iframeInit.current) {

        iframeInit.current = true;

        const newExportIframeClient = await turnkey?.iframeClient({
          iframeContainer: document.getElementById(TurnkeyExportIframeContainerId),
          iframeUrl: "https://export.turnkey.com"
        });
        setIframeClient(newExportIframeClient);

      }
    })();
  }, []);

  const exportWallet = async () => {
    const currentUser = await turnkey?.getCurrentUser();
    const exportResponse = await passkeyClient?.exportWallet({
      walletId: wallet.walletId,
      targetPublicKey: `${iframeClient?.iframePublicKey}`
    });
    if (exportResponse?.exportBundle) {
      const injectResponse = await iframeClient?.injectWalletExportBundle(
        exportResponse.exportBundle,
        `${currentUser?.organization.organizationId}`
      );
      if (injectResponse) {
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
    }
  }

  const exportWalletAccount = async () => {
    const currentUser = await turnkey?.getCurrentUser();
    const exportResponse = await passkeyClient?.exportWalletAccount({
      address: walletAccount.address,
      targetPublicKey: `${iframeClient?.iframePublicKey}`
    });
    if (exportResponse?.exportBundle) {
      const injectResponse = await iframeClient?.injectKeyExportBundle(
        exportResponse.exportBundle,
        `${currentUser?.organization.organizationId}`
      );
      if (injectResponse) {
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
    }
  }

  return (
    <div className="export-container">
      <p className="title-text">Export</p>
      <p className="subtitle-text">{`Wallet Name: ${wallet.walletName}`}</p>
      <p className="subtitle-text">{`Account Address: ${walletAccount.address}`}</p>

      <div className="action-buttons">
        <div
          className="action-button primary"
          onClick={exportWallet}>
          <p className="action-button-text">Export Wallet Seed</p>
        </div>

        <div
          className="action-button primary"
          onClick={exportWalletAccount}>
          <p className="action-button-text">Export Account Private Key</p>
        </div>

        <div
          className="action-button secondary"
          onClick={onCancel}>
          <p className="action-button-text">Cancel</p>
        </div>
      </div>

      <div id={TurnkeyExportIframeContainerId} style={iframeStyle} />
    </div>
  )
}
