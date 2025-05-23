"use client";

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
import { useTurnkey } from "../../hooks/use-turnkey";

function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
    navigator.userAgent,
  );
}

interface AppleAuthButtonProps {
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
  clientId,
  onSuccess,
  layout,
  openInPage = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [appleSDKLoaded, setAppleSDKLoaded] = useState(false);
  const redirectURI = process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI!;
  const { indexedDbClient } = useTurnkey();

  useEffect(() => {
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

  useEffect(() => {
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const idToken = hashParams.get("id_token");
      const state = hashParams.get("state");
      const provider = state?.split("=")[1];

      if (idToken && provider === "apple") {
        onSuccess({ idToken });
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
      }
    }
  }, [onSuccess, indexedDbClient]);

  const handleLogin = () => {
    setLoading(true);

    const isMobile = isMobileBrowser() || openInPage;

    if (isMobile) {
      (async () => {
        await indexedDbClient?.resetKeyPair();
        const publicKey = await indexedDbClient?.getPublicKey();
        if (!publicKey) return;

        const nonce = bytesToHex(sha256(publicKey));
        const appleAuthUrl = new URL(APPLE_AUTH_URL);
        appleAuthUrl.searchParams.set("client_id", clientId);
        appleAuthUrl.searchParams.set("redirect_uri", redirectURI);
        appleAuthUrl.searchParams.set("response_type", "code id_token");
        appleAuthUrl.searchParams.set("response_mode", "fragment");
        appleAuthUrl.searchParams.set("nonce", nonce);
        appleAuthUrl.searchParams.set("state", "provider=apple");

        window.location.href = appleAuthUrl.toString();
      })();
    } else {
      // Open popup synchronously
      const width = popupWidth;
      const height = popupHeight;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;

      const authWindow = window.open(
        "about:blank",
        "_blank",
        `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`,
      );

      if (!authWindow) {
        console.error("Failed to open Apple login popup.");
        return;
      }

      // Do async logic after opening
      (async () => {
        await indexedDbClient?.resetKeyPair();
        const publicKey = await indexedDbClient?.getPublicKey();
        if (!publicKey) return;

        const nonce = bytesToHex(sha256(publicKey));
        const appleAuthUrl = new URL(APPLE_AUTH_URL);
        appleAuthUrl.searchParams.set("client_id", clientId);
        appleAuthUrl.searchParams.set("redirect_uri", redirectURI);
        appleAuthUrl.searchParams.set("response_type", "code id_token");
        appleAuthUrl.searchParams.set("response_mode", "fragment");
        appleAuthUrl.searchParams.set("nonce", nonce);
        appleAuthUrl.searchParams.set("state", "provider=apple");

        authWindow.location.href = appleAuthUrl.toString();

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
          } catch {
            if (authWindow?.closed) {
              setLoading(false);
              clearInterval(interval);
            }
          }
        }, 500);
      })();
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
