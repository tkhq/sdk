import type { NextApiRequest, NextApiResponse } from "next";
import {
  TurnkeyApiTypes,
  TurnkeyClient,
  createActivityPoller,
} from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { CreateSubOrgResponse, TFormattedWallet } from "@/app/types";

type TAttestation = TurnkeyApiTypes["v1Attestation"];

type CreateSubOrgRequest = {
  subOrgName: string;
  challenge: string;
  attestation: TAttestation;
};

type ErrorMessage = {
  message: string;
};

export default async function createUser(
  req: NextApiRequest,
  res: NextApiResponse<CreateSubOrgResponse | ErrorMessage>
) {
  const createSubOrgRequest = req.body as CreateSubOrgRequest;

  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.NEXT_PUBLIC_BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    })
  );

  const activityPoller = createActivityPoller({
    client: turnkeyClient,
    requestFn: turnkeyClient.createSubOrganization,
  });

  try {
    const walletName = `Default Wallet`;

    const completedActivity = await activityPoller({
      type: "ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V4",
      timestampMs: String(Date.now()),
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
      parameters: {
        subOrganizationName: createSubOrgRequest.subOrgName,
        rootQuorumThreshold: 1,
        rootUsers: [
          {
            userName: "New user",
            apiKeys: [],
            authenticators: [
              {
                authenticatorName: "Passkey",
                challenge: createSubOrgRequest.challenge,
                attestation: createSubOrgRequest.attestation,
              },
            ],
          },
        ],
        wallet: {
          walletName,
          accounts: [
            {
              curve: "CURVE_SECP256K1",
              pathFormat: "PATH_FORMAT_BIP32",
              path: "m/44'/60'/0'/0/0",
              addressFormat: "ADDRESS_FORMAT_ETHEREUM",
            },
          ],
        },
      },
    });

    const subOrgId = refineNonNull(
      completedActivity.result.createSubOrganizationResultV4?.subOrganizationId
    );
    const wallet = refineNonNull(
      completedActivity.result.createSubOrganizationResultV4?.wallet
    );
    const walletAddress = wallet.addresses?.[0];

    res.status(200).json({
      subOrgId: subOrgId,
      wallet: {
        id: wallet.walletId,
        name: walletName,
        accounts: [
          {
            address: walletAddress,
            path: "m/44'/60'/0'/0/0",
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
