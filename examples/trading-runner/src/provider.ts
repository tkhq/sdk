import * as path from "path";
import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { TurnkeySigner } from "@turnkey/ethers";

import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";

import { Environment } from "./utils";

const DEFAULT_INFURA_COMMUNITY_KEY = "84842078b09946638c03157f83405213";
const DEFAULT_ENV = Environment.SEPOLIA;

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

let provider = new ethers.InfuraProvider(
  DEFAULT_ENV,
  process.env.INFURA_KEY || DEFAULT_INFURA_COMMUNITY_KEY,
);

export function getProvider(env = Environment.SEPOLIA): ethers.Provider {
  if (env !== Environment.SEPOLIA) {
    provider = new ethers.InfuraProvider(
      env,
      process.env.INFURA_KEY || DEFAULT_INFURA_COMMUNITY_KEY,
    );
  }

  return provider;
}

// getTurnkeySigner returns a TurnkeySigner connected to the passed-in Provider
// (https://docs.ethers.org/v6/api/providers/)
export function getTurnkeySigner(
  provider: ethers.Provider,
  signWith: string,
): TurnkeySigner {
  const turnkeyClient = new TurnkeySDKServer({
    apiBaseUrl: "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  // Initialize a Turnkey Signer
  const turnkeySigner = new TurnkeySigner({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith,
  });

  return turnkeySigner.connect(provider);
}
