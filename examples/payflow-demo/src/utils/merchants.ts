import { getTurnkeyClient, getTurnkeyClientForSubOrg } from "../provider";

export interface PolicyInfo {
  policyId: string;
  policyName: string;
  effect: string;
  condition?: string;
  consensus?: string;
  notes?: string;
}

export interface MerchantInfo {
  subOrganizationId: string;
  subOrganizationName: string;
  wallets: Array<{
    walletId: string;
    walletName: string;
    address: string;
  }>;
  policies: PolicyInfo[];
}

/**
 * Lists all sub-organizations (merchants) in the parent organization
 */
export async function listMerchants(): Promise<MerchantInfo[]> {
  const turnkeyClient = getTurnkeyClient();
  const organizationId = process.env.ORGANIZATION_ID!;

  try {
    // Get all sub-organizations
    const subOrgsResponse = await turnkeyClient.apiClient().getSubOrgIds({
      organizationId,
    });

    const subOrgIds = subOrgsResponse.organizationIds || [];

    // For each sub-org, get its details and wallets
    const merchants: MerchantInfo[] = [];

    for (const subOrgId of subOrgIds) {
      try {
        // Get sub-org details (we'll need to query wallets to get the name)
        const subOrgClient = getTurnkeyClientForSubOrg(subOrgId);
        
        // Get all wallets in this sub-org
        const walletsResponse = await subOrgClient.apiClient().getWallets({
          organizationId: subOrgId,
        });

        const wallets = walletsResponse.wallets || [];
        
        // Try to get sub-org name from first wallet name or use sub-org ID
        const subOrgName = wallets[0]?.walletName?.replace(" Wallet", "") || subOrgId.slice(0, 8) + "...";

        // Get addresses for each wallet by fetching wallet accounts
        const merchantWallets = await Promise.all(
          wallets.map(async (wallet) => {
            try {
              // Get wallet accounts to retrieve the address
              const accountsResponse = await subOrgClient.apiClient().getWalletAccounts({
                organizationId: subOrgId,
                walletId: wallet.walletId,
              });

              // Get the first account's address (primary address)
              const primaryAddress = accountsResponse.accounts?.[0]?.address || "N/A";

              return {
                walletId: wallet.walletId,
                walletName: wallet.walletName || "Unnamed Wallet",
                address: primaryAddress,
              };
            } catch (error: any) {
              // If we can't get accounts, return wallet without address
              return {
                walletId: wallet.walletId,
                walletName: wallet.walletName || "Unnamed Wallet",
                address: "N/A",
              };
            }
          })
        );

        // Get policies for this sub-organization
        let policies: PolicyInfo[] = [];
        try {
          const policiesResponse = await subOrgClient.apiClient().getPolicies({
            organizationId: subOrgId,
          });
          
          policies = (policiesResponse.policies || []).map((policy: any) => ({
            policyId: policy.policyId || "",
            policyName: policy.policyName || "Unnamed Policy",
            effect: policy.effect || "UNKNOWN",
            condition: policy.condition,
            consensus: policy.consensus,
            notes: policy.notes,
          }));
        } catch (error: any) {
          // If we can't get policies, continue without them
          console.log(`[WARNING] Could not fetch policies for sub-org ${subOrgId}: ${error.message}`);
        }

        merchants.push({
          subOrganizationId: subOrgId,
          subOrganizationName: subOrgName,
          wallets: merchantWallets,
          policies,
        });
      } catch (error: any) {
        // Skip sub-orgs we can't access
        console.log(`[WARNING] Could not access sub-org ${subOrgId}: ${error.message}`);
      }
    }

    return merchants;
  } catch (error: any) {
    throw new Error(`Failed to list merchants: ${error.message || "Unknown error"}`);
  }
}

/**
 * Gets details for a specific merchant sub-organization
 */
export async function getMerchantDetails(subOrganizationId: string): Promise<MerchantInfo | null> {
  const subOrgClient = getTurnkeyClientForSubOrg(subOrganizationId);

  try {
    // Get all wallets in this sub-org
    const walletsResponse = await subOrgClient.apiClient().getWallets({
      organizationId: subOrganizationId,
    });

    const wallets = walletsResponse.wallets || [];
    
    const subOrgName = wallets[0]?.walletName?.replace(" Wallet", "") || subOrganizationId.slice(0, 8) + "...";

    // Get addresses for each wallet by fetching wallet accounts
    const merchantWallets = await Promise.all(
      wallets.map(async (wallet) => {
        try {
          // Get wallet accounts to retrieve the address
          const accountsResponse = await subOrgClient.apiClient().getWalletAccounts({
            organizationId: subOrganizationId,
            walletId: wallet.walletId,
          });

          // Get the first account's address (primary address)
          const primaryAddress = accountsResponse.accounts?.[0]?.address || "N/A";

          return {
            walletId: wallet.walletId,
            walletName: wallet.walletName || "Unnamed Wallet",
            address: primaryAddress,
          };
        } catch (error: any) {
          // If we can't get accounts, return wallet without address
          return {
            walletId: wallet.walletId,
            walletName: wallet.walletName || "Unnamed Wallet",
            address: "N/A",
          };
        }
      })
    );

    // Get policies for this sub-organization
    let policies: PolicyInfo[] = [];
    try {
      const policiesResponse = await subOrgClient.apiClient().getPolicies({
        organizationId: subOrganizationId,
      });
      
      policies = (policiesResponse.policies || []).map((policy: any) => ({
        policyId: policy.policyId || "",
        policyName: policy.policyName || "Unnamed Policy",
        effect: policy.effect || "UNKNOWN",
        condition: policy.condition,
        consensus: policy.consensus,
        notes: policy.notes,
      }));
    } catch (error: any) {
      // If we can't get policies, continue without them
    }

    return {
      subOrganizationId,
      subOrganizationName: subOrgName,
      wallets: merchantWallets,
      policies,
    };
  } catch (error: any) {
    return null;
  }
}

