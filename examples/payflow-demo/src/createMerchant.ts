import * as crypto from "crypto";
import { DEFAULT_ETHEREUM_ACCOUNTS } from "@turnkey/sdk-server";
import { getTurnkeyClient } from "./provider";
import { refineNonNull } from "./utils";

export interface MerchantResult {
  subOrganizationId: string;
  walletId: string;
  address: string;
}

/**
 * Creates a merchant sub-organization with a default Ethereum wallet
 */
export async function createMerchant(
  merchantName: string = `Merchant ${crypto.randomBytes(4).toString("hex")}`,
): Promise<MerchantResult> {
  const turnkeyClient = getTurnkeyClient();

  // Get the parent org's API public key to use for the sub-org root user
  const parentApiPublicKey = process.env.API_PUBLIC_KEY!;

  // Create sub-organization with a default wallet
  // Use the parent org's API key for the root user so it can be managed
  const subOrgResponse = await turnkeyClient.apiClient().createSubOrganization({
    subOrganizationName: merchantName,
    rootUsers: [
      {
        userName: "Merchant Root User",
        apiKeys: [
          {
            apiKeyName: `merchant-${merchantName}-api-key`,
            publicKey: parentApiPublicKey,
            curveType: "API_KEY_CURVE_SECP256K1", // Assuming SECP256K1 for Ethereum
          },
        ],
        authenticators: [],
        oauthProviders: [],
      },
    ],
    rootQuorumThreshold: 1,
    wallet: {
      walletName: `${merchantName} Wallet`,
      accounts: DEFAULT_ETHEREUM_ACCOUNTS,
    },
  });

  const subOrganizationId = refineNonNull(
    subOrgResponse.subOrganizationId,
    "Failed to create sub-organization",
  );

  // Extract wallet information from the response
  // The wallet is created as part of the sub-organization creation
  const walletId = refineNonNull(
    subOrgResponse.wallet?.walletId,
    "Failed to get wallet ID from sub-organization",
  );

  const address = refineNonNull(
    subOrgResponse.wallet?.addresses?.[0],
    "Failed to get wallet address from sub-organization",
  );

  return {
    subOrganizationId,
    walletId,
    address,
  };
}

