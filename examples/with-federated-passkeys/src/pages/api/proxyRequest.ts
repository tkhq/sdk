import type { NextApiRequest, NextApiResponse } from "next";
import { SignedRequest } from "@turnkey/http";
import axios from "axios";

type TResponse = {
  message: string;
};

export default async function proxyRequest(
  req: NextApiRequest,
  res: NextApiResponse<TResponse>
) {
  let signedRequest = req.body as SignedRequest;

  try {
    const tkRes = await axios.post(signedRequest.url, signedRequest.body, {
      headers: {
        "X-Stamp-WebAuthn": signedRequest.stamp,
      },
    });

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
