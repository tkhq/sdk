import AppleLogin from "react-apple-login";

interface AppleAuthButtonProps {
  onSuccess: (response: any) => void;
}

const AppleAuthButton: React.FC<AppleAuthButtonProps> = ({ onSuccess }) => {
  return (
    <AppleLogin
      clientId="YOUR_APPLE_CLIENT_ID"
      redirectURI="YOUR_REDIRECT_URI"
      responseType="code id_token"
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
