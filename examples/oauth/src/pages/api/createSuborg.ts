import type { NextApiRequest, NextApiResponse } from "next";
import { TurnkeyClient, createActivityPoller } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

type CreateSuborgRequest = {
  oauthProviders: Provider[];
};

type Provider = {
  providerName: string;
  oidcToken: string;
};
type CreateSuborgResponse = {
  subOrganizationId: string;
};
type ErrorMessage = {
  message: string;
};

export default async function createSuborg(
  req: NextApiRequest,
  res: NextApiResponse<CreateSuborgResponse | ErrorMessage>
) {
  try {
    const request = req.body as CreateSuborgRequest;
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

    const completedActivity = await activityPoller({
      type: "ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V7",
      timestampMs: String(Date.now()),
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
      parameters: {
        subOrganizationName: `example-suborg-${String(Date.now())}`, // Adjust this name as needed
        rootQuorumThreshold: 1,
        rootUsers: [
          {
            userName: `example-user${String(Date.now())}`,
            userEmail: "",
            userPhoneNumber: "",
            apiKeys: [],
            authenticators: [],
            oauthProviders: request.oauthProviders,
          },
        ],
      },
    });

    const subOrganizationId =
      completedActivity.result.createSubOrganizationResultV7?.subOrganizationId;
    if (!subOrganizationId) {
      throw new Error("Expected a non-null suborgId!");
    }

    res.status(200).json({
      subOrganizationId,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: "Something went wrong.",
    });
  }
}
