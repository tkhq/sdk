import type { NextApiRequest, NextApiResponse } from "next";
import { FederatedRequest } from "@turnkey/http";
import axios from "axios";

type TResponse = {
  message: string;
};

export default async function proxyRequest(
  req: NextApiRequest,
  res: NextApiResponse<TResponse>
) {
  let federatedRequest = req.body as FederatedRequest;

  try {
    const tkRes = await axios.post(
      federatedRequest.url,
      federatedRequest.body,
      {
        headers: {
          "X-Stamp-WebAuthn": federatedRequest.stamp,
        },
      }
    );

    res.status(200).json({
      message: "Request successfully proxied!",
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: "Something went wrong.",
    });
  }
}
