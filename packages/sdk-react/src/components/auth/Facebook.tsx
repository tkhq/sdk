"use client";

import { useState, useEffect } from "react";
import styles from "./Socials.module.css";
import { exchangeCodeForToken, generateChallengePair } from "./facebookUtils";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import facebookIcon from "assets/facebook.svg";
import { FACEBOOK_AUTH_URL, popupHeight, popupWidth } from "./constants";
import { CircularProgress } from "@mui/material";
import { useTurnkey } from "../../hooks/use-turnkey";

interface FacebookAuthButtonProps {
  clientId: string;
  onSuccess: (response: any) => void;
  layout: "inline" | "stacked";
  openInPage?: boolean | undefined;
}

function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
    navigator.userAgent,
  );
}

const FacebookAuthButton: React.FC<FacebookAuthButtonProps> = ({
  onSuccess,
  clientId,
  layout,
  openInPage = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [tokenExchanged, setTokenExchanged] = useState(false);
  const redirectURI = process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI!;
  const { indexedDbClient } = useTurnkey();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get("code");
    const state = urlParams.get("state");

    const stateParams = new URLSearchParams(state || "");
    const provider = stateParams.get("provider");
    const flow = stateParams.get("flow");

    if (authCode && provider === "facebook" && flow === "redirect") {
      window.history.replaceState(
        null,
        document.title,
        window.location.pathname,
      );
      handleTokenExchange(authCode);
    }
  }, [indexedDbClient]);

  const initiateFacebookLogin = () => {
    const flow = openInPage || isMobileBrowser() ? "redirect" : "popup";

    if (flow === "redirect") {
      setLoading(true);
      (async () => {
        const { verifier, codeChallenge } = await generateChallengePair();
        sessionStorage.setItem("facebook_verifier", verifier);
        await indexedDbClient?.resetKeyPair();
        const publicKey = await indexedDbClient?.getPublicKey();
        if (!publicKey) return;

        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectURI,
          response_type: "code",
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          nonce: bytesToHex(sha256(publicKey)),
          scope: "openid",
          state: `provider=facebook&flow=${flow}`,
        });

        const facebookOAuthURL = `${FACEBOOK_AUTH_URL}?${params.toString()}`;
        window.location.href = facebookOAuthURL;
      })();
    } else {
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
        console.error("Failed to open Facebook login popup.");
        return;
      }

      setLoading(true);

      (async () => {
        const { verifier, codeChallenge } = await generateChallengePair();
        sessionStorage.setItem("facebook_verifier", verifier);
        await indexedDbClient?.resetKeyPair();
        const publicKey = await indexedDbClient?.getPublicKey();
        if (!publicKey) return;

        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectURI,
          response_type: "code",
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          nonce: bytesToHex(sha256(publicKey)),
          scope: "openid",
          state: `provider=facebook&flow=${flow}`,
        });

        const facebookOAuthURL = `${FACEBOOK_AUTH_URL}?${params.toString()}`;
        authWindow.location.href = facebookOAuthURL;

        const interval = setInterval(() => {
          try {
            if (authWindow.closed) {
              setLoading(false);
              clearInterval(interval);
              return;
            }

            const popupUrl = new URL(authWindow.location.href);
            const authCode = popupUrl.searchParams.get("code");

            const stateParams = new URLSearchParams(
              popupUrl.searchParams.get("state") || "",
            );
            const provider = stateParams.get("provider");
            const flow = stateParams.get("flow");

            if (authCode && provider === "facebook" && flow === "popup") {
              authWindow.close();
              setLoading(false);
              clearInterval(interval);
              handleTokenExchange(authCode);
            }
          } catch {
            if (authWindow?.closed) {
              setLoading(false);
              clearInterval(interval);
            }
          }
        }, 250);
      })();
    }
  };

  const handleTokenExchange = async (authCode: string) => {
    const verifier = sessionStorage.getItem("facebook_verifier");
    if (!verifier || tokenExchanged) {
      console.error("Missing verifier or token already exchanged");
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
