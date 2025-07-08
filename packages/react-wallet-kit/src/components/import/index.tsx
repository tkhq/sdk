import { useEffect, useState } from "react";
import { useModal, useTurnkey } from "../../providers";
import { IframeStamper } from "@turnkey/iframe-stamper";
import {
  TurnkeyError,
  TurnkeyErrorCodes,
  v1AddressFormat,
  v1WalletAccount,
} from "@turnkey/sdk-types";
import { ActionButton } from "../design/Buttons";
import { Input } from "@headlessui/react";
import {
  generateWalletAccountsFromAddressFormat,
  WalletAccount,
} from "@turnkey/sdk-js";
import { SuccessPage } from "../design/Success";

export enum ExportType {
  Wallet = "WALLET",
  PrivateKey = "PRIVATE_KEY",
}

const TurnkeyImportIframeContainerId = "turnkey-import-iframe-container-id";
const TurnkeyIframeElementId = "turnkey-default-iframe-element-id";

export function ImportComponent(params: {
  defaultWalletAccounts?: v1AddressFormat[] | v1WalletAccount[];
  onImportSuccess?: (walletId: string) => void;
  successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
}) {
  const { onImportSuccess, defaultWalletAccounts, successPageDuration } =
    params;

  const { config, session, importWallet, httpClient } = useTurnkey();
  const [walletName, setWalletName] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<TurnkeyError | null>(null);

  const [shaking, setShaking] = useState(false);

  const shakeInput = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 250);
  };

  const apiBaseUrl = config?.apiBaseUrl;
  const importIframeUrl = config?.importIframeUrl!;

  const { closeModal, pushPage } = useModal();

  const [importIframeClient, setImportIframeClient] =
    useState<IframeStamper | null>(null);

  if (!apiBaseUrl) {
    throw new TurnkeyError(
      "API base URL is not configured. Please set it in the Turnkey configuration.",
    );
  }

  useEffect(() => {
    const initIframe = async () => {
      try {
        const newImportIframeClient = new IframeStamper({
          iframeUrl: importIframeUrl,
          iframeElementId: TurnkeyIframeElementId,
          iframeContainer: document.getElementById(
            TurnkeyImportIframeContainerId,
          ),
        });
        await newImportIframeClient.init();
        setImportIframeClient(newImportIframeClient);
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
      iframeElement.className = "w-full h-full overflow-hidden border-none";
    }
    return () => {
      handleImportModalClose();
    };
  }, []);

  function handleImportModalClose() {
    if (importIframeClient) {
      setImportIframeClient(null);

      const existingIframe = document.getElementById(TurnkeyIframeElementId);
      if (existingIframe) {
        existingIframe.remove();
      }
    }
  }

  async function handleImport() {
    setIsLoading(true);
    try {
      if (!importIframeClient) {
        throw new TurnkeyError(
          "Import iframe client not initialized",
          TurnkeyErrorCodes.INTERNAL_ERROR,
        );
      }
      const initResult = await httpClient?.initImportWallet({
        organizationId: session?.organizationId!,
        userId: session?.userId!,
      });

      if (!initResult || !initResult.importBundle) {
        throw new TurnkeyError(
          "Failed to retrieve import bundle",
          TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
        );
      }

      const injected = await importIframeClient.injectImportBundle(
        initResult.importBundle,
        session?.organizationId!,
        session?.userId!,
      );

      if (!injected) {
        throw new TurnkeyError(
          "Failed to inject import bundle",
          TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
        );
      }
      const encryptedBundle =
        await importIframeClient.extractWalletEncryptedBundle();
      if (!encryptedBundle || encryptedBundle.trim() === "") {
        throw new TurnkeyError(
          "Encrypted bundle is empty",
          TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
        );
      }

      let accounts: WalletAccount[] = [];
      if (
        Array.isArray(defaultWalletAccounts) &&
        defaultWalletAccounts.length > 0 &&
        (defaultWalletAccounts as any[])[0]?.addressFormat === undefined
      ) {
        accounts = generateWalletAccountsFromAddressFormat(
          defaultWalletAccounts as v1AddressFormat[],
        );
      } else if (Array.isArray(defaultWalletAccounts)) {
        accounts = defaultWalletAccounts as WalletAccount[];
      }

      const response = await importWallet({
        walletName: walletName,
        accounts,
        encryptedBundle,
      });

      if (response) {
        onImportSuccess?.(response);
        if (successPageDuration && successPageDuration !== 0) {
          pushPage({
            key: "success",
            content: (
              <SuccessPage
                text="Wallet Imported Successfully!"
                duration={successPageDuration}
                onComplete={() => {
                  handleImportModalClose();
                  closeModal();
                }}
              />
            ),
            preventBack: true,
            showTitle: false,
          });
        } else {
          handleImportModalClose();
          closeModal();
        }
        handleImportModalClose();
      } else {
        await importIframeClient.clear();
        throw new TurnkeyError(
          "Failed to import wallet",
          TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
        );
      }
    } catch (error) {
      shakeInput();
      setError(
        error instanceof TurnkeyError
          ? error
          : new TurnkeyError(
              `Error importing wallet`,
              TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
              error,
            ),
      );
      if (error instanceof TurnkeyError) throw error; // Re-throw known Turnkey errors
      throw new TurnkeyError(
        `Error importing wallet`,
        TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
        error,
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center w-[21rem] pt-4 p-2">
      <p className="text-sm text-icon-text-light dark:text-icon-text-dark">
        Enter your seed phrase. Seed phrases are typically 12-24 words.
      </p>
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
        className={`transition-all ${shaking ? "animate-shake" : ""}`}
      />
      <Input
        type="text"
        placeholder="Enter your wallet name"
        value={walletName}
        onChange={(e) => setWalletName(e.target.value)}
        className="w-full my-2 py-3 px-3 rounded-md text-inherit bg-button-light dark:bg-button-dark border border-modal-background-dark/20 dark:border-modal-background-light/20 focus:outline-primary-light focus:dark:outline-primary-dark focus:outline-[1px] focus:outline-offset-0 box-border"
      />
      <ActionButton
        loading={isLoading}
        spinnerClassName="text-primary-text-light dark:text-primary-text-dark"
        onClick={handleImport}
        className="bg-primary-light dark:bg-primary-dark text-primary-text-light dark:text-primary-text-dark"
      >
        Import
      </ActionButton>
      <p
        className={`text-sm text-red-500 transition-opacity delay-75 ${error ? "opacitiy-100 pointer-events-auto mt-2" : "opacity-0 pointer-events-none absolute"}`}
      >
        {error?.message}:{" "}
        {error?.cause instanceof TurnkeyError
          ? error?.cause.message
          : error?.cause?.toString() || "Unknown error"}
      </p>
    </div>
  );
}
