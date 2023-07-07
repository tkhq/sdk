import type { NextApiRequest, NextApiResponse } from "next";
import {
  TurnkeyApi,
  init as httpInit,
  withAsyncPolling,
  FederatedRequest,
  TurnkeyApiTypes,
} from "@turnkey/http";
import axios from "axios";

type TAttestation = TurnkeyApiTypes["v1Attestation"];

type CreateSubOrgRequest = {
  subOrgName: string;
  challenge: string;
  attestation: TAttestation;
};

type CreateSubOrgResponse = {
  subOrgId: string;
};

type ErrorMessage = {
  message: string;
};

httpInit({
  apiPublicKey: process.env.API_PUBLIC_KEY!,
  apiPrivateKey: process.env.API_PRIVATE_KEY!,
  baseUrl: process.env.BASE_URL!,
});

export default async function createUser(
  req: NextApiRequest,
  res: NextApiResponse<CreateSubOrgResponse | ErrorMessage>
) {
  const createSubOrgRequest = req.body as CreateSubOrgRequest;

  const createSubOrgMutation = withAsyncPolling({
    request: TurnkeyApi.postCreateSubOrganization,
  });

  try {
    const createSubOrgActivity = await createSubOrgMutation({
      body: {
        type: "ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V2",
        timestampMs: String(Date.now()),
        organizationId: process.env.ORGANIZATION_ID!,
        parameters: {
          subOrganizationName: createSubOrgRequest.subOrgName,
          rootQuorumThreshold: 1,
          rootUsers: [
            {
              userName: "My new user",
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
        },
      },
    });

    const subOrgId = refineNonNull(
      createSubOrgActivity.result.createSubOrganizationResult?.subOrganizationId
    );

    res.status(200).json({
      subOrgId,
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
