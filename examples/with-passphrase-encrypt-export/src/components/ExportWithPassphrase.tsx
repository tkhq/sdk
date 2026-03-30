import { useEffect, useState } from "react";
import { IframeStamper } from "@turnkey/iframe-stamper";
import { TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";
import clsx from "clsx";
import {
  ExportType,
  KeyFormat,
  useTurnkey,
  useModal,
  StamperType,
} from "@turnkey/react-wallet-kit";
import { Warning } from "./Warning";

const TurnkeyExportIframeContainerId = "turnkey-export-iframe-container-id";
const TurnkeyIframeElementId = "turnkey-default-iframe-element-id";
const TurnkeyIframeClassNames =
  "w-full h-full border-none !text-base bg-icon-background-light dark:bg-icon-background-dark";

// These must match --color-icon-* in the kit's index.css
const iconBackgroundLight = "#e5e7eb";
const iconBackgroundDark = "#333336";
const iconTextLight = "#828282";
const iconTextDark = "#a3a3a5";

export function ExportWithPassphraseComponent(params: {
  target: any;
  exportType: ExportType;
  targetPublicKey?: string;
  keyFormat?: KeyFormat | undefined;
  stampWith?: StamperType | undefined;
  organizationId?: string;
  onSuccess: () => void;
  onError: (error: any) => void;
}) {
  const {
    exportType,
    targetPublicKey,
    keyFormat,
    stampWith,
    target,
    organizationId,
    onSuccess,
    onError,
  } = params;

  const { config } = useTurnkey();

  if (!config) {
    throw new TurnkeyError(
      "Turnkey SDK is not properly configured. Please check your configuration.",
      TurnkeyErrorCodes.CONFIG_NOT_INITIALIZED,
    );
  }

  const exportIframeUrl = config?.exportIframeUrl;

  if (!exportIframeUrl) {
    throw new TurnkeyError(
      "Export iframe URL is not configured. Please set it in the Turnkey configuration.",
      TurnkeyErrorCodes.NOT_FOUND,
    );
  }

  const [exportIframeVisible, setExportIframeVisible] = useState(false);
  const [encryptedBundle, setEncryptedBundle] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exportIframeClient, setExportIframeClient] =
    useState<IframeStamper | null>(null);

  const [iframeError, setIframeError] = useState<boolean>(false);

  const { closeModal, isMobile } = useModal();

  const iframeStyles = () => ({
    fontSize: "16px",
    backgroundColor: config?.ui?.darkMode
      ? config?.ui?.colors?.dark?.iconBackground || iconBackgroundDark
      : config?.ui?.colors?.light?.iconBackground || iconBackgroundLight,
    color: config?.ui?.darkMode
      ? config?.ui?.colors?.dark?.iconText || iconTextDark
      : config?.ui?.colors?.light?.iconText || iconTextLight,
  });

  useEffect(() => {
    const initIframe = async () => {
      try {
        const client = new IframeStamper({
          iframeUrl: exportIframeUrl,
          iframeElementId: TurnkeyIframeElementId,
          iframeContainer: document.getElementById(
            TurnkeyExportIframeContainerId,
          ),
        });
        await client.init();
        await client.applySettings({ styles: iframeStyles() });
        setExportIframeClient(client);
      } catch (error) {
        onError(
          new TurnkeyError(
            "Error initializing IframeStamper",
            TurnkeyErrorCodes.INITIALIZE_IFRAME_ERROR,
            error,
          ),
        );
      }
    };

    if (!document.getElementById(TurnkeyIframeElementId)) {
      initIframe();
    }

    const iframeElement = document.getElementById(TurnkeyIframeElementId);
    if (iframeElement) {
      iframeElement.className = TurnkeyIframeClassNames;
    }

    return () => {
      setExportIframeClient(null);
      document.getElementById(TurnkeyIframeElementId)?.remove();
    };
  }, []);

  useEffect(() => {
    exportIframeClient?.applySettings({ styles: iframeStyles() });
  }, [config.ui]);

  async function handleSubmitPassphrase() {
    try {
      const bundle = await exportIframeClient?.confirmPassphraseExport();
      if (bundle) {
        setEncryptedBundle(bundle);
      }
    } catch (error) {
      onError(
        new TurnkeyError(
          "Error confirming passphrase export",
          TurnkeyErrorCodes.EXPORT_WALLET_ERROR,
          error,
        ),
      );
    }
  }

  async function handleCopy() {
    if (!encryptedBundle) return;
    await navigator.clipboard.writeText(encryptedBundle);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const iframeContainerStyle = {
    backgroundColor: config?.ui?.darkMode
      ? config?.ui?.colors?.dark?.iconBackground || iconBackgroundDark
      : config?.ui?.colors?.light?.iconBackground || iconBackgroundLight,
    borderColor: config?.ui?.darkMode
      ? config?.ui?.colors?.dark?.iconText || iconTextDark
      : config?.ui?.colors?.light?.iconText || iconTextLight,
    boxSizing: "border-box" as const,
    borderStyle: "solid",
    borderWidth: "1px",
    borderRadius: "8px",
    width: "100%",
  };

  return (
    <div
      className={clsx(
        "flex flex-col items-center pt-8",
        isMobile ? "w-full" : "w-96",
      )}
    >
      {/* Step 1: Warning / trigger export */}
      {!exportIframeVisible && (
        <Warning
          target={target}
          exportIframeClient={exportIframeClient}
          targetPublicKey={targetPublicKey}
          exportType={exportType}
          keyFormat={keyFormat}
          stampWith={stampWith}
          setExportIframeVisible={setExportIframeVisible}
          organizationId={organizationId}
          onError={onError}
        />
      )}

      {/* Step 2: Iframe shows seed phrase + passphrase input */}
      <div
        className={clsx(
          "transition-all delay-75 w-full flex flex-col gap-4",
          exportIframeVisible && !encryptedBundle
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none absolute",
        )}
      >
        <p className="text-xs text-icon-text-light dark:text-icon-text-dark">
          {exportType === ExportType.Wallet
            ? "Your seed phrase is the key to your wallet. Enter a passphrase below to encrypt it."
            : "Your private key is the key to your account. Enter a passphrase below to encrypt it."}
        </p>
        <div
          id={TurnkeyExportIframeContainerId}
          style={iframeContainerStyle}
          className={`py-1 px-4 h-[22.75rem]`}
        />
        <button
          name="submit-passphrase"
          onClick={handleSubmitPassphrase}
          className="w-full h-10 border border-neutral-400 text-primary-text-light dark:text-primary-text-dark bg-primary-light dark:bg-primary-dark"
        >
          Encrypt with Passphrase
        </button>
      </div>

      {/* Step 3: Show the encrypted bundle to copy and save */}
      {encryptedBundle && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-icon-text-light dark:text-icon-text-dark">
            Store this bundle somewhere safe. You'll need your passphrase to
            decrypt it later.
          </p>
          <textarea
            readOnly
            rows={5}
            value={encryptedBundle}
            className="py-3 px-4 rounded-md border border-modal-background-dark/20 dark:border-modal-background-light/20 bg-button-light dark:bg-button-dark font-mono text-xs resize-none focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 h-10 border border-neutral-400 text-primary-text-light dark:text-primary-text-dark bg-primary-light dark:bg-primary-dark"
            >
              {copied ? "Copied!" : "Copy Bundle"}
            </button>
            <button
              onClick={() => {
                closeModal();
                onSuccess();
              }}
              className="flex-1 h-10 border border-neutral-400 text-primary-text-light dark:text-primary-text-dark bg-primary-light dark:bg-primary-dark"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
