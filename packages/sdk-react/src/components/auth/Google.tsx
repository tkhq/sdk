import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";

interface GoogleAuthButtonProps {
  iframePublicKey: string;
  onSuccess: (response: any) => void;
}

const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({ iframePublicKey, onSuccess }) => {
  return (
    <GoogleOAuthProvider clientId="776352896366-fjmbvor86htj99lap5pb6joeupf67ovo.apps.googleusercontent.com">
      <GoogleLogin
        nonce={bytesToHex(sha256(iframePublicKey))}
        onSuccess={onSuccess}
        useOneTap
        auto_select={false}
        text="signin_with"
        ux_mode="popup"
      />
    </GoogleOAuthProvider>
  );
};

export default GoogleAuthButton;
