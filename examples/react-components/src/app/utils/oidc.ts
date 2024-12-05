"use client";

import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import { exchangeCodeForToken, generateChallengePair } from "./facebookUtils";

// OAuth URLs
const APPLE_AUTH_URL = "https://appleid.apple.com/auth/authorize";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const FACEBOOK_AUTH_URL = "https://www.facebook.com/v11.0/dialog/oauth";

// Popup Size
const popupWidth = 500;
const popupHeight = 600;
interface OidcTokenParams {
  iframePublicKey: string;
  clientId: string;
  redirectURI: string;
}

export const appleOidcToken = async ({
  iframePublicKey,
  clientId,
  redirectURI,
}: OidcTokenParams): Promise<any> => {
  const nonce = bytesToHex(sha256(iframePublicKey));
  const appleAuthUrl = new URL(APPLE_AUTH_URL);
  appleAuthUrl.searchParams.set("client_id", clientId);
  appleAuthUrl.searchParams.set("redirect_uri", redirectURI);
  appleAuthUrl.searchParams.set("response_type", "code id_token");
  appleAuthUrl.searchParams.set("response_mode", "fragment");
  appleAuthUrl.searchParams.set("nonce", nonce);

  const width = popupWidth;
  const height = popupHeight;
  const left = window.screenX + (window.innerWidth - width) / 2;
  const top = window.screenY + (window.innerHeight - height) / 2;

  return new Promise((resolve, reject) => {
    const authWindow = window.open(
      appleAuthUrl.toString(),
      "_blank",
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
    );

    if (!authWindow) {
      reject(new Error("Failed to open Apple login window."));
      return;
    }

    const interval = setInterval(() => {
      try {
        const url = authWindow?.location.href || "";
        if (url.startsWith(window.location.origin)) {
          const hashParams = new URLSearchParams(url.split("#")[1]);
          const idToken = hashParams.get("id_token");
          if (idToken) {
            authWindow?.close();
            clearInterval(interval);
            resolve({ idToken });
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
        reject(new Error("Apple login window was closed."));
      }
    }, 500);
  });
};

export const googleOidcToken = async ({
  iframePublicKey,
  clientId,
  redirectURI,
}: OidcTokenParams): Promise<any> => {
  const nonce = bytesToHex(sha256(iframePublicKey));
  const googleAuthUrl = new URL(GOOGLE_AUTH_URL);
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectURI);
  googleAuthUrl.searchParams.set("response_type", "id_token");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("nonce", nonce);
  googleAuthUrl.searchParams.set("prompt", "select_account");

  const width = popupWidth;
  const height = popupHeight;
  const left = window.screenX + (window.innerWidth - width) / 2;
  const top = window.screenY + (window.innerHeight - height) / 2;

  return new Promise((resolve, reject) => {
    const authWindow = window.open(
      googleAuthUrl.toString(),
      "_blank",
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
    );

    if (!authWindow) {
      reject(new Error("Failed to open Google login window."));
      return;
    }

    const interval = setInterval(() => {
      try {
        const url = authWindow?.location.href || "";
        if (url.startsWith(window.location.origin)) {
          const hashParams = new URLSearchParams(url.split("#")[1]);
          const idToken = hashParams.get("id_token");
          if (idToken) {
            authWindow?.close();
            clearInterval(interval);
            resolve({ idToken });
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
        reject(new Error("Google login window was closed."));
      }
    }, 500);
  });
};

export const facebookOidcToken = async ({
  iframePublicKey,
  clientId,
  redirectURI,
}: OidcTokenParams): Promise<any> => {
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

  const facebookOAuthURL = `${FACEBOOK_AUTH_URL}?${params.toString()}`;
  const width = popupWidth;
  const height = popupHeight;
  const left = window.screenX + (window.innerWidth - width) / 2;
  const top = window.screenY + (window.innerHeight - height) / 2;

  return new Promise((resolve, reject) => {
    const popup = window.open(
      facebookOAuthURL,
      "_blank",
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
    );

    if (!popup) {
      reject(new Error("Failed to open login popup"));
      return;
    }

    const interval = setInterval(async () => {
      try {
        if (popup.closed) {
          clearInterval(interval);
          reject(
            new Error("Popup closed by user before completing authentication")
          );
          return;
        }

        const popupUrl = new URL(popup.location.href);
        const authCode = popupUrl.searchParams.get("code");

        if (authCode) {
          popup.close();
          clearInterval(interval);
          const verifier = sessionStorage.getItem("facebook_verifier");
          if (!verifier) {
            reject(new Error("No verifier found in sessionStorage"));
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
            resolve({ idToken: tokenData.id_token });
          } catch (error) {
            reject(new Error(`Error during token exchange: ${error}`));
          }
        }
      } catch (error) {
        // Ignore cross-origin errors until the popup redirects to the same origin.
        // These errors occur because the script attempts to access the URL of the popup window while it's on a different domain.
        // Due to browser security policies (Same-Origin Policy), accessing properties like location.href on a window that is on a different domain will throw an exception.
        // Once the popup redirects to the same origin as the parent window, these errors will no longer occur, and the script can safely access the popup's location to extract parameters.
      }
    }, 250);
  });
};
