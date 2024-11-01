import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeyClient, type TSignedRequest } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { forwardRequestToTurnkey } from "../utils";

// Function to generate requests array
const generateStampedRequests = async (
  turnkeyClient: TurnkeyClient,
  count: number
) => {
  // Create an array of numbers from 1 to count
  const requests = Array.from({ length: count }, (_, index) => {
    const envVar = `SIGN_WITH_${(index % 3) + 1}`;

    return turnkeyClient.stampSignRawPayload({
      type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
      timestampMs: String(Date.now()),
      organizationId: process.env.ORGANIZATION_ID!,
      parameters: {
        signWith: process.env[envVar]!,
        payload: "hello tkhq",
        hashFunction: "HASH_FUNCTION_KECCAK256",
        encoding: "PAYLOAD_ENCODING_TEXT_UTF8",
      },
    });
  });

  // Execute all requests
  const stampedRequests = await Promise.allSettled(requests);
  return stampedRequests;
};

const checkUniqueStamps = (stampedRequests: TSignedRequest[]): boolean => {
  interface StampMap {
    [key: string]: boolean;
  }

  const uniques: StampMap = {};

  for (let i = 0; i < stampedRequests.length; i++) {
    const currentStampedRequest = stampedRequests[i];
    if (uniques[currentStampedRequest!.stamp.stampHeaderValue]) {
      return false;
    }

    uniques[currentStampedRequest!.stamp.stampHeaderValue] = true;
  }

  return true;
};

async function main() {
  // Initialize a Turnkey client
  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    })
  );

  const stampedRequests = await generateStampedRequests(turnkeyClient, 100);

  const successfulRequests = stampedRequests
    .filter(
      (result): result is PromiseFulfilledResult<TSignedRequest> =>
        result.status === "fulfilled"
    )
    .map((result) => result.value);

  console.log("stamped requests", successfulRequests);

  const allUnique = checkUniqueStamps(successfulRequests);

  console.log("unique stamps?", allUnique);

  // optionally forward to Turnkey
  //   const response = await forwardRequestToTurnkey(stampedRequest);
  //   const parsedResponse = await response.json();
  //   console.log("Successfully signed raw payload:", parsedResponse);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
