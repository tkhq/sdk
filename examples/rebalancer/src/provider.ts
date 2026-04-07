import * as path from "path";
import * as dotenv from "dotenv";
import { ethers } from "ethers";

import { TurnkeySigner } from "@turnkey/ethers";
import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });


// Bring your own provider using a RPC URL (https://docs.ethers.org/v6/api/providers/jsonrpc/#JsonRpcProvider)
export function getProvider(): ethers.JsonRpcProvider {
  const provider = new ethers.JsonRpcProvider(
    process.env.RPC_URL,
  );

  return provider;
}

export function getTurnkeyClient(): TurnkeySDKServer {
  const turnkeyClient = new TurnkeySDKServer({
    apiBaseUrl: "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  return turnkeyClient;
}

// getTurnkeySigner returns a TurnkeySigner connected to the passed-in Provider
// (https://docs.ethers.org/v6/api/providers/)
export function getTurnkeySigner(
  provider: ethers.Provider,
  signWith: string,
): TurnkeySigner {
  const turnkeyClient = getTurnkeyClient();

  // Initialize a Turnkey Signer
  // TODO: Update this once @turnkey/ethers supports sdk-server types
  const turnkeySigner = new TurnkeySigner({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith,
  });

  return turnkeySigner.connect(provider);
}
