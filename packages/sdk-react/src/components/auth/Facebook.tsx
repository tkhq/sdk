"use client";

import { useState } from "react";
import styles from "./Socials.module.css";
import { exchangeCodeForToken, generateChallengePair } from "./facebookUtils";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import facebookIcon from "assets/facebook.svg";
interface FacebookAuthButtonProps {
  iframePublicKey: string;
  clientId: string;
  onSuccess: (response: any) => void;
}

const FacebookAuthButton: React.FC<FacebookAuthButtonProps & { layout: "inline" | "stacked" }> = ({
  iframePublicKey,
  onSuccess,
  clientId,
  layout,
}) => {
  const [tokenExchanged, setTokenExchanged] = useState<boolean>(false);
  const redirectURI = process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI!;

  const initiateFacebookLogin = async () => {
    const { verifier, codeChallenge } = await generateChallengePair();
    sessionStorage.setItem("facebook_verifier", verifier);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectURI,
      state: verifier,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      nonce: bytesToHex(sha256(iframePublicKey)),
      scope: "openid",
      response_type: "code",
    });

    const facebookOAuthURL = `https://www.facebook.com/v11.0/dialog/oauth?${params.toString()}`;

    const popup = window.open(
      facebookOAuthURL,
      "_blank",
      "width=500,height=600"
    );

    if (popup) {
      const interval = setInterval(async () => {
        try {
          if (popup.closed) {
            clearInterval(interval);
            return;
          }

          const popupUrl = new URL(popup.location.href);
          const authCode = popupUrl.searchParams.get("code");

          if (authCode) {
            popup.close();
            clearInterval(interval);
            handleTokenExchange(authCode);
          }
        } catch (error) {
          // Ignore cross-origin errors until the popup redirects to the same origin
        }
      }, 250);
    }
  };

  const handleTokenExchange = async (authCode: string) => {
    const redirectURI = process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI!;
    const verifier = sessionStorage.getItem("facebook_verifier");
    if (!verifier || tokenExchanged) {
      console.error(
        "No verifier found in sessionStorage or token exchange already completed"
      );
      return;
    }

    try {
      const tokenData = await exchangeCodeForToken(
        clientId,
        redirectURI,
        authCode,
        verifier
      );
      sessionStorage.removeItem("facebook_verifier");
      onSuccess(tokenData);
      setTokenExchanged(true);
    } catch (error) {
      console.error("Error during token exchange:", error);
    }
  };

  return (
    <div
      className={layout === "inline" ? styles.iconButton : styles.socialButton}
      onClick={initiateFacebookLogin}
    >
      <img src={facebookIcon} className={layout === "inline" ? styles.iconLarge : styles.iconSmall} />
      {layout === "stacked" && <span>Continue with Facebook</span>}
    </div>
  );
};

export default FacebookAuthButton;
