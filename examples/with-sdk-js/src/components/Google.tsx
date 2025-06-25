"use client";

import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import styles from "./Socials.module.css";
import googleIcon from "../assets/google.svg";
import { GOOGLE_AUTH_URL, popupHeight, popupWidth } from "./constants";
import { useState, useEffect } from "react";
import { TurnkeyClient } from "@turnkey/sdk-js";

interface GoogleAuthButtonProps {
  client: TurnkeyClient | null;
  clientId: string;
  onSuccess: (response: any) => void;
  layout: "inline" | "stacked";
  openInPage?: boolean | undefined;
}

declare global {
  interface Window {
    google: any;
  }
}

const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  clientId,
  onSuccess,
  layout,
  openInPage = false,
  client,
}) => {
  const [loading, setLoading] = useState(false);

  // Handle redirect-based auth
  useEffect(() => {
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const idToken = hashParams.get("id_token");
      const state = hashParams.get("state");

      const stateParams = new URLSearchParams(state || "");
      const provider = stateParams.get("provider");
      const flow = stateParams.get("flow");

      if (idToken && provider === "google" && flow === "redirect") {
        onSuccess({ idToken });
        window.history.replaceState(
          null,
          document.title,
          window.location.pathname + window.location.search,
        );
      }
    }
  }, [onSuccess]);

  const handleLogin = () => {
    const width = popupWidth;
    const height = popupHeight;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    const flow = openInPage ? "redirect" : "popup";

    const authWindow = window.open(
      "about:blank",
      "_blank",
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`,
    );

    if (!authWindow) {
      console.error("Failed to open Google login window.");
      return;
    }

    setLoading(true);

    (async () => {
      const publicKey = await client?.apiKeyStamper?.createKeyPair();
      if (!publicKey) return;
      await client?.apiKeyStamper?.setPublicKeyOverride(publicKey);

      const nonce = bytesToHex(sha256(publicKey));
      const redirectURI = process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI!.replace(
        /\/$/,
        "",
      );

      const googleAuthUrl = new URL(GOOGLE_AUTH_URL);
      googleAuthUrl.searchParams.set("client_id", clientId);
      googleAuthUrl.searchParams.set("redirect_uri", redirectURI);
      googleAuthUrl.searchParams.set("response_type", "id_token");
      googleAuthUrl.searchParams.set("scope", "openid email profile");
      googleAuthUrl.searchParams.set("nonce", nonce);
      googleAuthUrl.searchParams.set("prompt", "select_account");
      googleAuthUrl.searchParams.set("state", `provider=google&flow=${flow}`);

      authWindow.location.href = googleAuthUrl.toString();

      const interval = setInterval(() => {
        try {
          const url = authWindow.location.href || "";
          if (url.startsWith(window.location.origin)) {
            const hashParams = new URLSearchParams(url.split("#")[1]);
            const idToken = hashParams.get("id_token");
            if (idToken) {
              authWindow.close();
              clearInterval(interval);
              onSuccess({ idToken, publicKey });
            }
          }
        } catch {
          // Ignore cross-origin errors
        }

        if (authWindow.closed) {
          setLoading(false);
          clearInterval(interval);
        }
      }, 500);
    })();
  };

  return (
    <button onClick={handleLogin} className={styles.socialButton}>
      <>
        <img src={googleIcon} className={styles.iconLarge} alt="Google" />
        <span>Continue with Google</span>
      </>
    </button>
  );
};

export default GoogleAuthButton;
