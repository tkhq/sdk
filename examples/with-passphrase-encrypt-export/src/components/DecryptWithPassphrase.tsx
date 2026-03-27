import { useState } from "react";
import clsx from "clsx";
import { useModal } from "@turnkey/react-wallet-kit";

const inputClassName =
  "w-full py-3 px-4 rounded-md border border-modal-background-dark/20 dark:border-modal-background-light/20 bg-button-light dark:bg-button-dark text-inherit focus:outline-primary-light focus:dark:outline-primary-dark focus:outline-[1px] focus:outline-offset-0 box-border";

export function DecryptWithPassphraseComponent() {
  const [encryptedBundle, setEncryptedBundle] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [showDecrypted, setShowDecrypted] = useState(false);
  const [copied, setCopied] = useState(false);

  const { closeModal, isMobile } = useModal();

  async function handleDecrypt() {
    setError(null);
    setDecryptedText(null);
    setShowDecrypted(false);
    setIsDecrypting(true);

    try {
      // Decode base64 → bytes
      const binaryString = atob(encryptedBundle.trim());
      const encryptedBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        encryptedBytes[i] = binaryString.charCodeAt(i);
      }

      // Bundle layout: [16 bytes salt | 12 bytes IV | AES-GCM ciphertext]
      if (encryptedBytes.length < 28) {
        throw new Error("Invalid bundle: too short.");
      }

      const buf = encryptedBytes.buffer as ArrayBuffer;
      const salt = new Uint8Array(buf.slice(0, 16));
      const iv = new Uint8Array(buf.slice(16, 28));
      const ciphertext = buf.slice(28);

      // Derive AES-256 key via PBKDF2 (SHA-256, 600k iterations) — matches export frame
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(passphrase.normalize("NFC")) as BufferSource,
        "PBKDF2",
        false,
        ["deriveKey"],
      );

      const aesKey = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"],
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        aesKey,
        ciphertext,
      );

      setDecryptedText(new TextDecoder().decode(decrypted));
      setShowDecrypted(true);
    } catch (err: any) {
      // AES-GCM throws a generic DOMException when the auth tag fails (wrong passphrase)
      if (err instanceof DOMException) {
        setError("Decryption failed — check your passphrase and try again.");
      } else {
        setError(err?.message ?? "Unknown error during decryption.");
      }
    } finally {
      setIsDecrypting(false);
    }
  }

  async function handleCopy() {
    if (!decryptedText) return;
    await navigator.clipboard.writeText(decryptedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const canDecrypt = !isDecrypting && encryptedBundle.trim() && passphrase;

  return (
    <div
      className={clsx("flex flex-col gap-4 pt-8", isMobile ? "w-full" : "w-96")}
    >
      <p className="text-sm text-icon-text-light dark:text-icon-text-dark">
        Paste your encrypted bundle and enter the passphrase you chose during
        export to reveal your seed phrase or private key.
      </p>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="encrypted-bundle"
          className="text-xs font-medium text-icon-text-light dark:text-icon-text-dark"
        >
          Encrypted bundle
        </label>
        <textarea
          id="encrypted-bundle"
          rows={4}
          value={encryptedBundle}
          onChange={(e) => setEncryptedBundle(e.target.value)}
          placeholder="Paste your encrypted bundle here…"
          className={clsx(inputClassName, "resize-none font-mono text-xs")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="decrypt-passphrase"
          className="text-xs font-medium text-icon-text-light dark:text-icon-text-dark"
        >
          Passphrase
        </label>
        <input
          id="decrypt-passphrase"
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && canDecrypt && handleDecrypt()}
          placeholder="Enter your passphrase"
          className={inputClassName}
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {decryptedText !== null && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-icon-text-light dark:text-icon-text-dark">
              Decrypted value
            </label>
            <button
              onClick={() => setShowDecrypted((v) => !v)}
              className="text-xs text-icon-text-light dark:text-icon-text-dark bg-transparent border-none !p-0"
            >
              {showDecrypted ? "Hide" : "Show"}
            </button>
          </div>

          {showDecrypted ? (
            <textarea
              readOnly
              rows={4}
              value={decryptedText}
              className={clsx(inputClassName, "resize-none font-mono text-xs")}
            />
          ) : (
            <div className="w-full rounded-md h-[3.25rem] border border-modal-background-dark/20 dark:border-modal-background-light/20 bg-button-light dark:bg-button-dark flex items-center justify-center">
              <span className="text-icon-text-light dark:text-icon-text-dark text-sm select-none tracking-widest">
                ••••••••••••
              </span>
            </div>
          )}

          {showDecrypted && (
            <button
              onClick={handleCopy}
              className="text-xs text-icon-text-light dark:text-icon-text-dark bg-transparent border border-modal-background-dark/20 dark:border-modal-background-light/20 !py-1.5"
            >
              {copied ? "Copied!" : "Copy to clipboard"}
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleDecrypt}
          disabled={!canDecrypt}
          className="flex-1 h-10 border border-neutral-400 text-primary-text-light dark:text-primary-text-dark bg-primary-light dark:bg-primary-dark disabled:opacity-50"
        >
          {isDecrypting ? "Decrypting…" : "Decrypt"}
        </button>

        {decryptedText !== null && (
          <button
            onClick={closeModal}
            className="flex-1 h-10 border border-neutral-400 text-primary-text-light dark:text-primary-text-dark bg-primary-light dark:bg-primary-dark"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
