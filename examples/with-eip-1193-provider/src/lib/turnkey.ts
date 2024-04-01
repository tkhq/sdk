"use server";

import {
  ApiKeyStamper,
  type TApiKeyStamperConfig,
} from "@turnkey/api-key-stamper";
import { TurnkeyClient, createActivityPoller } from "@turnkey/http";
import { Attestation, Email, PassKeyRegistrationResult } from "./types";

import { generateRandomBuffer, base64UrlEncode } from "./utils";
import {
  ETHEREUM_WALLET_DEFAULT_PATH,
  PUBKEY_CRED_TYPE,
  ALG_ES256,
} from "./constants";
import { UUID } from "crypto";
import { Address } from "viem";

const {
  TURNKEY_API_PUBLIC_KEY,
  TURNKEY_API_PRIVATE_KEY,
  NEXT_PUBLIC_ORGANIZATION_ID,
  NEXT_PUBLIC_TURNKEY_RPID,
} = process.env;

export const registerPassKey = async (
  email: Email
): Promise<PassKeyRegistrationResult> => {
  if (!NEXT_PUBLIC_TURNKEY_RPID) {
    throw "Error must define NEXT_PUBLIC_TURNKEY_RPID in your .env file";
  }

  // @todo - Add error handling
  const { getWebAuthnAttestation } = await import("@turnkey/http");
  const challenge = generateRandomBuffer();
  const authenticatorUserId = generateRandomBuffer();
  const user = email.split("@")[0];
  // An example of possible options can be found here:
  // https://www.w3.org/TR/webauthn-2/#sctn-sample-registration
  const attestation = await getWebAuthnAttestation({
    publicKey: {
      rp: {
        id: NEXT_PUBLIC_TURNKEY_RPID,
        name: "Tunkey Demo Wallet",
      },
      challenge,
      pubKeyCredParams: [
        {
          type: PUBKEY_CRED_TYPE,
          alg: ALG_ES256,
        },
      ],
      user: {
        id: authenticatorUserId,
        name: user,
        displayName: user,
      },
      authenticatorSelection: {
        requireResidentKey: true,
        residentKey: "required",
        userVerification: "preferred",
      },
    },
  });

  return { challenge: base64UrlEncode(challenge), attestation };
};

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
    // if challenge and attestation are provided we are creating a custodial wallet using the users provided authenticator
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
              publicKey: TURNKEY_API_PUBLIC_KEY ?? "",
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
    console.log({ error, ...error });
  });

  return completedActivity?.result.createSubOrganizationResultV4;
};

export const signUp = async (email: Email) => {
  const passKeyRegistrationResult = await registerPassKey(email);

  const client = new TurnkeyClient(
    { baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? "" },
    createAPIKeyStamper()
  );

  // Create a new user sub org with email
  const { subOrganizationId, wallet } =
    (await createUserSubOrg(client, { email, ...passKeyRegistrationResult })) ??
    {};

  return {
    subOrganizationId: subOrganizationId as UUID,
    walletId: wallet?.walletId as UUID,
  };
};
