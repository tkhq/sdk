import type { NextApiRequest, NextApiResponse } from "next";
import { TurnkeyApiTypes, TurnkeyClient } from "@turnkey/http";
import { createActivityPoller } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { refineNonNull } from "./utils";

type TAttestation = TurnkeyApiTypes["v1Attestation"];

type CreateSubOrgWithPrivateKeyRequest = {
  subOrgName: string;
  challenge: string;
  privateKeyName: string;
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
  const createSubOrgRequest = req.body as CreateSubOrgWithPrivateKeyRequest;

  try {
    const turnkeyClient = new TurnkeyClient(
      { baseUrl: process.env.NEXT_PUBLIC_TURNKEY_API_BASE_URL! },
      new ApiKeyStamper({
        apiPublicKey: process.env.API_PUBLIC_KEY!,
        apiPrivateKey: process.env.API_PRIVATE_KEY!,
      })
    );

    const activityPoller = createActivityPoller({
      client: turnkeyClient,
      requestFn: turnkeyClient.createSubOrganization,
    });

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
            privateKeyName: privateKeyName,
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
