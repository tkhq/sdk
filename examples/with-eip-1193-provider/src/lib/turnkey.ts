"use server";

import {
  ApiKeyStamper,
  type TApiKeyStamperConfig,
} from "@turnkey/api-key-stamper";
import { TurnkeyClient, createActivityPoller } from "@turnkey/http";
import type { Attestation, Email, PasskeyRegistrationResult } from "./types";

import { ETHEREUM_WALLET_DEFAULT_PATH } from "./constants";
import type { UUID } from "crypto";
import type { Address } from "viem";

const {
  TURNKEY_API_PUBLIC_KEY,
  TURNKEY_API_PRIVATE_KEY,
  NEXT_PUBLIC_ORGANIZATION_ID,
  NEXT_PUBLIC_BASE_URL,
} = process.env;

export const createAPIKeyStamper = (options?: TApiKeyStamperConfig) => {
  const apiPublicKey = options?.apiPublicKey || TURNKEY_API_PUBLIC_KEY;
  const apiPrivateKey = options?.apiPrivateKey || TURNKEY_API_PRIVATE_KEY;

  if (!(apiPublicKey && apiPrivateKey)) {
    throw "Error must provide public and private api key or define API_PUBLIC_KEY API_PRIVATE_KEY in your .env file";
  }

  return new ApiKeyStamper({
    apiPublicKey,
    apiPrivateKey,
  });
};

export const createUserSubOrg = async (
  turnkeyClient: TurnkeyClient,
  {
    email,
    // if challenge and attestation are provided we are creating a non-custodial wallet using the users provided authenticator
    challenge,
    attestation,
  }: {
    email: Email;
    challenge: string;
    attestation: Attestation;
  }
) => {
  const activityPoller = createActivityPoller({
    client: turnkeyClient,
    requestFn: turnkeyClient.createSubOrganization,
  });

  const organizationId = NEXT_PUBLIC_ORGANIZATION_ID!;
  const timestampMs = String(Date.now());

  const rootUsersOptions =
    challenge && attestation
      ? {
          authenticators: [
            {
              authenticatorName: "Passkey",
              challenge,
              attestation,
            },
          ],
          apiKeys: [],
        }
      : {
          authenticators: [],
          apiKeys: [
            {
              apiKeyName: "turnkey-demo",
              publicKey: TURNKEY_API_PUBLIC_KEY!,
            },
          ],
        };
  const userName = email.split("@")[0];
  const completedActivity = await activityPoller({
    type: "ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V4",
    timestampMs,
    organizationId,
    parameters: {
      subOrganizationName: `Sub Org - ${email}`,
      rootQuorumThreshold: 1,
      rootUsers: [
        {
          userName,
          userEmail: email,
          ...rootUsersOptions,
        },
      ],
      wallet: {
        walletName: `User ${userName} wallet`,
        accounts: [
          {
            curve: "CURVE_SECP256K1",
            pathFormat: "PATH_FORMAT_BIP32",
            path: ETHEREUM_WALLET_DEFAULT_PATH,
            addressFormat: "ADDRESS_FORMAT_ETHEREUM",
          },
        ],
      },
    },
  }).catch((error) => {
    console.error(error);
  });

  return completedActivity?.result.createSubOrganizationResultV4;
};

export const signUp = async (
  email: Email,
  passKeyRegistrationResult: PasskeyRegistrationResult
) => {
  const client = new TurnkeyClient(
    { baseUrl: NEXT_PUBLIC_BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: TURNKEY_API_PUBLIC_KEY!,
      apiPrivateKey: TURNKEY_API_PRIVATE_KEY!,
    })
  );

  // Create a new user sub org with email
  const { subOrganizationId, wallet } =
    (await createUserSubOrg(client, { email, ...passKeyRegistrationResult })) ??
    {};

  return {
    subOrganizationId: subOrganizationId as UUID,
    walletId: wallet?.walletId as UUID,
    accounts: wallet?.addresses as Address[],
  };
};
