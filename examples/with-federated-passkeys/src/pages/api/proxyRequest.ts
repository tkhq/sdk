import type { NextApiRequest, NextApiResponse } from "next";
import { TSignedRequest } from "@turnkey/http";
import axios from "axios";

type TResponse = {
  message: string;
  activityId?: string;
};

export default async function proxyRequest(
  req: NextApiRequest,
  res: NextApiResponse<TResponse>
) {
  let signedRequest = req.body as TSignedRequest;

  try {
    const tkRes = await axios.post(signedRequest.url, signedRequest.body, {
      headers: {
        [signedRequest.stamp.stampHeaderName]:
          signedRequest.stamp.stampHeaderValue,
      },
    });

    res.status(200).json({
      message: "Request successfully proxied!",
      activityId: tkRes.data.activityId,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: "Something went wrong.",
    });
  }
}
