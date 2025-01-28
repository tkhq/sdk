import type { NextApiRequest, NextApiResponse } from "next";
import {
  Turnkey as TurnkeyServerSDK,
  TurnkeyApiTypes,
} from "@turnkey/sdk-server";
import { CreateSubOrgResponse } from "@/app/types";

type TAttestation = TurnkeyApiTypes["v1Attestation"];

type CreateSubOrgRequest = {
  userEmail: string;
  subOrgName: string;
  challenge: string;
  attestation: TAttestation;
};

type ErrorMessage = {
  message: string;
};

// Default path for the first Ethereum address in a new HD wallet.
// See https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki, paths are in the form:
//     m / purpose' / coin_type' / account' / change / address_index
// - Purpose is a constant set to 44' following the BIP43 recommendation.
// - Coin type is set to 60 (ETH) -- see https://github.com/satoshilabs/slips/blob/master/slip-0044.md
// - Account, Change, and Address Index are set to 0
const ETHEREUM_WALLET_DEFAULT_PATH = "m/44'/60'/0'/0/0";

export default async function createUser(
  req: NextApiRequest,
  res: NextApiResponse<CreateSubOrgResponse | ErrorMessage>
) {
  const createSubOrgRequest = req.body as CreateSubOrgRequest;

  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
  });

  try {
    const walletName = `Default Wallet`;

    const completedActivity = await turnkeyClient
      .apiClient()
      .createSubOrganization({
        subOrganizationName: createSubOrgRequest.subOrgName,
        rootQuorumThreshold: 1,
        rootUsers: [
          {
            userName: "New user",
            userEmail: createSubOrgRequest.userEmail,
            apiKeys: [],
            authenticators: [
              {
                authenticatorName: "Passkey",
                challenge: createSubOrgRequest.challenge,
                attestation: createSubOrgRequest.attestation,
              },
            ],
            oauthProviders: [],
          },
        ],
        wallet: {
          walletName,
          accounts: [
            {
              curve: "CURVE_SECP256K1",
              pathFormat: "PATH_FORMAT_BIP32",
              path: ETHEREUM_WALLET_DEFAULT_PATH,
              addressFormat: "ADDRESS_FORMAT_ETHEREUM",
            },
          ],
        },
      });

    const subOrgId = refineNonNull(completedActivity?.subOrganizationId);
    const wallet = refineNonNull(completedActivity?.wallet);
    const walletAddress = wallet.addresses?.[0];

    res.status(200).json({
      subOrgId: subOrgId,
      wallet: {
        id: wallet.walletId,
        name: walletName,
        accounts: [
          {
            address: walletAddress,
            path: ETHEREUM_WALLET_DEFAULT_PATH,
          },
        ],
      },
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: "Something went wrong.",
    });
  }
}

function refineNonNull<T>(
  input: T | null | undefined,
  errorMessage?: string
): T {
  if (input == null) {
    throw new Error(errorMessage ?? `Unexpected ${JSON.stringify(input)}`);
  }

  return input;
}
