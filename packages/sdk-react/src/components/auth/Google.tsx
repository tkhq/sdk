import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";

interface GoogleAuthButtonProps {
  iframePublicKey: string;
  clientId: string;
  onSuccess: (response: any) => void;
}

const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({ iframePublicKey, onSuccess, clientId}) => {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <GoogleLogin
        nonce={bytesToHex(sha256(iframePublicKey))}
        onSuccess={onSuccess}
        useOneTap
        width={235}
        containerProps={{
          style: {
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            borderRadius: '8px',
            padding: '10px',
            cursor: 'pointer',
            maxWidth: '235px',
          },
        }}
        auto_select={false}
        text="continue_with"
        ux_mode="popup"
      />
    </GoogleOAuthProvider>
  );
};

export default GoogleAuthButton;
