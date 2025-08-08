import { AuthToggleButton } from "./index";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import { OAuthProviders } from "@turnkey/sdk-types";

interface SocialButtonProps {
  provider: OAuthProviders;
  logo: React.ReactNode;
}

export default function SocialButton({ provider, logo }: SocialButtonProps) {
  const { user, handleAddOAuthProvider, handleRemoveOAuthProvider } =
    useTurnkey();

  const existingProvider = user?.oauthProviders.find(
    (p) => p.providerName.toLowerCase() === provider.toLowerCase(),
  );

  return (
    <AuthToggleButton
      label={provider}
      icon={logo}
      isLinked={!!existingProvider}
      onAdd={() => handleAddOAuthProvider({ providerName: provider })}
      onRemove={() =>
        existingProvider &&
        handleRemoveOAuthProvider({ providerId: existingProvider.providerId })
      }
    />
  );
}
