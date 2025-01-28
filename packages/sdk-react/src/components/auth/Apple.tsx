import { useEffect, useState } from "react";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import styles from "./Socials.module.css";
import appleIcon from "assets/apple.svg";
import {
  APPLE_AUTH_SCRIPT_URL,
  APPLE_AUTH_URL,
  popupHeight,
  popupWidth,
} from "./constants";

interface AppleAuthButtonProps {
  iframePublicKey: string;
  clientId: string;
  onSuccess: (response: any) => void;
  layout: "inline" | "stacked";
}
declare global {
  interface Window {
    AppleID?: any;
  }
}

const AppleAuthButton: React.FC<AppleAuthButtonProps> = ({
  iframePublicKey,
  onSuccess,
  clientId,
  layout,
}) => {
  const [appleSDKLoaded, setAppleSDKLoaded] = useState(false);
  const redirectURI = process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI!;

  useEffect(() => {
    const loadAppleSDK = () => {
      const script = document.createElement("script");
      script.src = APPLE_AUTH_SCRIPT_URL;
      script.onload = () => setAppleSDKLoaded(true);
      script.onerror = () => console.error("Failed to load AppleID SDK");
      document.body.appendChild(script);
    };

    if (!window.AppleID) {
      loadAppleSDK();
    } else {
      setAppleSDKLoaded(true);
    }
  }, []);

  const handleLogin = () => {
    const nonce = bytesToHex(sha256(iframePublicKey));
    const appleAuthUrl = new URL(APPLE_AUTH_URL);
    appleAuthUrl.searchParams.set("client_id", clientId);
    appleAuthUrl.searchParams.set("redirect_uri", redirectURI);
    appleAuthUrl.searchParams.set("response_type", "code id_token");
    appleAuthUrl.searchParams.set("response_mode", "fragment");
    appleAuthUrl.searchParams.set("nonce", nonce);

    // Calculate popup dimensions and position for centering
    const width = popupWidth;
    const height = popupHeight;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    // Open the Apple login popup
    const authWindow = window.open(
      appleAuthUrl.toString(),
      "_blank",
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`,
    );

    if (!authWindow) {
      console.error("Failed to open Apple login window.");
      return;
    }

    // Monitor the popup for redirect and extract tokens
    const interval = setInterval(() => {
      try {
        const url = authWindow?.location.href || "";
        if (url.startsWith(window.location.origin)) {
          const hashParams = new URLSearchParams(url.split("#")[1]);
          const idToken = hashParams.get("id_token");
          if (idToken) {
            authWindow?.close();
            clearInterval(interval);
            onSuccess({ idToken });
          }
        }
      } catch (error) {
        // Ignore cross-origin errors until the popup redirects to the same origin.
        // These errors occur because the script attempts to access the URL of the popup window while it's on a different domain.
        // Due to browser security policies (Same-Origin Policy), accessing properties like location.href on a window that is on a different domain will throw an exception.
        // Once the popup redirects to the same origin as the parent window, these errors will no longer occur, and the script can safely access the popup's location to extract parameters.
      }

      if (authWindow?.closed) {
        clearInterval(interval);
      }
    }, 500);
  };

  if (!appleSDKLoaded) {
    return null;
  }

  return (
    <div
      onClick={handleLogin}
      className={layout === "inline" ? styles.iconButton : styles.socialButton}
    >
      <img
        src={appleIcon}
        className={layout === "inline" ? styles.iconLarge : styles.iconSmall}
      />
      {layout === "stacked" && <span>Continue with Apple</span>}
    </div>
  );
};

export default AppleAuthButton;
