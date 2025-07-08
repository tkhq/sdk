import { useEffect, useState } from "react";
import { useModal, useTurnkey } from "../../providers";
import { StamperType } from "@turnkey/sdk-js";
import { IframeStamper } from "@turnkey/iframe-stamper";
import { TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";
import { ExportWarn } from "./ExportWarn";
import { ActionButton } from "../design/Buttons";

export enum ExportType {
  Wallet = "WALLET",
  PrivateKey = "PRIVATE_KEY",
}

const TurnkeyExportIframeContainerId = "turnkey-export-iframe-container-id";
const TurnkeyIframeElementId = "turnkey-default-iframe-element-id";

export function ExportComponent(params: {
  walletId: string;
  exportType: ExportType;
  targetPublicKey?: string;
  stamperType?: StamperType;
}) {
  const { exportType, targetPublicKey, stamperType, walletId } = params;
  const { config } = useTurnkey();

  const [exportIframeVisible, setExportIframeVisible] = useState(false);

  const { closeModal } = useModal();

  const apiBaseUrl = config?.apiBaseUrl ?? "http://localhost:8081/";
  const exportIframeUrl = config?.exportIframeUrl;

  if (!exportIframeUrl || !apiBaseUrl) {
    throw new TurnkeyError(
      "Export iframe URL or API base URL is not configured. Please set them in the Turnkey configuration.",
      TurnkeyErrorCodes.NOT_FOUND,
    );
  }

  const [exportIframeClient, setExportIframeClient] =
    useState<IframeStamper | null>(null);

  if (!apiBaseUrl) {
    throw new TurnkeyError(
      "API base URL is not configured. Please set it in the Turnkey configuration.",
    );
  }

  useEffect(() => {
    const initIframe = async () => {
      try {
        const newExportIframeClient = new IframeStamper({
          iframeUrl: exportIframeUrl,
          iframeElementId: TurnkeyIframeElementId,
          iframeContainer: document.getElementById(
            TurnkeyExportIframeContainerId,
          ),
        });
        await newExportIframeClient.init();
        setExportIframeClient(newExportIframeClient);
      } catch (error) {
        throw new TurnkeyError(
          `Error initializing IframeStamper`,
          TurnkeyErrorCodes.INTERNAL_ERROR,
          error,
        );
      }
    };

    const existingIframe = document.getElementById(TurnkeyIframeElementId);
    if (!existingIframe) {
      initIframe();
    }

    const iframeElement = document.getElementById(TurnkeyIframeElementId);
    if (iframeElement) {
      iframeElement.className = "w-full border-none";
    }
    return () => {
      handleExportModalClose();
    };
  }, []);

  function handleExportModalClose() {
    if (exportIframeClient) {
      setExportIframeClient(null);

      const existingIframe = document.getElementById(TurnkeyIframeElementId);
      if (existingIframe) {
        existingIframe.remove();
      }
    }
  }

  return (
    <div className="flex flex-col items-center w-72 pt-8">
      {!exportIframeVisible && (
        <ExportWarn
          walletId={walletId}
          exportIframeClient={exportIframeClient}
          targetPublicKey={targetPublicKey}
          exportType={exportType}
          stamperType={stamperType}
          setExportIframeVisible={setExportIframeVisible}
        />
      )}
      <div
        className={`transition-all delay-75 -pt-4 ${
          exportIframeVisible
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none w-0 h-0"
        }`}
      >
        <p className="text-xs text-icon-text-light dark:text-icon-text-dark">
          Your seed phrase is the key to your wallet. Save it in a secure
          location.
        </p>
        <div
          id={TurnkeyExportIframeContainerId}
          style={{
            backgroundColor: "#ffffff",
            boxSizing: "border-box",
            borderStyle: "solid",
            borderWidth: "1px",
            borderRadius: "8px",
            width: "100%",
            height: "100%",
            borderColor: "rgba(216, 219, 227, 1)",
          }}
          className="p-2"
        />

        <div className="mt-4">
          <ActionButton
            onClick={closeModal}
            spinnerClassName="text-primary-text-light dark:text-primary-text-dark"
            className="text-primary-text-light dark:text-primary-text-dark bg-primary-light dark:bg-primary-dark"
          >
            Done
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
