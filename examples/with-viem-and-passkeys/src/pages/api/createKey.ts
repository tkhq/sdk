import type { NextApiRequest, NextApiResponse } from "next";
import { TSignedRequest, TurnkeyClient } from "@turnkey/http";
import axios from "axios";
import { TActivityResponse } from "@turnkey/http/dist/shared";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

type TResponse = {
  message: string;
  address?: string;
  privateKeyId?: string;
};

export default async function createKey(
  req: NextApiRequest,
  res: NextApiResponse<TResponse>
) {
  let signedRequest = req.body as TSignedRequest;

  try {
    const activityResponse = await axios.post(
      signedRequest.url,
      signedRequest.body,
      {
        headers: {
          [signedRequest.stamp.stampHeaderName]:
            signedRequest.stamp.stampHeaderValue,
        },
      }
    );

    if (activityResponse.status !== 200) {
      res.status(500).json({
        message: `expected 200, got ${activityResponse.status}`,
      });
    }

    let response = activityResponse.data as TActivityResponse;
    let attempts = 0;
    while (attempts < 3) {
      if (response.activity.status != "ACTIVITY_STATUS_COMPLETED") {
        const stamper = new ApiKeyStamper({
          apiPublicKey: process.env.API_PUBLIC_KEY!,
          apiPrivateKey: process.env.API_PRIVATE_KEY!,
        });
        const client = new TurnkeyClient(
          { baseUrl: process.env.NEXT_PUBLIC_TURNKEY_API_BASE_URL! },
          stamper
        );
        response = await client.getActivity({
          organizationId: response.activity.organizationId,
          activityId: response.activity.id,
        });

        attempts++;
      } else {
        const privateKeys =
          response.activity.result.createPrivateKeysResultV2?.privateKeys;

        // XXX: sorry for the ugly code! We expect a single key / address returned.
        // If we have more than one key / address returned, or none, this would break.
        const address = privateKeys
          ?.map((pk) => pk.addresses?.map((addr) => addr.address).join(""))
          .join("");
        const privateKeyId = privateKeys?.map((pk) => pk.privateKeyId).join("");

        res.status(200).json({
          message: "successfully created key",
          address: address,
          privateKeyId: privateKeyId,
        });
        return;
      }
    }
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: `Something went wrong, caught error: ${e}`,
    });
  }
}
