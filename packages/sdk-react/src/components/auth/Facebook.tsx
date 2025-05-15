"use client";

import { useState, useEffect } from "react";
import styles from "./Socials.module.css";
import { exchangeCodeForToken, generateChallengePair } from "./facebookUtils";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import facebookIcon from "assets/facebook.svg";
import { FACEBOOK_AUTH_URL, popupHeight, popupWidth } from "./constants";
import { CircularProgress } from "@mui/material";

interface FacebookAuthButtonProps {
  publicKey: string;
  clientId: string;
  onSuccess: (response: any) => void;
  layout: "inline" | "stacked";
  openInPage?: boolean | undefined;
}

const FacebookAuthButton: React.FC<FacebookAuthButtonProps> = ({
  publicKey,
  onSuccess,
  clientId,
  layout,
  openInPage = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [tokenExchanged, setTokenExchanged] = useState<boolean>(false);
  const redirectURI = process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI!;

  // Check for code param on component mount for in-page authentication
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get("code");
    const state = urlParams.get("state");
    const provider = state?.split("=")[1];

    if (authCode && state && provider === "facebook") {
      // Clear the URL params so they don't get processed again on refresh
      window.history.replaceState(
        null,
        document.title,
        window.location.pathname,
      );

      // Handle the code exchange
      handleTokenExchange(authCode);
    }
  }, []);

  const initiateFacebookLogin = async () => {
    setLoading(true);
    const { verifier, codeChallenge } = await generateChallengePair();
    sessionStorage.setItem("facebook_verifier", verifier);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectURI,
      state: `${verifier}:provider=facebook`,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      nonce: bytesToHex(sha256(publicKey)),
      scope: "openid",
      response_type: "code",
    });

    const facebookOAuthURL = `${FACEBOOK_AUTH_URL}?${params.toString()}`;

    if (openInPage) {
      // Open in the current page
      window.location.href = facebookOAuthURL;
    } else {
      const width = popupWidth;
      const height = popupHeight;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;

      // Open the login flow in a new window
      const popup = window.open(
        facebookOAuthURL,
        "_blank",
        `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`,
      );

      if (popup) {
        const interval = setInterval(async () => {
          try {
            if (popup.closed) {
              setLoading(false);
              clearInterval(interval);
              return;
            }

            const popupUrl = new URL(popup.location.href);
            const authCode = popupUrl.searchParams.get("code");

            if (authCode) {
              setLoading(false);
              popup.close();
              clearInterval(interval);
              handleTokenExchange(authCode);
            }
          } catch (error) {
            // Ignore cross-origin errors until the popup redirects to the same origin.
            // These errors occur because the script attempts to access the URL of the popup window while it's on a different domain.
            // Due to browser security policies (Same-Origin Policy), accessing properties like location.href on a window that is on a different domain will throw an exception.
            // Once the popup redirects to the same origin as the parent window, these errors will no longer occur, and the script can safely access the popup's location to extract parameters.
          }
        }, 250);
      }
    }
  };

  const handleTokenExchange = async (authCode: string) => {
    const redirectURI = process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI!;
    const verifier = sessionStorage.getItem("facebook_verifier");
    if (!verifier || tokenExchanged) {
      console.error(
        "No verifier found in sessionStorage or token exchange already completed",
      );
      return;
    }

    try {
      const tokenData = await exchangeCodeForToken(
        clientId,
        redirectURI,
        authCode,
        verifier,
      );
      sessionStorage.removeItem("facebook_verifier");
      onSuccess(tokenData);
      setTokenExchanged(true);
    } catch (error) {
      console.error("Error during token exchange:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={layout === "inline" ? styles.iconButton : styles.socialButton}
      onClick={loading ? undefined : initiateFacebookLogin}
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
            src={facebookIcon}
            className={
              layout === "inline" ? styles.iconLarge : styles.iconSmall
            }
            alt="Facebook"
          />
          {layout === "stacked" && <span>Continue with Facebook</span>}
        </>
      )}
    </div>
  );
};

export default FacebookAuthButton;
