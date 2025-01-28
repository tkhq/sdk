"use client";

import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import styles from "./Socials.module.css";
import googleIcon from "assets/google.svg";
import { GOOGLE_AUTH_URL, popupHeight, popupWidth } from "./constants";

interface GoogleAuthButtonProps {
  iframePublicKey: string;
  clientId: string;
  onSuccess: (response: any) => void;
  layout: "inline" | "stacked";
}
declare global {
  interface Window {
    google: any;
  }
}

const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  iframePublicKey,
  clientId,
  onSuccess,
  layout,
}) => {
  const handleLogin = async () => {
    const nonce = bytesToHex(sha256(iframePublicKey));
    const redirectURI = process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI!.replace(
      /\/$/,
      "",
    );
    // Construct the Google OIDC URL
    const googleAuthUrl = new URL(GOOGLE_AUTH_URL);
    googleAuthUrl.searchParams.set("client_id", clientId);
    googleAuthUrl.searchParams.set("redirect_uri", redirectURI); // Replace with your actual redirect URI
    googleAuthUrl.searchParams.set("response_type", "id_token"); // Use id_token for OpenID Connect
    googleAuthUrl.searchParams.set("scope", "openid email profile"); // Scopes required for OpenID
    googleAuthUrl.searchParams.set("nonce", nonce);
    googleAuthUrl.searchParams.set("prompt", "select_account");
    const width = popupWidth;
    const height = popupHeight;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    // Open the login flow in a new window
    const authWindow = window.open(
      googleAuthUrl.toString(),
      "_blank",
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`,
    );

    if (!authWindow) {
      console.error("Failed to open Google login window.");
      return;
    }

    // Monitor the child window for redirect and extract tokens
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

  return (
    <div
      className={layout === "inline" ? styles.iconButton : styles.socialButton}
      onClick={handleLogin}
    >
      <img
        src={googleIcon}
        className={layout === "inline" ? styles.iconLarge : styles.iconSmall}
        alt="Google"
      />
      {layout === "stacked" && <span>Continue with Google</span>}
    </div>
  );
};

export default GoogleAuthButton;
