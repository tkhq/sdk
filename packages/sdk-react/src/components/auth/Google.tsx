"use client";

import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import styles from "./Socials.module.css";
import googleIcon from "assets/google.svg";
import { GOOGLE_AUTH_URL, popupHeight, popupWidth } from "./constants";
import { useState, useEffect } from "react";
import { CircularProgress } from "@mui/material";

interface GoogleAuthButtonProps {
  iframePublicKey: string;
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
  iframePublicKey,
  clientId,
  onSuccess,
  layout,
  openInPage = false,
}) => {
  const [loading, setLoading] = useState(false);

  // Check for hash params on component mount for in-page authentication
  useEffect(() => {
    // If there's a hash in the URL, parse it
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const idToken = hashParams.get("id_token");
      const state = hashParams.get("state");
      const provider = state?.split("=")[1];

      if (idToken && provider === "google") {
        // Handle the token
        onSuccess({ idToken });
        // Clear the hash so it doesn’t re-trigger on page refresh
        window.history.replaceState(
          null,
          document.title,
          window.location.pathname + window.location.search,
        );
      }
    }
  }, [onSuccess]);

  const handleLogin = async () => {
    setLoading(true);
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
    googleAuthUrl.searchParams.set("state", "provider=google");

    if (openInPage) {
      window.location.href = googleAuthUrl.toString();
    } else {
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
        setLoading(false);
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
          setLoading(false);
          clearInterval(interval);
        }
      }, 500);
    }
  };

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
            src={googleIcon}
            className={
              layout === "inline" ? styles.iconLarge : styles.iconSmall
            }
            alt="Google"
          />
          {layout === "stacked" && <span>Continue with Google</span>}
        </>
      )}
    </div>
  );
};

export default GoogleAuthButton;
