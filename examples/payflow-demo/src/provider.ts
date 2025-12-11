import * as path from "path";
import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { TurnkeySigner } from "@turnkey/ethers";
import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const DEFAULT_NETWORK = "sepolia";

export function getProvider(network: string = DEFAULT_NETWORK): ethers.Provider {
  // Infura key must be provided via INFURA_KEY environment variable
  const infuraKey = process.env.INFURA_KEY;
  
  if (!infuraKey) {
    throw new Error(
      "INFURA_KEY is required. Please set it in your .env.local file.\n" +
      "Get your key at: https://www.infura.io/"
    );
  }
  
  return new ethers.InfuraProvider(network, infuraKey);
}

export function getTurnkeyClient(): TurnkeySDKServer {
  return new TurnkeySDKServer({
    apiBaseUrl: process.env.BASE_URL || "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });
}

/**
 * Creates a Turnkey client configured for a specific sub-organization
 * This is required when signing transactions from sub-organization wallets
 * The parent's API keys work because they are registered in the sub-org
 */
export function getTurnkeyClientForSubOrg(subOrganizationId: string): TurnkeySDKServer {
  return new TurnkeySDKServer({
    apiBaseUrl: process.env.BASE_URL || "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: subOrganizationId, // Use sub-org ID instead of parent
  });
}

export function getTurnkeySigner(
  provider: ethers.Provider,
  organizationId: string,
  signWith: string,
  client?: TurnkeySDKServer,
): TurnkeySigner {
  // Use provided client or create default one
  const turnkeyClient = client || getTurnkeyClient();

  const turnkeySigner = new TurnkeySigner({
    client: turnkeyClient.apiClient(),
    organizationId,
    signWith,
  });

  return turnkeySigner.connect(provider);
}


