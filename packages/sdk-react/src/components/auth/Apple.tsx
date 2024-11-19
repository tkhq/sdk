import { useEffect, useState } from "react";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import AppleLogin from "react-apple-login";
import styles from "./Socials.module.css";
import appleIcon from "assets/apple.svg";
interface AppleAuthButtonProps {
  iframePublicKey: string;
  clientId: string;
  onSuccess: (response: any) => void;
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
}) => {
  const [appleSDKLoaded, setAppleSDKLoaded] = useState(false);
  const redirectURI = process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI!;
  useEffect(() => {
    const loadAppleSDK = () => {
      const script = document.createElement("script");
      script.src =
        "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
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

  if (!appleSDKLoaded) {
    return null; // Or render a loading spinner
  }

  return (
    
    <AppleLogin
      nonce={bytesToHex(sha256(iframePublicKey))}
      clientId={clientId}
      redirectURI={redirectURI}
      responseType="code id_token"
      responseMode="fragment"
      render={({ onClick }) => (
        <div onClick={onClick} className={styles.socialButton}>
          <img src={appleIcon} className={styles.iconSmall} />
          <span>Apple</span>
        </div>
      )}
      callback={(response) => {
        if (response.error) {
          console.error("Apple login error:", response.error);
        } else {
          onSuccess(response);
        }
      }}
      usePopup
    />
  );
};

export default AppleAuthButton;
