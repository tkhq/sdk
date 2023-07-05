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
  orgName: string;
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
  const createUserRequest = req.body as CreateSubOrgRequest;

  const createUserMutation = withAsyncPolling({
    request: TurnkeyApi.postCreateSubOrganization,
  });

  try {
    const createUserActivity = await createUserMutation({
      body: {
        type: "ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION",
        organizationId: process.env.ORGANIZATION_ID!,
        parameters: {
          name: createUserRequest.orgName,
          rootAuthenticator: {
            authenticatorName: "Passkey",
            challenge: createUserRequest.challenge,
            attestation: createUserRequest.attestation,
          },
        },
        timestampMs: String(Date.now()),
      },
    });

    const subOrgId = refineNonNull(
      createUserActivity.result.createSubOrganizationResult?.subOrganizationId
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
