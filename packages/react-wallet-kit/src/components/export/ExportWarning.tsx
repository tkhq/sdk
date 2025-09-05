import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTriangleExclamation,
  IconDefinition,
  faUnlock,
  faEye,
} from "@fortawesome/free-solid-svg-icons";
import type { StamperType } from "@turnkey/core";
import {
  type Address,
  type WalletId,
  type PrivateKeyId,
  KeyFormat,
  ExportType,
} from "../../types/base";
import { useTurnkey } from "../../providers/client/Hook";
import { TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";
import { ActionButton } from "../design/Buttons";
import type { IframeStamper } from "@turnkey/iframe-stamper";
import { useState } from "react";

export function ExportWarning(props: {
  target: WalletId | PrivateKeyId | Address;
  exportIframeClient?: IframeStamper | null; // Replace with actual type if available
  targetPublicKey?: string | undefined;
  exportType: ExportType;
  keyFormat?: KeyFormat | undefined;
  setExportIframeVisible?: (visible: boolean) => void;
  stampWith?: StamperType | undefined;
}) {
  const {
    target,
    exportIframeClient,
    targetPublicKey,
    exportType,
    keyFormat,
    stampWith,
  } = props;

  const [isLoading, setIsLoading] = useState(false);

  const { exportWallet, exportPrivateKey, exportWalletAccount, session } =
    useTurnkey();

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
      <ActionButton
        loading={isLoading}
        spinnerClassName="text-primary-text-light dark:text-primary-text-dark"
        className="text-primary-text-light dark:text-primary-text-dark bg-primary-light dark:bg-primary-dark"
        onClick={async () => {
          setIsLoading(true);
          try {
            let exportBundle;
            switch (exportType) {
              case ExportType.Wallet:
                exportBundle = await exportWallet({
                  walletId: target,
                  targetPublicKey:
                    targetPublicKey || exportIframeClient?.iframePublicKey!,
                  ...(stampWith && { stampWith: stampWith }),
                });
                if (!exportBundle) {
                  throw new TurnkeyError(
                    "Failed to retrieve export bundle",
                    TurnkeyErrorCodes.EXPORT_WALLET_ERROR,
                  );
                }
                await exportIframeClient?.injectWalletExportBundle(
                  exportBundle,
                  session?.organizationId!,
                );
                break;
              case ExportType.PrivateKey:
                exportBundle = await exportPrivateKey({
                  privateKeyId: target,
                  targetPublicKey:
                    targetPublicKey || exportIframeClient?.iframePublicKey!,
                  ...(stampWith && { stampWith: stampWith }),
                });
                if (!exportBundle) {
                  throw new TurnkeyError(
                    "Failed to retrieve export bundle",
                    TurnkeyErrorCodes.EXPORT_WALLET_ERROR,
                  );
                }
                await exportIframeClient?.injectKeyExportBundle(
                  exportBundle,
                  session?.organizationId!,
                  keyFormat,
                );
                break;
              case ExportType.WalletAccount:
                exportBundle = await exportWalletAccount({
                  address: target,
                  targetPublicKey:
                    targetPublicKey || exportIframeClient?.iframePublicKey!,
                  ...(stampWith && { stampWith: stampWith }),
                });
                if (!exportBundle) {
                  throw new TurnkeyError(
                    "Failed to retrieve export bundle",
                    TurnkeyErrorCodes.EXPORT_WALLET_ERROR,
                  );
                }
                await exportIframeClient?.injectKeyExportBundle(
                  exportBundle,
                  session?.organizationId!,
                  keyFormat,
                );
                break;
              default:
                throw new TurnkeyError(
                  "Invalid export type",
                  TurnkeyErrorCodes.EXPORT_WALLET_ERROR,
                );
            }
            if (props.setExportIframeVisible) {
              props.setExportIframeVisible(true);
            }
          } catch (error) {
            throw new TurnkeyError(
              `Error exporting wallet`,
              TurnkeyErrorCodes.EXPORT_WALLET_ERROR,
              error,
            );
          } finally {
            setIsLoading(false);
          }
        }}
      >
        {exportType === ExportType.PrivateKey
          ? "Export Private Key"
          : "Export Wallet"}
      </ActionButton>
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
