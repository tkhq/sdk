import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTriangleExclamation,
  IconDefinition,
  faUnlock,
  faEye,
} from "@fortawesome/free-solid-svg-icons";
import { TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";
import type { IframeStamper } from "@turnkey/iframe-stamper";
import {
  WalletId,
  PrivateKeyId,
  Address,
  ExportType,
  useTurnkey,
  KeyFormat,
  StamperType,
} from "@turnkey/react-wallet-kit";

export function Warning(props: {
  target: WalletId | PrivateKeyId | Address;
  exportIframeClient?: IframeStamper | null; // Replace with actual type if available
  targetPublicKey?: string | undefined;
  exportType: ExportType;
  keyFormat?: KeyFormat | undefined;
  setExportIframeVisible?: (visible: boolean) => void;
  stampWith?: StamperType | undefined;
  organizationId?: string | undefined;
  onError: (error: any) => void;
}) {
  const { target, exportIframeClient, exportType, stampWith, onError } = props;

  const { exportWallet, session } = useTurnkey();

  const warnings: Record<ExportType, string[]> = {
    [ExportType.Wallet]: [
      "Keep your seed phrase private.",
      "Anyone who has your seed phrase can access your wallet.",
      "Make sure nobody can see your screen when viewing your seed phrase.",
    ],
    [ExportType.PrivateKey]: [
      "Keep your private key private.",
      "Anyone who has your private key can access your wallet.",
      "Make sure nobody can see your screen when viewing your private key.",
    ],
    [ExportType.WalletAccount]: [
      "Keep your account details private.",
      "Anyone who has your account details can access your wallet.",
      "Make sure nobody can see your screen when viewing your account details.",
    ],
  };

  const organizationId = props.organizationId || session?.organizationId;

  if (!organizationId) {
    throw new TurnkeyError(
      "Organization ID is required for exporting.",
      TurnkeyErrorCodes.EXPORT_WALLET_ERROR,
    );
  }

  return (
    <div className="flex flex-col w-full px-10">
      <div className="flex flex-col gap-4 py-6 text-icon-text-light dark:text-icon-text-dark">
        <IconText
          icon={faTriangleExclamation}
          text={warnings[exportType][0]!}
        />
        <IconText icon={faUnlock} text={warnings[exportType][1]!} />
        <IconText icon={faEye} text={warnings[exportType][2]!} />
      </div>
      <button
        name="confirm-export-warning-button"
        className="text-primary-text-light h-10 border border-neutral-400 dark:text-primary-text-dark bg-primary-light dark:bg-primary-dark"
        onClick={async () => {
          try {
            const exportBundle = await exportWallet({
              walletId: target,
              targetPublicKey: exportIframeClient?.iframePublicKey!,
              ...(stampWith && { stampWith: stampWith }),
              organizationId,
            });
            if (!exportBundle) {
              onError(
                new TurnkeyError(
                  "Failed to retrieve export bundle",
                  TurnkeyErrorCodes.EXPORT_WALLET_ERROR,
                ),
              );
            }

            const encryptedPromise =
              exportIframeClient?.injectWalletExportBundle(
                exportBundle,
                organizationId,
                true, // encryptToPassphrase
              );
            props.setExportIframeVisible!(true);

            // Await after we switch the view to the iframe so that the user sees the passphrase input flow while we wait for the injection to finish
            await encryptedPromise;
          } catch (error) {
            onError(
              new TurnkeyError(
                `Error exporting wallet`,
                TurnkeyErrorCodes.EXPORT_WALLET_ERROR,
                error,
              ),
            );
          } finally {
          }
        }}
      >
        {exportType === ExportType.PrivateKey
          ? "Export Private Key"
          : "Export Wallet"}
      </button>
    </div>
  );
}

function IconText(props: { icon: IconDefinition; text: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-6 h-fit shrink-0 flex items-center justify-center">
        <FontAwesomeIcon size={"lg"} icon={props.icon} />
      </div>
      <span className="text-sm">{props.text}</span>
    </div>
  );
}
