import { useTurnkey } from "./use-turnkey";

// Define the AuthProtocol enum
export enum AuthMethod {
  Wallet = "wallet",
  OAuth = "oauth",
  Email = "email",
  OTP = "otp",
}

// Define the useAuth hook
export function useAuth(protocol: AuthMethod) {
  const { walletClient, authIframeClient } = useTurnkey();

  // Define the signIn function
  const signIn = async () => {
    switch (protocol) {
      case AuthMethod.Wallet:
        return walletClient?.login();
      case AuthMethod.OAuth:
      case AuthMethod.Email:
      case AuthMethod.OTP:
        if (!authIframeClient) {
          throw new Error("Auth iframe client not found");
        }
        return authIframeClient?.loginWithReadWriteSession(
          authIframeClient?.iframePublicKey ?? ""
        );
      default:
        throw new Error("Unsupported authentication protocol");
    }
  };

  // Placeholder for signUp function
  const signUp = async () => {
    // Implement signUp logic based on protocol
  };

  // Placeholder for auth object
  const auth = {
    // Implement auth object properties and methods
  };

  return { signIn, signUp };
}
