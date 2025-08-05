import {
  faCheck,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button, Checkbox } from "@headlessui/react";
import { useModal, useTurnkey, WalletSource } from "@turnkey/react-wallet-kit";
import { use, useEffect, useState } from "react";

export default function DeleteSubOrgWarning() {
  const { session, user, wallets, deleteSubOrganization, logout } =
    useTurnkey();
  const { isMobile, closeModal } = useModal();

  const [deleteWithoutExport, setDeleteWithoutExport] = useState(false);

  const handleContinue = async () => {
    try {
      await deleteSubOrganization({
        deleteWithoutExport: true,
      });
      closeModal();
      logout();
    } catch (error) {
      console.error("Error deleting sub-organization:", error);
    }
  };

  const unExportedWallets = wallets.filter(
    (wallet) => !wallet.exported && wallet.source !== WalletSource.Connected,
  );

  return (
    <div className={`mt-8 ${isMobile ? "w-full" : "w-96"}`}>
      <div className="mt-6 mb-5 flex flex-col items-center gap-3">
        <FontAwesomeIcon
          icon={faTriangleExclamation}
          size={"3x"}
          className="text-danger-light dark:text-danger-dark"
        />
        <div className="text-2xl font-bold text-center">Delete Account</div>
        <div className="text-icon-text-light dark:text-icon-text-dark text-center !p-0">
          This action is irreversible.
        </div>
        <div className="p-2 overflow-y-auto tk-scrollbar h-full mt-2 max-h-40 rounded-md border border-modal-background-dark/10 dark:border-modal-background-light/10 bg-icon-background-light dark:bg-icon-background-dark text-icon-text-light dark:text-icon-text-dark">
          <div className="text-sm font-mono!">
            Sub-org ID: {session!.organizationId}
          </div>

          {unExportedWallets.length > 0 &&
            unExportedWallets.map((wallet) => (
              <div key={wallet.walletId} className="text-sm font-mono!">
                Wallet: {wallet.walletName} (Unexported)
              </div>
            ))}
        </div>
      </div>
      {unExportedWallets.length > 0 && (
        <div className="flex items-center justify-center gap-2 mb-3">
          <Checkbox
            checked={deleteWithoutExport}
            onChange={(e) => setDeleteWithoutExport(e)}
            className="group flex items-center justify-center size-4 rounded border text-icon-background-light dark:text-icon-background-dark bg-icon-background-light dark:bg-icon-background-dark data-checked:text-danger-text-light dark:data-checked:text-danger-text-dark data-checked:bg-danger-light dark:data-checked:bg-danger-dark border-icon-text-light dark:border-icon-text-dark focus:outline-none focus:ring-2 focus:ring-danger-light dark:focus:ring-danger-dark transition-all"
          >
            {/* Checkmark icon */}
            <FontAwesomeIcon icon={faCheck} />
          </Checkbox>
          <span className="text-sm text-icon-text-light dark:text-icon-text-dark">
            Delete without exporting my wallets
          </span>
        </div>
      )}

      <div className="flex my-2 mt-0">
        <Button
          onClick={handleContinue}
          disabled={deleteWithoutExport}
          className="w-full p-3 rounded-md border-none max-w-md bg-danger-light dark:bg-danger-dark text-primary-text-light dark:text-primary-text-dark"
        >
          Delete Account
        </Button>
      </div>
    </div>
  );
}
