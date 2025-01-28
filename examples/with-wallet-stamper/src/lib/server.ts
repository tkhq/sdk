"use server";

import { createActivityPoller, TurnkeyClient } from "@turnkey/http";
import {
  ApiKeyStamper,
  type TApiKeyStamperConfig,
} from "@turnkey/api-key-stamper";

import { env } from "@/env.mjs";

import { Email } from "./turnkey";
import { Attestation, ChainType } from "./types";
import { CURVE_TYPE_ED25519, CURVE_TYPE_SECP256K1 } from "./constants";

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
    throw "Error must provide `apiPublicKey` and `apiPrivateKey` or define `TURNKEY_API_PUBLIC_KEY` and `TURNKEY_API_PRIVATE_KEY` in your .env file";
  }

  return new ApiKeyStamper({
    apiPublicKey,
    apiPrivateKey,
  });
};

export const createUserSubOrg = async ({
  email,
  challenge,
  attestation,
  chainType,
  publicKey,
}: {
  email?: Email;
  challenge?: string;
  attestation?: Attestation;
  chainType: ChainType;
  publicKey?: string | null;
}): Promise<{
  organizationId?: string;
  subOrganizationId?: string;
  walletId?: string;
  address?: string;
}> => {
  const stamper = await createAPIKeyStamper();

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

  const timestampMs = String(Date.now());

  const userName = email?.split("@")[0] || publicKey?.slice(0, 6) || "user";

  const curveType =
    chainType === ChainType.EVM ? CURVE_TYPE_SECP256K1 : CURVE_TYPE_ED25519;

  const authenticators =
    challenge && attestation
      ? [
          {
            authenticatorName: "Passkey",
            challenge,
            attestation,
          },
        ]
      : [];

  const apiKeys = publicKey
    ? [
        {
          apiKeyName: "Public Key",
          publicKey,
          curveType,
        },
      ]
    : [];

  const completedActivity = await activityPoller({
    type: "ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V6",
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
          authenticators,
          apiKeys,
        },
      ],
    },
  }).catch((error) => {
    console.error(error);
  });

  const { subOrganizationId, wallet } =
    completedActivity?.result.createSubOrganizationResultV6 || {};

  const { addresses, walletId } = wallet || {};

  return {
    organizationId,
    subOrganizationId,
    walletId,
    address: addresses?.[0],
  };
};

export const getSubOrgByPublicKey = async (publicKey: string) => {
  const stamper = await createAPIKeyStamper();

  const client = new TurnkeyClient(
    {
      baseUrl: NEXT_PUBLIC_BASE_URL,
    },
    stamper
  );

  const subOrg = await client.getSubOrgIds({
    organizationId: NEXT_PUBLIC_ORGANIZATION_ID,
    filterType: "PUBLIC_KEY",
    filterValue: publicKey,
  });
  return subOrg;
};
