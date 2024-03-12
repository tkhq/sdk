import type { TurnkeySDKClientConfig } from "./__types__/base";
import { TurnkeySDKClientBase } from "./__generated__/sdk-client-base";
import type * as SdkApiTypes from "./__generated__/sdk_api_types";

import { generateRandomBuffer, base64UrlEncode } from "./utils";
import type { User } from "./models";
import { getWebAuthnAttestation } from "@turnkey/http";

export class TurnkeySDKClient extends TurnkeySDKClientBase {
  constructor(config: TurnkeySDKClientConfig) {
    super(config);
  }

  // Users
  // {email: string}
  createUserWithPasskey = async (email: string): Promise<SdkApiTypes.TCreateSubOrganizationResponse> => {
    const challenge = generateRandomBuffer();
    const authenticatorUserId = generateRandomBuffer();

    const attestation = await getWebAuthnAttestation({
      publicKey: {
        rp: {
          id: "localhost",
          name: "Demo Passkey Wallet"
        },
        challenge,
        pubKeyCredParams: [
          {
            type: "public-key",
            alg: -7
          }
        ],
        user: {
          id: authenticatorUserId,
          name: email,
          displayName: email
        },
        authenticatorSelection: {
          requireResidentKey: true,
          residentKey: "required",
          userVerification: "preferred"
        }
      }
    })

    const subOrganizationResult = this.createSubOrganization({
      subOrganizationName: email,
      rootUsers: [{
        userName: email,
        apiKeys: [],
        authenticators: [{
          authenticatorName: "test-passkey-1",
          challenge: base64UrlEncode(challenge),
          attestation: attestation
        }]
      }],
      rootQuorumThreshold: 1,
      wallet: {
        walletName: "Test Wallet 1",
        accounts: [
          {
            curve: "CURVE_SECP256K1",
            pathFormat: "PATH_FORMAT_BIP32",
            path: "m/44'/60'/0'/0/0",
            addressFormat: "ADDRESS_FORMAT_ETHEREUM"
          }
        ]
      }
    })

    return subOrganizationResult;
  }

  loginUserWithPasskey = async (userId: string): Promise<User> => {
    // var signedRequest;
    // try {
    //   signedRequest = await this.stampGetWhoamiI
    // }

    return {
      userId: userId
    }
  }

}
