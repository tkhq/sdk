import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import AppleLogin from "react-apple-login";

interface AppleAuthButtonProps {
  iframePublicKey: string;
  clientId: string;
  redirectURI: string;
  onSuccess: (response: any) => void;
}

const AppleAuthButton: React.FC<AppleAuthButtonProps> = ({ iframePublicKey, onSuccess, clientId, redirectURI }) => {
  return (
    <AppleLogin
      nonce={bytesToHex(sha256(iframePublicKey))}
      clientId={clientId}
      redirectURI={redirectURI}
      responseType="code id_token"
      responseMode="fragment"
      callback={(response) => {
        if (response.error) {
          console.error("Apple login error:", response.error);
        } else {
          onSuccess(response);
        }
      }}
      usePopup
      designProp={{
        type: "continue",
        color: "white",
      }}
    />
  );
};

export default AppleAuthButton;
