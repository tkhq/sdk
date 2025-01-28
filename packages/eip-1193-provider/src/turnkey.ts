import type { TurnkeyClient } from "@turnkey/http";
import type { TSignRawPayloadResponse } from "@turnkey/http/src/__generated__/services/coordinator/public/v1/public_api.fetcher";
import type { definitions } from "@turnkey/http/src/__generated__/services/coordinator/public/v1/public_api.types";
import { signatureToHex } from "viem";
import { pad } from "viem/utils";
import { TURNKEY_ERROR_CODE } from "./constants";

export function unwrapActivityResult<
  T extends definitions["v1ActivityResponse"]
>(
  activityResponse: T,
  { errorMessage }: { errorMessage: string }
): T["activity"]["result"] {
  const { activity } = activityResponse;

  switch (activity.status) {
    case "ACTIVITY_STATUS_CONSENSUS_NEEDED": {
      throw "Consensus needed";
    }
    case "ACTIVITY_STATUS_COMPLETED": {
      const result = activity.result;
      if (result === undefined) {
        throw "Activity result is undefined";
      }
      return result;
    }
    default: {
      throw errorMessage;
    }
  }
}

export async function signMessage({
  client,
  message,
  organizationId,
  signWith,
}: {
  client: TurnkeyClient;
  message: `0x${string}`;
  organizationId: string;
  signWith: string;
}): Promise<string> {
  const activityResponse = await client.signRawPayload({
    type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
    organizationId,
    parameters: {
      signWith,
      payload: pad(message),
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NO_OP",
    },
    timestampMs: String(Date.now()), // millisecond timestamp
  });

  const { signRawPayloadResult: signature } =
    unwrapActivityResult<TSignRawPayloadResponse>(activityResponse, {
      errorMessage: "Error signing message",
    });

  if (!signature) {
    // @todo update error message
    throw "Error signing message";
  }

  return signatureToHex({
    r: `0x${signature.r}`,
    s: `0x${signature.s}`,
    v: BigInt(signature.v) + 27n,
  });
}

/**
 * Checks if the error code corresponds to a disconnected state.
 *
 * Determines if provided error code is one of the known
 * error codes that signify a disconnected state, specifically if the wallet
 * or organization was not found.
 *
 * @param {Object} error - The error object containing the error code.
 * @param {number} error.code - The error code to check against known disconnected state codes.
 * @returns {boolean} - Returns true if the error code is for a disconnected state, otherwise false.
 */
export const turnkeyIsDisconnected = (error: { code: number }) => {
  const { WALLET_NOT_FOUND, ORG_NOT_FOUND } = TURNKEY_ERROR_CODE;

  return [WALLET_NOT_FOUND, ORG_NOT_FOUND].includes(error.code);
};
