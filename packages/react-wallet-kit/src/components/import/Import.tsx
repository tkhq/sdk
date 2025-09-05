import { useEffect, useState } from "react";
import { useModal } from "../../providers/modal/Hook";
import { useTurnkey } from "../../providers/client/Hook";
import { IframeStamper } from "@turnkey/iframe-stamper";
import {
  TurnkeyError,
  TurnkeyErrorCodes,
  v1AddressFormat,
  v1Curve,
  v1WalletAccountParams,
} from "@turnkey/sdk-types";
import { ActionButton } from "../design/Buttons";
import { Input } from "@headlessui/react";
import {
  type StamperType,
  generateWalletAccountsFromAddressFormat,
} from "@turnkey/core";
import { SuccessPage } from "../design/Success";
import clsx from "clsx";
import { ImportType } from "../../types/base";

const TurnkeyImportIframeContainerId = "turnkey-import-iframe-container-id";
const TurnkeyIframeElementId = "turnkey-default-iframe-element-id";
const TurnkeyIframeClassNames =
  "w-full h-full overflow-hidden border-none !text-base bg-icon-background-light dark:bg-icon-background-dark";

// IMPORTANT: These colors need to match --icon-text-light, --icon-background-light, --icon-background-dark and --icon-text-dark in index.css
const iconBackgroundLight = "#e5e7eb";
const iconBackgroundDark = "#333336";
const iconTextLight = "#828282";
const iconTextDark = "#a3a3a5";

export function ImportComponent(props: {
  importType: ImportType;
  defaultWalletAccounts?: v1AddressFormat[] | v1WalletAccountParams[];
  addressFormats?: v1AddressFormat[] | undefined; // Only used if importType is ImportType.PrivateKey
  curve?: v1Curve | undefined; // Only used if importType is ImportType.PrivateKey
  onSuccess: (id: string) => void;
  onError: (error: TurnkeyError) => void;
  successPageDuration?: number | undefined; // Duration in milliseconds for the success page to show. If 0, it will not show the success page.
  stampWith?: StamperType | undefined;
}) {
  const {
    importType,
    curve = "CURVE_SECP256K1",
    addressFormats = ["ADDRESS_FORMAT_ETHEREUM"],
    onSuccess,
    onError,
    defaultWalletAccounts,
    successPageDuration,
    stampWith,
  } = props;

  const { config, session, importWallet, importPrivateKey, httpClient } =
    useTurnkey();

  if (!config) {
    throw new TurnkeyError(
      "Turnkey SDK is not properly configured. Please check your configuration.",
      TurnkeyErrorCodes.CONFIG_NOT_INITIALIZED,
    );
  }

  const [walletName, setWalletName] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<TurnkeyError | null>(null);

  const [shaking, setShaking] = useState(false);

  const shakeInput = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 250);
  };

  const importIframeUrl = config?.importIframeUrl!;

  const { closeModal, pushPage, isMobile } = useModal();

  const [importIframeClient, setImportIframeClient] =
    useState<IframeStamper | null>(null);

  const subtitle =
    importType === ImportType.Wallet
      ? "Enter your seed phrase. Seed phrases are typically 12-24 words."
      : importType === ImportType.PrivateKey
        ? "Enter your private key."
        : "";

  const placeholder =
    importType === ImportType.Wallet
      ? "Enter your wallet name"
      : importType === ImportType.PrivateKey
        ? "Enter your private key name"
        : "";

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
        await newImportIframeClient.applySettings({
          styles: {
            fontSize: "16px",
            // IMPORTANT: These colors need to match --icon-text-light and --icon-text-dark in index.css
            backgroundColor: config?.ui?.darkMode
              ? config?.ui?.colors?.dark?.iconBackground || iconBackgroundDark
              : config?.ui?.colors?.light?.iconBackground ||
                iconBackgroundLight,
            color: config?.ui?.darkMode
              ? config?.ui?.colors?.dark?.iconText || iconTextDark
              : config?.ui?.colors?.light?.iconText || iconTextLight,
          },
        });
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
      iframeElement.className = TurnkeyIframeClassNames;
    }

    return () => {
      handleImportModalClose();
    };
  }, []);

  useEffect(() => {
    const reapplyIframeStyles = async () => {
      await importIframeClient?.applySettings({
        styles: {
          fontSize: "16px",
          backgroundColor: config?.ui?.darkMode
            ? config?.ui?.colors?.dark?.iconBackground || iconBackgroundDark
            : config?.ui?.colors?.light?.iconBackground || iconBackgroundLight,
          color: config?.ui?.darkMode
            ? config?.ui?.colors?.dark?.iconText || iconTextDark
            : config?.ui?.colors?.light?.iconText || iconTextLight,
        },
      });
    };
    reapplyIframeStyles();
  }, [config.ui]);

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
      let response;
      switch (importType) {
        case ImportType.Wallet:
          const initWalletResult = await httpClient?.initImportWallet({
            organizationId: session?.organizationId!,
            userId: session?.userId!,
          });

          if (!initWalletResult || !initWalletResult.importBundle) {
            throw new TurnkeyError(
              "Failed to retrieve import bundle",
              TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
            );
          }

          const injectedWallet = await importIframeClient.injectImportBundle(
            initWalletResult.importBundle,
            session?.organizationId!,
            session?.userId!,
          );

          if (!injectedWallet) {
            throw new TurnkeyError(
              "Failed to inject import bundle",
              TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
            );
          }
          const encryptedWalletBundle =
            await importIframeClient.extractWalletEncryptedBundle();
          if (!encryptedWalletBundle || encryptedWalletBundle.trim() === "") {
            throw new TurnkeyError(
              "Encrypted bundle is empty",
              TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
            );
          }

          let accounts: v1WalletAccountParams[] = [];
          if (
            Array.isArray(defaultWalletAccounts) &&
            defaultWalletAccounts.length > 0 &&
            (defaultWalletAccounts as any[])[0]?.addressFormat === undefined
          ) {
            accounts = generateWalletAccountsFromAddressFormat({
              addresses: defaultWalletAccounts as v1AddressFormat[],
            });
          } else if (Array.isArray(defaultWalletAccounts)) {
            accounts = defaultWalletAccounts as v1WalletAccountParams[];
          }

          response = await importWallet({
            walletName: walletName,
            accounts,
            encryptedBundle: encryptedWalletBundle,
            stampWith,
          });

          break;
        case ImportType.PrivateKey:
          const initPrivateKeyResult = await httpClient?.initImportPrivateKey({
            organizationId: session?.organizationId!,
            userId: session?.userId!,
          });

          if (!initPrivateKeyResult || !initPrivateKeyResult.importBundle) {
            throw new TurnkeyError(
              "Failed to retrieve import bundle",
              TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
            );
          }
          const injectedKey = await importIframeClient.injectImportBundle(
            initPrivateKeyResult.importBundle,
            session?.organizationId!,
            session?.userId!,
          );
          if (!injectedKey) {
            throw new TurnkeyError(
              "Failed to inject import bundle",
              TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
            );
          }

          const encryptedKeyBundle =
            await importIframeClient.extractKeyEncryptedBundle();
          if (!encryptedKeyBundle || encryptedKeyBundle.trim() === "") {
            throw new TurnkeyError(
              "Encrypted bundle is empty",
              TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
            );
          }

          response = await importPrivateKey({
            addressFormats,
            curve,
            privateKeyName: walletName,
            encryptedBundle: encryptedKeyBundle,
            stampWith,
          });

          break;

        default:
          throw new TurnkeyError(
            "Invalid import type",
            TurnkeyErrorCodes.IMPORT_WALLET_ERROR,
          );
      }

      if (response) {
        onSuccess(response);
        if (successPageDuration && successPageDuration !== 0) {
          pushPage({
            key: "success",
            content: (
              <SuccessPage
                text={
                  importType === ImportType.Wallet
                    ? "Wallet imported successfully!"
                    : importType === ImportType.PrivateKey
                      ? "Private key imported successfully!"
                      : "Success!"
                }
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

      if (error instanceof TurnkeyError) onError(error);
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
    <div
      className={clsx(
        "flex flex-col items-center pt-4",
        isMobile ? "w-full" : "w-[21rem]",
      )}
    >
      <p className="text-sm text-icon-text-light dark:text-icon-text-dark">
        {subtitle}
      </p>
      <div
        id={TurnkeyImportIframeContainerId}
        style={{
          height: "100%",
          overflow: "hidden",
          display: "block",
          backgroundColor: config?.ui?.darkMode
            ? config?.ui?.colors?.dark?.iconBackground || iconBackgroundDark
            : config?.ui?.colors?.light?.iconBackground || iconBackgroundLight,
          width: "100%",
          boxSizing: "border-box",
          padding: "5px",
          borderStyle: "solid",
          borderWidth: "1px",
          borderRadius: "8px",
          borderColor: config?.ui?.darkMode
            ? config?.ui?.colors?.dark?.iconText || iconTextDark
            : config?.ui?.colors?.light?.iconText || iconTextLight,
        }}
        className={`transition-all ${shaking ? "animate-shake" : ""}`}
      />
      <Input
        type="text"
        placeholder={placeholder}
        value={walletName}
        onChange={(e) => setWalletName(e.target.value)}
        className="placeholder:text-icon-text-light dark:placeholder:text-icon-text-dark w-full my-2 py-3 px-3 rounded-md text-inherit bg-icon-background-light dark:bg-icon-background-dark border border-modal-background-dark/20 dark:border-modal-background-light/20 focus:outline-primary-light focus:dark:outline-primary-dark focus:outline-[1px] focus:outline-offset-0 box-border"
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
        className={clsx(
          "text-sm text-red-500 transition-opacity delay-75 line-clamp-2 w-full",
          error
            ? "opacity-100 pointer-events-auto mt-2"
            : "opacity-0 pointer-events-none absolute",
        )}
      >
        {error?.message}:{" "}
        {error?.cause instanceof TurnkeyError
          ? error?.cause.message
          : error?.cause?.toString() || "Unknown error"}
      </p>
    </div>
  );
}
