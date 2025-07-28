import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTriangleExclamation,
  IconDefinition,
  faUnlock,
  faEye,
} from "@fortawesome/free-solid-svg-icons";
import type { DefaultParams } from "@turnkey/sdk-js";
import { ExportType } from "../../types/base";
import { useTurnkey } from "../../providers/client/Hook";
import { TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";
import { ActionButton } from "../design/Buttons";
import type { IframeStamper } from "@turnkey/iframe-stamper";
import { useState } from "react";

export function ExportWarning(
  props: {
    walletId: string;
    exportIframeClient?: IframeStamper | null; // Replace with actual type if available
    targetPublicKey?: string | undefined;
    exportType: ExportType;
    setExportIframeVisible?: (visible: boolean) => void;
  } & DefaultParams,
) {
  const {
    walletId,
    exportIframeClient,
    targetPublicKey,
    exportType,
    stampWith,
  } = props;

  const [isLoading, setIsLoading] = useState(false);

  const { exportWallet, session } = useTurnkey();
  return (
    <div className="flex flex-col w-full px-10">
      <div className="flex flex-col gap-4 py-6 text-icon-text-light dark:text-icon-text-dark">
        <IconText
          icon={faTriangleExclamation}
          text="Keep your seed phrase private."
        />
        <IconText
          icon={faUnlock}
          text="Anyone who has your seed phrase can access your wallet."
        />
        <IconText
          icon={faEye}
          text="Make sure nobody can see your screen when viewing your seed phrase."
        />
      </div>
      <ActionButton
        loading={isLoading}
        spinnerClassName="text-primary-text-light dark:text-primary-text-dark"
        className="text-primary-text-light dark:text-primary-text-dark bg-primary-light dark:bg-primary-dark"
        onClick={async () => {
          setIsLoading(true);
          try {
            const exportBundle = await exportWallet({
              walletId: walletId,
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
