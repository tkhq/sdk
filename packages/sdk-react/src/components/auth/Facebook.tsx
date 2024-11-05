"use client"

import { SiFacebook } from "@icons-pack/react-simple-icons"
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import { useEffect } from "react";
import { generateChallengePair } from "./facebook-utils"
import styles from "./Facebook.module.css";

interface FacebookAuthButtonProps {
  iframePublicKey: string;
  clientId: string;
  authAPIVersion: string;
  redirectURI: string;
  onSuccess: (response: any) => void;
}

const FacebookAuthButton: React.FC<FacebookAuthButtonProps> = ({ iframePublicKey, onSuccess, clientId, authAPIVersion, redirectURI }) => {

  const redirectToFacebook = async () => {
    const { verifier, codeChallenge } = await generateChallengePair()
    const codeChallengeMethod = "sha256"

    // Generate the Facebook OAuth URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectURI,
      state: verifier,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      nonce: bytesToHex(sha256(iframePublicKey)),
      scope: "openid",
      response_type: "code",
    } as any)

    const facebookOAuthURL = `https://www.facebook.com/v${authAPIVersion}/dialog/oauth?${params.toString()}`
    window.location.href = facebookOAuthURL
  }

  useEffect(() => {
    const handleFacebookRedirect = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get("code")
      const state = urlParams.get("state")

      if (code && state) {
        try {
          // Call backend to exchange the code for a token
          const response = await fetch("/api/auth/facebook/callback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, verifier: state })
          })
          const result = await response.json()
          if (response.ok) {
            onSuccess(result)
          } else {
            console.error("Facebook auth failed", result)
          }
        } catch (error) {
          console.error("Error during Facebook auth callback", error)
        }
      }
    }

    // Run this only once after redirect
    handleFacebookRedirect()
  }, [onSuccess])

  return (
    <div className={styles.facebookButton} onClick={redirectToFacebook}>
      <SiFacebook />
      <span className={styles.buttonText}>Continue with Facebook</span>
    </div>
  )
}

export default FacebookAuthButton
