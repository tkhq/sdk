import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import type { User } from "./types";

export const createClient = (
  publicKey: string,
  privateKey: string,
  apiBaseUrl: string,
): TurnkeyClient => {
  const stamper = new ApiKeyStamper({
    apiPrivateKey: privateKey,
    apiPublicKey: publicKey,
  });
  return new TurnkeyClient({ baseUrl: apiBaseUrl }, stamper);
};

export const fetchUser = async (
  client: TurnkeyClient,
  organizationId: string,
): Promise<User | undefined> => {
  const whoami = await client.getWhoami({ organizationId });
  if (whoami.userId && whoami.organizationId) {
    const [walletsResponse, userResponse] = await Promise.all([
      client.getWallets({ organizationId: whoami.organizationId }),
      client.getUser({
        organizationId: whoami.organizationId,
        userId: whoami.userId,
      }),
    ]);
    const wallets = await Promise.all(
      walletsResponse.wallets.map(async (wallet) => {
        const accounts = await client.getWalletAccounts({
          organizationId: whoami.organizationId,
          walletId: wallet.walletId,
        });
        return {
          name: wallet.walletName,
          id: wallet.walletId,
          accounts: accounts.accounts.map((account) => ({
            id: account.walletAccountId,
            curve: account.curve,
            pathFormat: account.pathFormat,
            path: account.path,
            addressFormat: account.addressFormat,
            address: account.address,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt,
          })),
        };
      }),
    );
    const user = userResponse.user;
    return {
      id: user.userId,
      userName: user.userName,
      email: user.userEmail,
      phoneNumber: user.userPhoneNumber,
      organizationId: whoami.organizationId,
      wallets,
    };
  }
  return undefined;
};
