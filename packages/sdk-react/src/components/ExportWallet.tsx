import { useEffect, useRef, useState } from "react";
import { useTurnkey } from "../hooks/useTurnkey";
import type { TurnkeyIframeClient } from "@turnkey/sdk-browser";

type ExportWalletProps = {
  onCancel?: () => void
}

export const ExportWallet: React.FC<ExportWalletProps> = ({
  onCancel = () => undefined
}) => {
  const { turnkey, passkeyClient } = useTurnkey();
  const [iframeClient, setIframeClient] = useState<TurnkeyIframeClient | undefined>(undefined);
  const [iframeStyle, setIframeStyle] = useState<Record<any, any>>({ display: "none" });
  const iframeInit = useRef<boolean>(false);

  const [wallets, setWallets] = useState<any[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<any>(undefined);
  const [walletAccounts, setWalletAccounts] = useState<any>([]);
  const [selectedWalletAccount, setSelectedWalletAccount] = useState<any>(undefined);

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

  useEffect(() => {
    if (turnkey) {
      (async () => {
        const currentUserSession = await turnkey.currentUserSession();
        if (currentUserSession) {
          const walletsResponse = await currentUserSession.getWallets();
          if (walletsResponse) {
            setWallets(walletsResponse.wallets);
            setSelectedWallet(walletsResponse.wallets[0]);
          }
        }
      })();
    }
  }, [turnkey]);

  useEffect(() => {
    if (turnkey) {
      (async () => {
        const currentUserSession = await turnkey.currentUserSession();
        if (currentUserSession) {
          if (selectedWallet) {
            const walletAccountsResponse = await currentUserSession.getWalletAccounts({
              walletId: selectedWallet.walletId
            });
            if (walletAccountsResponse) {
              setWalletAccounts(walletAccountsResponse.accounts);
              setSelectedWalletAccount(walletAccountsResponse.accounts[0]);
            }
          }
        }
      })();
    }
  }, [selectedWallet]);

  const exportWallet = async () => {
    const currentUser = await turnkey?.getCurrentUser();
    const exportResponse = await passkeyClient?.exportWallet({
      walletId: selectedWallet.walletId,
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
      address: selectedWalletAccount.address,
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

      <div className="select-section-container">
        <div className="select-section wallet-select-section">
          <p className="label">Select Wallet:</p>
          <select
            className="wallets-select"
            value={selectedWallet?.walletId}
            onChange={(e) => setSelectedWallet(wallets.find((x: any) => x.walletId === e.target.value))}>
            {wallets?.map((wallet: any, index: number) => (
              <option key={index} value={wallet.walletId}>
                {wallet.walletName}
              </option>
            ))}
          </select>
        </div>

        <div className="select-section wallet-account-select-section">
          <p className="label">Select Wallet Account:</p>
          <select
            className="wallet-accounts-select"
            value={selectedWalletAccount?.address}
            onChange={(e) => setSelectedWalletAccount(walletAccounts.find((x: any) => x.address === e.target.value))}>
            {walletAccounts?.map((walletAccount: any, index: number) => (
              <option key={index} value={walletAccount.address}>
                {walletAccount.address}
              </option>
            ))}
          </select>
        </div>

      </div>

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
