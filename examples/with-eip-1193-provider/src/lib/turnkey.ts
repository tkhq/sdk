"use server";

import {
  Turnkey as TurnkeyServerSDK,
  TurnkeyApiTypes,
  TurnkeyServerClient,
} from "@turnkey/sdk-server";
import { type TApiKeyStamperConfig } from "@turnkey/api-key-stamper";
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

// Note: this is not currently in use
export const createAPIKeyStamper = async (options?: TApiKeyStamperConfig) => {
  const apiPublicKey = options?.apiPublicKey || TURNKEY_API_PUBLIC_KEY;
  const apiPrivateKey = options?.apiPrivateKey || TURNKEY_API_PRIVATE_KEY;

  if (!(apiPublicKey && apiPrivateKey)) {
    throw "Error must provide public and private api key or define API_PUBLIC_KEY API_PRIVATE_KEY in your .env file";
  }

  return new TurnkeyServerSDK({
    apiBaseUrl: NEXT_PUBLIC_BASE_URL!,
    defaultOrganizationId: NEXT_PUBLIC_ORGANIZATION_ID!,
    apiPublicKey,
    apiPrivateKey,
  });
};

export const createUserSubOrg = async (
  turnkeyClient: TurnkeyServerClient,
  {
    email,
    // if challenge and attestation are provided we are creating a non-custodial wallet using the user's provided authenticator
    challenge,
    attestation,
  }: {
    email: Email;
    challenge: string;
    attestation: Attestation;
  }
) => {
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
          oauthProviders: [],
        }
      : {
          authenticators: [],
          apiKeys: [
            {
              apiKeyName: "turnkey-demo",
              publicKey: TURNKEY_API_PUBLIC_KEY!,
              curveType:
                "API_KEY_CURVE_P256" as TurnkeyApiTypes["v1ApiKeyCurve"],
            },
          ],
          oauthProviders: [],
        };
  const userName = email.split("@")[0];
  const createSubOrganizationResult = await turnkeyClient
    .createSubOrganization({
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
    })
    .catch((error: any) => {
      console.error(error);
    });

  return createSubOrganizationResult;
};

export const signUp = async (
  email: Email,
  passKeyRegistrationResult: PasskeyRegistrationResult
) => {
  const client = new TurnkeyServerSDK({
    apiBaseUrl: NEXT_PUBLIC_BASE_URL!,
    defaultOrganizationId: NEXT_PUBLIC_ORGANIZATION_ID!,
    apiPublicKey: TURNKEY_API_PUBLIC_KEY!,
    apiPrivateKey: TURNKEY_API_PRIVATE_KEY!,
  });

  // Create a new user sub org with email
  const { subOrganizationId, wallet } =
    (await createUserSubOrg(client.apiClient(), {
      email,
      ...passKeyRegistrationResult,
    })) ?? {};

  return {
    subOrganizationId: subOrganizationId as UUID,
    walletId: wallet?.walletId as UUID,
    accounts: wallet?.addresses as Address[],
  };
};
