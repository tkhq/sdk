import { TurnkeyClient } from "./index";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import type { Session, User } from "./types";

/**
 * Checks if a given session is valid.
 *
 * - A session is considered valid if it has a defined expiry time
 *   and the expiry time is in the future.
 *
 * @param session - The session to validate.
 * @returns `true` if the session is valid, otherwise `false`.
 */
export const isValidSession = (session?: Session | null): boolean => {
  return session?.expiry !== undefined && session.expiry > Date.now();
};

/**
 * Creates an authenticated Turnkey client instance.
 *
 * - Generates an `ApiKeyStamper` using the provided public and private keys.
 * - Instantiates a `TurnkeyClient` with the configured API base URL.
 *
 * @param publicKey The public key used for authentication.
 * @param privateKey The private key used for authentication.
 * @param apiBaseUrl The base URL of the Turnkey API.
 * @returns A new `TurnkeyClient` instance.
 */
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

/**
 * Fetches user details and associated wallets from the Turnkey API.
 *
 * - Retrieves the user's `whoami` information to obtain their id and organizationId.
 * - Fetches the user's wallets and account details.
 * - Fetches the user's profile information.
 * - Returns a `User` object containing the retrieved details.
 *
 * @param client The authenticated `TurnkeyClient` instance.
 * @param organizationId The ID of the organization to which the user belongs.
 * @returns The `User` object containing user details and associated wallets, or `undefined` if the user is not found.
 * @throws If any API request fails.
 */
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
