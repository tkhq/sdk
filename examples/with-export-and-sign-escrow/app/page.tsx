"use client";

import { IframeStamper, KeyFormat, MessageType } from "@turnkey/iframe-stamper";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import { useEffect, useState, useCallback, useMemo } from "react";
import { AuthState, useTurnkey, WalletSource } from "@turnkey/react-wallet-kit";
import { v1PrivateKey } from "@turnkey/sdk-types";

// Constants
const IFRAME_CONTAINER_ID = "turnkey-export-and-sign-iframe-container-id";
const IFRAME_ELEMENT_ID = "turnkey-default-iframe-element-id";
const EXPORT_BUNDLE_STORAGE_KEY = "export-and-sign-escrow-exports";
const ESCROW_KEY_STORAGE_KEY = "export-and-sign-escrow-key-id";

type ExportBundle = {
  address: string;
  encryptedBundle: string;
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

export default function Home() {
  const { session, httpClient, wallets, authState, handleLogin, createWallet } =
    useTurnkey();

  const iframeUrl = process.env.NEXT_PUBLIC_EXPORT_AND_SIGN_IFRAME_URL;

  if (!iframeUrl) {
    throw new Error(
      "Export and Sign iframe URL is not configured. Please set it in the environment variables.",
    );
  }

  // ── State ──────────────────────────────────────────────────────────────
  const [iframeClient, setIframeClient] = useState<IframeStamper | null>(null);
  const [encryptedAccounts, setEncryptedAccounts] = useState<string[]>([]);
  const [escrowPrivateKeys, setEscrowPrivateKeys] = useState<v1PrivateKey[]>(
    [],
  );
  const [activeEscrowKeyId, setActiveEscrowKeyId] = useState<string | null>(
    null,
  );

  // ── Computed ───────────────────────────────────────────────────────────
  const availableAccounts = useMemo(() => {
    if (!wallets) return [];
    return wallets
      .filter((wallet) => wallet.source !== WalletSource.Connected)
      .flatMap((wallet) => wallet.accounts)
      .filter((account) => account.addressFormat === "ADDRESS_FORMAT_SOLANA");
  }, [wallets, encryptedAccounts]);

  // ── Callbacks ──────────────────────────────────────────────────────────
  const fetchEscrowKeys = useCallback(async () => {
    if (!httpClient) return;

    try {
      const tagRes = await httpClient.listPrivateKeyTags({});
      const escrowTag = tagRes.privateKeyTags.find(
        (tag) => tag.tagName === "export-and-sign-escrow",
      );
      if (!escrowTag) {
        console.warn("No escrow tag found, skipping fetch of escrow keys.");
        return;
      }

      const keysRes = await httpClient.getPrivateKeys({});
      const escrowKeys = keysRes.privateKeys.filter((key) =>
        key.privateKeyTags.includes(escrowTag.tagId),
      );

      setEscrowPrivateKeys(escrowKeys);
    } catch (error) {
      console.error("Error fetching escrow keys:", error);
    }
  }, [httpClient]);

  const createEscrowKey = useCallback(async () => {
    if (!httpClient) return;

    try {
      const tagRes = await httpClient.listPrivateKeyTags({});

      let escrowTagId = tagRes.privateKeyTags.find(
        (tag) => tag.tagName === "export-and-sign-escrow",
      )?.tagId;
      if (!escrowTagId) {
        const res = await httpClient.createPrivateKeyTag({
          privateKeyTagName: "export-and-sign-escrow",
          privateKeyIds: [],
        });
        escrowTagId = res.privateKeyTagId;
      }

      await httpClient.createPrivateKeys({
        privateKeys: [
          {
            privateKeyName: "Escrow Key " + new Date().toISOString(),
            curve: "CURVE_P256",
            privateKeyTags: [escrowTagId],
            addressFormats: [],
          },
        ],
      });

      await fetchEscrowKeys();
    } catch (error) {
      console.error("Error creating escrow key:", error);
    }
  }, [httpClient, fetchEscrowKeys]);

  const selectEscrowKey = useCallback((keyId: string) => {
    setActiveEscrowKeyId(keyId);
    localStorage.setItem(ESCROW_KEY_STORAGE_KEY, keyId);
  }, []);

  const exportAccountsToEscrowKey = useCallback(async () => {
    if (!httpClient || !activeEscrowKeyId) return;

    const privateKeyRes = await httpClient.getPrivateKey({
      privateKeyId: activeEscrowKeyId,
    });

    const exportBundles: ExportBundle[] = [];
    for (const account of availableAccounts) {
      try {
        const bundle = await httpClient.exportWalletAccount({
          address: account.address,
          targetPublicKey: privateKeyRes.privateKey.publicKey,
        });

        exportBundles.push({
          address: account.address,
          encryptedBundle: bundle.exportBundle,
        });
      } catch (error) {
        console.error(
          `Error exporting account ${account.address} to escrow key:`,
          error,
        );
      }
    }

    localStorage.setItem(
      EXPORT_BUNDLE_STORAGE_KEY,
      JSON.stringify(exportBundles),
    );
    setEncryptedAccounts(exportBundles.map((bundle) => bundle.address));
  }, [httpClient, activeEscrowKeyId, availableAccounts]);

  const injectEscrowKeyAndBundles = useCallback(async () => {
    if (
      !httpClient ||
      !iframeClient ||
      !session?.organizationId ||
      !activeEscrowKeyId
    )
      return;

    // Inject the escrow private key into the iframe
    const targetPublicKey = await iframeClient.getEmbeddedPublicKey();
    if (!targetPublicKey) {
      throw new Error("Iframe public key not available");
    }

    const privKeyExportBundle = await httpClient.exportPrivateKey({
      privateKeyId: activeEscrowKeyId,
      targetPublicKey,
    });

    await iframeClient.setEmbeddedKeyOverride(
      session.organizationId,
      privKeyExportBundle.exportBundle,
    );

    // Inject the export bundles
    const bundlesStr = localStorage.getItem(EXPORT_BUNDLE_STORAGE_KEY);
    if (!bundlesStr) {
      console.warn("No export bundles found in local storage.");
      return;
    }

    const exportBundles = JSON.parse(bundlesStr) as ExportBundle[];
    for (const bundle of exportBundles) {
      await iframeClient.injectKeyExportBundle(
        bundle.encryptedBundle,
        session.organizationId,
        KeyFormat.Solana,
        bundle.address,
      );
    }
  }, [httpClient, iframeClient, session?.organizationId, activeEscrowKeyId]);

  const signMessage = useCallback(
    async (address: string) => {
      if (!iframeClient) return;

      const message = "Hello Turnkey!";
      const signature = await iframeClient.signMessage(
        { message, type: MessageType.Solana },
        address,
      );

      console.log("Signature:", signature);
      console.log("Valid:", verifySolanaSignature(message, signature, address));
    },
    [iframeClient],
  );

  const signAll = useCallback(() => {
    encryptedAccounts.forEach(signMessage);
  }, [encryptedAccounts, signMessage]);

  const createSolWallet = useCallback(async () => {
    await createWallet({
      walletName: "Solana Wallet " + new Date().toISOString(),
      accounts: [
        "ADDRESS_FORMAT_SOLANA",
        "ADDRESS_FORMAT_SOLANA",
        "ADDRESS_FORMAT_SOLANA",
      ],
    });
  }, [createWallet]);

  // ── Effects ────────────────────────────────────────────────────────────

  // Load persisted state from localStorage
  useEffect(() => {
    setActiveEscrowKeyId(localStorage.getItem(ESCROW_KEY_STORAGE_KEY) || null);

    const stored = localStorage.getItem(EXPORT_BUNDLE_STORAGE_KEY);
    if (stored) {
      const bundles = JSON.parse(stored) as ExportBundle[];
      setEncryptedAccounts(bundles.map((b) => b.address));
    }
  }, []);

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
        setIframeClient(client);
      } catch (error) {
        console.error("Error initializing iframe:", error);
      }
    };

    initIframe();
  }, [iframeUrl]);

  // Fetch escrow keys on auth
  useEffect(() => {
    if (authState === AuthState.Authenticated) {
      fetchEscrowKeys();
    }
  }, [authState, fetchEscrowKeys]);
  return (
    <main className="p-4 flex flex-col gap-4 justify-center min-h-screen items-center">
      {/* iframe container for export and sign */}
      <div
        id={IFRAME_CONTAINER_ID}
        style={{ opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
      />
      {authState == AuthState.Unauthenticated ? (
        <div className="flex flex-col gap-4 items-center">
          <p>Please log in to see your wallets and test export and sign.</p>
          <button onClick={() => handleLogin()}>Login</button>
        </div>
      ) : (
        <>
          <p>Welcome! You are logged in.</p>

          <div className="border rounded-md border-white p-4 flex flex-col gap-4">
            {availableAccounts.length === 0 ? (
              <p>
                No available accounts to export. Please create a wallet with
                Solana accounts.
              </p>
            ) : (
              <>
                <h2 className="text-lg font-bold">
                  Available Accounts for Export
                </h2>
                {availableAccounts.map((account) => (
                  <div key={account.address}>{account.address}</div>
                ))}
              </>
            )}
          </div>

          <button
            className="bg-neutral-300 text-black"
            onClick={createSolWallet}
          >
            Create Wallet
          </button>

          <div className="border rounded-md border-white p-4 flex flex-col gap-4">
            <h2 className="text-lg font-bold">Available Escrow Keys</h2>
            {escrowPrivateKeys.length === 0 ? (
              <p>No escrow keys found. Please create one.</p>
            ) : (
              escrowPrivateKeys.map((key) => (
                <div key={key.privateKeyId} className="flex items-center gap-2">
                  <span>{key.privateKeyName}</span>
                  <button
                    onClick={() => selectEscrowKey(key.privateKeyId)}
                    className={`px-2 py-1 rounded text-black ${
                      activeEscrowKeyId === key.privateKeyId
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200"
                    }`}
                  >
                    {activeEscrowKeyId === key.privateKeyId
                      ? "Active"
                      : "Set Active"}
                  </button>
                </div>
              ))
            )}
          </div>

          <button
            className="bg-neutral-300 text-black"
            onClick={async () => {
              await createEscrowKey();
            }}
          >
            Create Export and Sign Escrow Key
          </button>

          <button
            className="bg-neutral-300 text-black"
            onClick={async () => {
              await exportAccountsToEscrowKey();
            }}
          >
            Export All Wallet Accounts to Escrow Key
          </button>

          <div className="border rounded-md border-white p-4 flex flex-col gap-4">
            {encryptedAccounts.length === 0 ? (
              <p>
                No encrypted accounts. Please export wallet accounts to an
                Escrow Key.
              </p>
            ) : (
              <>
                <h2 className="text-lg font-bold">Encrypted Accounts</h2>
                {encryptedAccounts.map((address) => (
                  <div key={address}>{address}</div>
                ))}
              </>
            )}
          </div>

          <button
            className="bg-neutral-300 text-black"
            onClick={injectEscrowKeyAndBundles}
          >
            Inject Escrow Key and Export Bundles into Iframe
          </button>
          <button
            className="bg-neutral-300 text-black"
            onClick={signAll}
            disabled={encryptedAccounts.length === 0}
          >
            Sign Message with All Accounts
          </button>
        </>
      )}
    </main>
  );
}
