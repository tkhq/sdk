import { AuthToggleButton } from "./index";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import { WalletSVG } from "@/components/Svg";

export default function WalletAuthButton({
  canRemoveAuthMethod,
}: {
  canRemoveAuthMethod: boolean;
}) {
  const {
    user,
    httpClient,
    buildWalletLoginRequest,
    fetchWalletProviders,
    refreshUser,
  } = useTurnkey();

  const existingWalletKey = user?.apiKeys?.find((key) =>
    key.apiKeyName.startsWith("wallet-auth"),
  );

  const handleAddWallet = async () => {
    if (!httpClient) throw new Error("HTTP client not available");

    const providers = await fetchWalletProviders();
    console.log(providers);
    const selectedProvider = providers?.[0];
    if (!selectedProvider) throw new Error("No wallet providers found");

    const { publicKey } = await buildWalletLoginRequest({
      walletProvider: selectedProvider,
    });
    if (!publicKey) throw new Error("No publicKey returned");

    const curveType =
      selectedProvider.chainInfo.namespace === "solana"
        ? "API_KEY_CURVE_ED25519"
        : "API_KEY_CURVE_SECP256K1";

    const userId = user?.userId;
    if (!userId) throw new Error("User ID not found");

    await httpClient.createApiKeys({
      apiKeys: [
        {
          apiKeyName: `wallet-auth-${publicKey}`,
          publicKey,
          curveType,
        },
      ],
      userId,
    });
    await refreshUser();
  };

  const handleRemoveWallet = async () => {
    if (!httpClient || !existingWalletKey) return;
    const userId = user?.userId;
    if (!userId) throw new Error("User ID not found");

    await httpClient.deleteApiKeys({
      apiKeyIds: [existingWalletKey.apiKeyId],
      userId,
    });
    await refreshUser();
  };

  return (
    <AuthToggleButton
      label="Wallet"
      icon={<WalletSVG className="w-6 h-6" />}
      isLinked={!!existingWalletKey}
      onAdd={handleAddWallet}
      canRemoveAuthMethod={canRemoveAuthMethod}
      onRemove={handleRemoveWallet}
    />
  );
}
