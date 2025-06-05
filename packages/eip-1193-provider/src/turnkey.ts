import { TurnkeyClient, isHttpClient } from "@turnkey/http";
import type { TurnkeyBrowserClient } from "@turnkey/sdk-browser";
import type {
  TSignRawPayloadResponse,
  TSignTransactionResponse,
} from "@turnkey/http/src/__generated__/services/coordinator/public/v1/public_api.fetcher";
import type { definitions } from "@turnkey/http/src/__generated__/services/coordinator/public/v1/public_api.types";

import { signatureToHex } from "viem";
import { pad } from "viem/utils";

import { TURNKEY_ERROR_CODE } from "./constants";

export function unwrapActivityResult<
  T extends definitions["v1ActivityResponse"],
>(
  activityResponse: T,
  { errorMessage }: { errorMessage: string },
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
  client: TurnkeyClient | TurnkeyBrowserClient;
  message: `0x${string}`;
  organizationId: string;
  signWith: string;
}): Promise<string> {
  let activityResponse;

  if (isHttpClient(client)) {
    activityResponse = await client.signRawPayload({
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
  } else {
    activityResponse = await client.signRawPayload({
      signWith,
      payload: message,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NO_OP",
    });
  }

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

export async function signTransaction({
  client,
  unsignedTransaction,
  organizationId,
  signWith,
}: {
  client: TurnkeyClient | TurnkeyBrowserClient;
  unsignedTransaction: string;
  organizationId: string;
  signWith: string;
}): Promise<string> {
  let activityResponse;

  if (isHttpClient(client)) {
    activityResponse = await client.signTransaction({
      type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
      organizationId: organizationId,
      parameters: {
        signWith,
        type: "TRANSACTION_TYPE_ETHEREUM",
        unsignedTransaction: unsignedTransaction,
      },
      timestampMs: String(Date.now()), // millisecond timestamp
    });
  } else {
    activityResponse = await client.signTransaction({
      signWith,
      type: "TRANSACTION_TYPE_ETHEREUM",
      unsignedTransaction: unsignedTransaction,
    });
  }

  const { signTransactionResult } =
    unwrapActivityResult<TSignTransactionResponse>(activityResponse, {
      errorMessage: "Error signing transaction",
    });

  if (!signTransactionResult) {
    // @todo update error handling (e.g. consensus)
    throw "Error signing transaction";
  }

  return signTransactionResult.signedTransaction;
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
