'use server';

import { createActivityPoller, TurnkeyClient } from '@turnkey/http';
import {
  ApiKeyStamper,
  type TApiKeyStamperConfig,
} from '@turnkey/api-key-stamper';

import { env } from '@/env.mjs';

import { Email } from './turnkey';
import { Attestation, ChainType } from './types';
import { ACCOUNT_CONFIG_EVM, ACCOUNT_CONFIG_SOLANA } from './constants';

const {
  TURNKEY_API_PUBLIC_KEY,
  TURNKEY_API_PRIVATE_KEY,
  NEXT_PUBLIC_ORGANIZATION_ID,
  NEXT_PUBLIC_BASE_URL,
} = env;

export const createAPIKeyStamper = (options?: TApiKeyStamperConfig) => {
  const apiPublicKey = options?.apiPublicKey || TURNKEY_API_PUBLIC_KEY;
  const apiPrivateKey = options?.apiPrivateKey || TURNKEY_API_PRIVATE_KEY;

  if (!(apiPublicKey && apiPrivateKey)) {
    throw 'Error must provide `apiPublicKey` and `apiPrivateKey` or define `TURNKEY_API_PUBLIC_KEY` and `TURNKEY_API_PRIVATE_KEY` in your .env file';
  }

  return new ApiKeyStamper({
    apiPublicKey,
    apiPrivateKey,
  });
};

export const createServerClient = () => {
  return new TurnkeyClient(
    {
      baseUrl: NEXT_PUBLIC_BASE_URL,
    },
    createAPIKeyStamper()
  );
};

export const createUserSubOrg = async ({
  email,
  challenge,
  attestation,
  chainType,
}: {
  email: Email;
  challenge: string;
  attestation: Attestation;
  chainType: ChainType;
}): Promise<{
  organizationId?: string;
  subOrganizationId?: string;
  walletId?: string;
  address?: string;
}> => {
  const stamper = await createAPIKeyStamper();
  console.log({ NEXT_PUBLIC_BASE_URL });
  const client = new TurnkeyClient(
    {
      baseUrl: NEXT_PUBLIC_BASE_URL,
    },
    stamper
  );

  const activityPoller = createActivityPoller({
    client,
    requestFn: client.createSubOrganization,
  });

  const organizationId = NEXT_PUBLIC_ORGANIZATION_ID;
  console.log({ organizationId });
  const timestampMs = String(Date.now());

  const userName = email.split('@')[0];

  const accountConfig =
    chainType === ChainType.EVM ? ACCOUNT_CONFIG_EVM : ACCOUNT_CONFIG_SOLANA;

  const completedActivity = await activityPoller({
    type: 'ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V5',
    timestampMs,
    organizationId,
    parameters: {
      subOrganizationName: `Sub Org - ${email}`,
      rootQuorumThreshold: 1,
      rootUsers: [
        {
          userName,
          userEmail: email,
          oauthProviders: [],
          authenticators: [
            {
              authenticatorName: 'Passkey',
              challenge,
              attestation,
            },
          ],
          apiKeys: [],
        },
      ],
      wallet: {
        walletName: `User ${userName} wallet`,
        accounts: [accountConfig],
      },
    },
  }).catch((error) => {
    console.error(error);
  });

  const { subOrganizationId, wallet } =
    completedActivity?.result.createSubOrganizationResultV5 || {};
  const { addresses, walletId } = wallet || {};
  console.log({
    organizationId,
    subOrganizationId,
    walletId,
    address: addresses?.[0],
  });
  return {
    organizationId,
    subOrganizationId,
    walletId,
    address: addresses?.[0],
  };
};
