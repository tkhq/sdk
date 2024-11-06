"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { SiFacebook } from "@icons-pack/react-simple-icons";
import styles from "./Facebook.module.css";
import { exchangeCodeForToken, generateChallengePair } from "./facebook-utils";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

interface FacebookAuthButtonProps {
  iframePublicKey: string;
  clientId: string;
  authAPIVersion: string;
  redirectURI: string;
  onSuccess: (response: any) => void;
}

const FacebookAuthButton: React.FC<FacebookAuthButtonProps> = ({ iframePublicKey, onSuccess, clientId, authAPIVersion, redirectURI }) => {
  const searchParams = useSearchParams();

  const initiateFacebookLogin = async () => {
    const { verifier, codeChallenge } = await generateChallengePair();
    const codeChallengeMethod = "sha256";

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectURI,
      state: verifier,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      nonce: bytesToHex(sha256(iframePublicKey || "")),
      scope: "openid",
      response_type: "code",
    });

    const facebookOAuthURL = `https://www.facebook.com/v${authAPIVersion}/dialog/oauth?${params.toString()}`;
    window.location.href = facebookOAuthURL;
  };

  const handleTokenExchange = async (authCode: string, authState: string) => {
    console.log("HERE")
    const verifier = authState;
    const tokenData = await exchangeCodeForToken(clientId, redirectURI, authCode, verifier);
    console.log(tokenData)
    onSuccess(tokenData);
  };

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (code && state) {
      handleTokenExchange(code, state);
    }
  }, [searchParams]);

  return (
    <div className={styles.facebookButton} onClick={initiateFacebookLogin}>
      <SiFacebook />
      <span className={styles.buttonText}>Continue with Facebook</span>
    </div>
  );
};

export default FacebookAuthButton;
