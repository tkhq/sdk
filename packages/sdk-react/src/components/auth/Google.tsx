import { GoogleOAuthProvider } from "@react-oauth/google";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import styles from "./Socials.module.css";

interface GoogleAuthButtonProps {
  iframePublicKey: string;
  clientId: string;
  onSuccess: (response: any) => void;
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
}) => {

  const handleLogin = async () => {
    const nonce = bytesToHex(sha256(iframePublicKey));
    await window.google?.accounts.id.initialize({
      client_id: clientId,
      callback: onSuccess,
      nonce: nonce,
    });
    window.google?.accounts.id.prompt();
  };

  return (
    <GoogleOAuthProvider clientId={clientId}>
    <div className={styles.socialButton} onClick={handleLogin}>
      {/* <SiFacebook /> */}
      <img src="/google.svg" className = {styles.iconSmall}/>
      <span>Google</span>
    </div>
    </GoogleOAuthProvider>
  );
};

export default GoogleAuthButton;
