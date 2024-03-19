import {
  ApiKeyStamper,
  type TApiKeyStamperConfig,
} from '@turnkey/api-key-stamper';
import type { TurnkeyClient } from '@turnkey/http';
import type { TSignRawPayloadResponse } from '@turnkey/http/src/__generated__/services/coordinator/public/v1/public_api.fetcher';
import type { definitions } from '@turnkey/http/src/__generated__/services/coordinator/public/v1/public_api.types';
import { signatureToHex } from 'viem';
import { pad } from 'viem/utils';

export const createAPIKeyStamper = (options?: TApiKeyStamperConfig) => {
  const apiPublicKey =
    options?.apiPublicKey || process.env.TURNKEY_API_PUBLIC_KEY;
  const apiPrivateKey =
    options?.apiPrivateKey || process.env.TURNKEY_API_PRIVATE_KEY;

  if (!(apiPublicKey && apiPrivateKey)) {
    throw 'Error must provide public and private api key or define API_PUBLIC_KEY API_PRIVATE_KEY in your .env file';
  }

  return new ApiKeyStamper({
    apiPublicKey,
    apiPrivateKey,
  });
};

export function unwrapActivityResult<
  T extends definitions['v1ActivityResponse']
>(
  activityResponse: T,
  { errorMessage }: { errorMessage: string }
): T['activity']['result'] {
  const { activity } = activityResponse;

  switch (activity.status) {
    case 'ACTIVITY_STATUS_CONSENSUS_NEEDED': {
      throw 'Consensus needed';
    }
    case 'ACTIVITY_STATUS_COMPLETED': {
      const result = activity.result;
      if (result === undefined) {
        throw 'Activity result is undefined';
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
    type: 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2',
    organizationId,
    parameters: {
      signWith,
      payload: pad(message),
      encoding: 'PAYLOAD_ENCODING_HEXADECIMAL',
      hashFunction: 'HASH_FUNCTION_NO_OP',
    },
    timestampMs: String(Date.now()), // millisecond timestamp
  });

  const { signRawPayloadResult: signature } =
    unwrapActivityResult<TSignRawPayloadResponse>(activityResponse, {
      errorMessage: 'Error signing message',
    });

  if (!signature) {
    // @todo update error message
    throw 'Error signing message';
  }

  return signatureToHex({
    r: `0x${signature.r}`,
    s: `0x${signature.s}`,
    v: BigInt(signature.v) + 27n,
  });
}
