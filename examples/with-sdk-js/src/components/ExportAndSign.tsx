import { PublicKey } from "@solana/web3.js";
import { IframeStamper, KeyFormat, MessageType } from "@turnkey/iframe-stamper";
import nacl from "tweetnacl";
import { useModal, useTurnkey, WalletSource } from "@turnkey/react-wallet-kit";
import { useEffect, useState, useCallback, useMemo } from "react";
import { v1WalletAccount } from "@turnkey/sdk-types";

// Constants
const IFRAME_CONTAINER_ID = "turnkey-export-and-sign-iframe-container-id";
const IFRAME_ELEMENT_ID = "turnkey-default-iframe-element-id";
const IFRAME_CLASS_NAMES =
  "w-full border-none !text-base bg-icon-background-light dark:bg-icon-background-dark";

const DEFAULT_STYLES = {
  light: { background: "#e5e7eb", text: "#828282" },
  dark: { background: "#333336", text: "#a3a3a5" },
};

// Utility functions
function verifySolanaSignature(
  message: string,
  signature: string,
  address: string,
): boolean {
  try {
    const signatureBytes = new Uint8Array(Buffer.from(signature, "hex"));
    const messageBytes = new Uint8Array(Buffer.from(message));
    const pubKey = new PublicKey(address);
    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      pubKey.toBytes(),
    );
  } catch (error) {
    console.error("Verification failed:", error);
    return false;
  }
}

function parseAddresses(addresses: string | string[]): string[] {
  return typeof addresses === "string" ? JSON.parse(addresses) : addresses;
}

// Props
interface ExportAndSignProps {
  organizationId: string;
  escrowPrivateKeyId: string;
}

export function ExportAndSignComponent({
  organizationId,
  escrowPrivateKeyId,
}: ExportAndSignProps) {
  const { config, httpClient, wallets } = useTurnkey();
  const { closeModal } = useModal();

  const [iframeClient, setIframeClient] = useState<IframeStamper | null>(null);
  const [encryptedAccounts, setEncryptedAccounts] = useState<string[]>([]);

  const iframeUrl = process.env.NEXT_PUBLIC_EXPORT_AND_SIGN_IFRAME_URL;

  if (!iframeUrl) {
    throw new Error(
      "Export and Sign iframe URL is not configured. Please set it in the environment variables.",
    );
  }

  // Computed values
  const availableAccounts = useMemo(() => {
    return wallets
      .filter((wallet) => wallet.source !== WalletSource.Connected)
      .flatMap((wallet) => wallet.accounts)
      .filter(
        (account) =>
          account.addressFormat === "ADDRESS_FORMAT_SOLANA" &&
          !encryptedAccounts.includes(account.address),
      );
  }, [wallets, encryptedAccounts]);

  // Helper to get iframe styles based on config
  const getIframeStyles = useCallback(() => {
    const isDark = config?.ui?.darkMode;
    const colors = config?.ui?.colors;
    return {
      fontSize: "16px",
      backgroundColor: isDark
        ? colors?.dark?.iconBackground || DEFAULT_STYLES.dark.background
        : colors?.light?.iconBackground || DEFAULT_STYLES.light.background,
      color: isDark
        ? colors?.dark?.iconText || DEFAULT_STYLES.dark.text
        : colors?.light?.iconText || DEFAULT_STYLES.light.text,
    };
  }, [config]);

  // Initialize iframe
  useEffect(() => {
    if (document.getElementById(IFRAME_ELEMENT_ID)) return;

    const initIframe = async () => {
      try {
        const client = new IframeStamper({
          iframeUrl,
          iframeElementId: IFRAME_ELEMENT_ID,
          iframeContainer: document.getElementById(IFRAME_CONTAINER_ID),
        });

        await client.init();
        await client.applySettings({ styles: getIframeStyles() });
        setIframeClient(client);

        // Apply class names after init
        const element = document.getElementById(IFRAME_ELEMENT_ID);
        if (element) {
          element.className = IFRAME_CLASS_NAMES;
        }
      } catch (error) {
        console.error("Error initializing iframe:", error);
      }
    };

    initIframe();
  }, [iframeUrl, getIframeStyles]);

  // Setup escrow and load accounts when iframe is ready
  useEffect(() => {
    if (!iframeClient) return;

    const setup = async () => {
      await injectEscrowBundle();
      await refreshAccounts();
    };

    setup();
  }, [iframeClient]);

  // Core functions
  const injectEscrowBundle = async () => {
    if (!iframeClient) return;

    const targetPublicKey = await iframeClient.getEmbeddedPublicKey();
    if (!targetPublicKey) {
      throw new Error("Failed to retrieve target public key from iframe.");
    }

    const { exportBundle } =
      (await httpClient?.exportPrivateKey({
        privateKeyId: escrowPrivateKeyId,
        targetPublicKey,
      })) || {};

    if (!exportBundle) {
      throw new Error(
        "Failed to retrieve export bundle for escrow private key.",
      );
    }

    iframeClient.injectDecryptionKeyBundle(organizationId, exportBundle);
  };

  const refreshAccounts = async () => {
    if (!iframeClient) return;

    const addresses =
      await iframeClient.getStoredWalletAddresses(organizationId);
    setEncryptedAccounts(parseAddresses(addresses));
  };

  const signMessage = async (address: string) => {
    if (!iframeClient) return;

    const message = "Hello Turnkey!";
    const signature = await iframeClient.signMessage(
      { message, type: MessageType.Solana },
      address,
    );

    console.log("Signature:", signature);
    console.log("Valid:", verifySolanaSignature(message, signature, address));
  };

  const signAll = () => {
    encryptedAccounts.forEach(signMessage);
  };

  const addAccount = async (account: v1WalletAccount) => {
    if (!iframeClient) return;

    if (account.addressFormat !== "ADDRESS_FORMAT_SOLANA") {
      throw new Error(
        "Only Solana wallet accounts are supported in this example.",
      );
    }

    const { privateKey } =
      (await httpClient?.getPrivateKey({ privateKeyId: escrowPrivateKeyId })) ||
      {};

    if (!privateKey) {
      throw new Error("Failed to retrieve escrow private key.");
    }

    const { exportBundle } =
      (await httpClient?.exportWalletAccount({
        address: account.address,
        targetPublicKey: privateKey.publicKey,
      })) || {};

    await iframeClient.storeEncryptedBundle(
      organizationId,
      exportBundle!,
      KeyFormat.Solana,
      account.address,
    );

    await refreshAccounts();
  };

  const removeAccount = async (address?: string) => {
    if (!iframeClient) return;

    iframeClient.clearStoredBundles(organizationId, address);
    await refreshAccounts();
  };

  const burnSession = async () => {
    if (!iframeClient) return;

    iframeClient.burnSession();
    await refreshAccounts();
  };

  // Render
  return (
    <div className="min-h-80 min-w-[700px] p-4 mt-10">
      <div
        id={IFRAME_CONTAINER_ID}
        style={{ opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
      />

      <div className="flex gap-6">
        {/* Left side */}
        <div className="flex-1 border-r pr-6">
          <h3 className="text-lg font-semibold mb-4">Ready to Sign</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {encryptedAccounts.length === 0 ? (
              <p className="text-sm text-neutral-500">No accounts added yet</p>
            ) : (
              encryptedAccounts.map((address) => (
                <div key={address} className="p-3 border rounded-lg bg-gray-50">
                  <p className="text-xs font-mono break-all mb-2">{address}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => signMessage(address)}
                      className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Sign
                    </button>
                    <button
                      onClick={() => removeAccount(address)}
                      className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          {encryptedAccounts.length > 0 && (
            <button
              onClick={signAll}
              className="mt-4 w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Sign All
            </button>
          )}
        </div>

        {/* Right side: Available Accounts */}
        <div className="flex-1 pl-2">
          <h3 className="text-lg font-semibold mb-4">Available Accounts</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {availableAccounts.length === 0 ? (
              <p className="text-sm text-neutral-500">No accounts available</p>
            ) : (
              availableAccounts.map((account) => (
                <div
                  key={account.address}
                  className="p-3 border rounded-lg bg-gray-50"
                >
                  <p className="text-xs font-mono break-all mb-2">
                    {account.address}
                  </p>
                  <button
                    onClick={() => addAccount(account)}
                    className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Add
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t flex justify-end">
        <button
          onClick={closeModal}
          className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
        >
          Done
        </button>

        <button
          onClick={burnSession}
          className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
        >
          Burn Session
        </button>
      </div>
    </div>
  );
}
