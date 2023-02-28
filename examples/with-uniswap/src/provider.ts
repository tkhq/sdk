import { ethers } from "ethers";
import { TurnkeySigner } from "@turnkey/ethers";
import { Environment } from "./constants";

const DEFAULT_INFURA_COMMUNITY_KEY = "84842078b09946638c03157f83405213";
const DEFAULT_ENV = Environment.GOERLI;

let provider = new ethers.providers.InfuraProvider(
  DEFAULT_ENV,
  process.env.INFURA_KEY || DEFAULT_INFURA_COMMUNITY_KEY
);

export function getProvider(
  env = Environment.GOERLI
): ethers.providers.Provider {
  if (env !== Environment.GOERLI) {
    provider = new ethers.providers.InfuraProvider(
      env,
      process.env.INFURA_KEY || DEFAULT_INFURA_COMMUNITY_KEY
    );
  }

  return provider;
}

// Initialize a Turnkey Signer
const turnkeySigner = new TurnkeySigner({
  apiPublicKey: process.env.API_PUBLIC_KEY!,
  apiPrivateKey: process.env.API_PRIVATE_KEY!,
  baseUrl: process.env.BASE_URL!,
  organizationId: process.env.ORGANIZATION_ID!,
  privateKeyId: process.env.PRIVATE_KEY_ID!,
});

// getTurnkeySigner returns a TurnkeySigner connected to the passed-in Provider
// (https://docs.ethers.org/v5/api/providers/)
export function getTurnkeySigner(
  provider: ethers.providers.Provider
): TurnkeySigner {
  return turnkeySigner.connect(provider);
}
