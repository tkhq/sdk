import type { NextApiRequest, NextApiResponse } from "next";
import {
  TurnkeyApiTypes,
  TurnkeyClient,
  createActivityPoller,
} from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

type TAttestation = TurnkeyApiTypes["v1Attestation"];

type CreateSubOrgRequest = {
  subOrgName: string;
  challenge: string;
  attestation: TAttestation;
};

type CreateSubOrgResponse = {
  subOrgId: string;
  privateKeyId: string;
  privateKeyAddress: string;
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
    const privateKeyName = `Default ETH Key`;

    const completedActivity = await activityPoller({
      type: "ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V3",
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
        privateKeys: [
          {
            privateKeyName,
            curve: "CURVE_SECP256K1",
            addressFormats: ["ADDRESS_FORMAT_ETHEREUM"],
            privateKeyTags: [],
          },
        ],
      },
    });

    const subOrgId = refineNonNull(
      completedActivity.result.createSubOrganizationResultV3?.subOrganizationId
    );
    const privateKeys = refineNonNull(
      completedActivity.result.createSubOrganizationResultV3?.privateKeys
    );
    const privateKeyId = refineNonNull(privateKeys?.[0]?.privateKeyId);
    const privateKeyAddress = refineNonNull(
      privateKeys?.[0]?.addresses?.[0]?.address
    );

    res.status(200).json({
      subOrgId,
      privateKeyId,
      privateKeyAddress,
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
