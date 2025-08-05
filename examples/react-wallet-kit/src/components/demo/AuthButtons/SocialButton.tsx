import { AddSVG, UnlinkSVG } from "@/components/Svg";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import { OAuthProviders } from "@turnkey/sdk-types";

const SocialButton = ({
  provider,
  logo,
}: {
  provider: OAuthProviders;
  logo: React.ReactNode;
}) => {
  const { handleAddOAuthProvider, handleRemoveOAuthProvider, user } =
    useTurnkey();

  const existingProvider = user?.oauthProviders.find(
    (p) => p.providerName.toLowerCase() === provider.toLowerCase(),
  );

  return (
    <button
      onClick={() => {
        if (existingProvider) {
          handleRemoveOAuthProvider({
            providerId: existingProvider.providerId,
          });
        } else {
          handleAddOAuthProvider({ providerName: provider });
        }
      }}
      className="flex hover:cursor-pointer items-center gap-2 p-3 bg-background-light dark:bg-background-dark shadow rounded-lg justify-between"
    >
      <p className="flex items-center gap-2 text-text-light dark:text-text-dark">
        {logo}
        <span className=" text-text-light dark:text-text-dark">{provider}</span>
      </p>
      {existingProvider ? (
        <p className="flex items-center text-sm gap-2 text-text-light/40 dark:text-text-dark/40">
          <UnlinkSVG className="w-4 h-4" />
        </p>
      ) : (
        <p className="flex items-center text-sm gap-2 text-text-light/40 dark:text-text-dark/40">
          <AddSVG className="w-4 h-4" />
          <span>Connect</span>
        </p>
      )}
    </button>
  );
};

export default SocialButton;
