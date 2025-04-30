import React, { useEffect, useState } from "react";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import appleIcon from "assets/apple.svg";
import styles from "./Socials.module.css";
import {
  APPLE_AUTH_SCRIPT_URL,
  APPLE_AUTH_URL,
  popupHeight,
  popupWidth,
} from "./constants";
import { CircularProgress } from "@mui/material";

function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
    navigator.userAgent,
  );
}

interface AppleAuthButtonProps {
  iframePublicKey: string;
  clientId: string;
  onSuccess: (response: { idToken: string }) => void;
  layout: "inline" | "stacked";
  openInPage?: boolean | undefined;
}

declare global {
  interface Window {
    AppleID?: any;
  }
}

const AppleAuthButton: React.FC<AppleAuthButtonProps> = ({
  iframePublicKey,
  clientId,
  onSuccess,
  layout,
  openInPage = false,
}) => {
  const [loading, setLoading] = useState(false);

  const [appleSDKLoaded, setAppleSDKLoaded] = useState(false);
  const redirectURI = process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI!;

  useEffect(() => {
    // 1. Load Apple's JS if not already present
    if (!window.AppleID) {
      const script = document.createElement("script");
      script.src = APPLE_AUTH_SCRIPT_URL;
      script.onload = () => setAppleSDKLoaded(true);
      script.onerror = () => console.error("Failed to load AppleID JS script");
      document.body.appendChild(script);
    } else {
      setAppleSDKLoaded(true);
    }
  }, []);

  // 2. Check on mount if we just came back from Apple with #id_token
  useEffect(() => {
    // If there's a hash in the URL, parse it
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const idToken = hashParams.get("id_token");
      const state = hashParams.get("state");
      const provider = state?.split("=")[1];

      if (idToken && provider === "apple") {
        // We have the token from Apple. Let the parent know.
        onSuccess({ idToken });
        // Clear the hash so it doesn’t re-trigger on page refresh
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
      }
    }
  }, [onSuccess]);

  const handleLogin = () => {
    setLoading(true);
    const nonce = bytesToHex(sha256(iframePublicKey));
    const appleAuthUrl = new URL(APPLE_AUTH_URL);
    appleAuthUrl.searchParams.set("client_id", clientId);
    appleAuthUrl.searchParams.set("redirect_uri", redirectURI);
    appleAuthUrl.searchParams.set("response_type", "code id_token");
    appleAuthUrl.searchParams.set("response_mode", "fragment");
    appleAuthUrl.searchParams.set("nonce", nonce);
    appleAuthUrl.searchParams.set("state", "provider=apple");

    if (isMobileBrowser() || openInPage) {
      // Redirect the entire window
      window.location.href = appleAuthUrl.toString();
    } else {
      // Desktop: open a popup
      const width = popupWidth;
      const height = popupHeight;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;

      const authWindow = window.open(
        appleAuthUrl.toString(),
        "_blank",
        `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`,
      );

      if (!authWindow) {
        console.error("Failed to open Apple login popup.");
        return;
      }

      // Poll for the redirect
      const interval = setInterval(() => {
        try {
          if (authWindow.closed) {
            setLoading(false);
            clearInterval(interval);
            return;
          }
          const url = authWindow.location.href;
          if (url.startsWith(window.location.origin)) {
            const hashParams = new URLSearchParams(url.split("#")[1]);
            const idToken = hashParams.get("id_token");
            if (idToken) {
              authWindow.close();
              setLoading(false);
              clearInterval(interval);
              onSuccess({ idToken });
            }
          }
        } catch (error) {
          // Ignore cross-origin errors until the popup redirects to the same origin.
          // These errors occur because the script attempts to access the URL of the popup window while it's on a different domain.
          // Due to browser security policies (Same-Origin Policy), accessing properties like location.href on a window that is on a different domain will throw an exception.
          // Once the popup redirects to the same origin as the parent window, these errors will no longer occur, and the script can safely access the popup's location to extract parameters.
          if (authWindow?.closed) {
            setLoading(false);
            clearInterval(interval);
          }
        }
      }, 500);
    }
  };

  if (!appleSDKLoaded) {
    return null;
  }

  return (
    <div
      className={layout === "inline" ? styles.iconButton : styles.socialButton}
      onClick={loading ? undefined : handleLogin}
    >
      {loading ? (
        <CircularProgress
          size={24}
          thickness={4}
          className={styles.buttonProgress || ""}
        />
      ) : (
        <>
          <img
            src={appleIcon}
            className={
              layout === "inline" ? styles.iconLarge : styles.iconSmall
            }
            alt="Apple"
          />
          {layout === "stacked" && <span>Continue with Apple</span>}
        </>
      )}
    </div>
  );
};

export default AppleAuthButton;
