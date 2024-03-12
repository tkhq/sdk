import type { TurnkeySDKClientConfig } from "./__types__/base";
import { TurnkeySDKClientBase } from "./__generated__/sdk-client-base";
import type * as SdkApiTypes from "./__generated__/sdk_api_types";

import { generateRandomBuffer, base64UrlEncode } from "./utils";
import type { User, SubOrganization } from "./models";
import { getWebAuthnAttestation } from "@turnkey/http";
import { StorageKeys, getStorageValue, removeStorageValue, setStorageValue } from "./storage";

export class TurnkeySDKClient extends TurnkeySDKClientBase {
  constructor(config: TurnkeySDKClientConfig) {
    super(config);
  }

  createUserAccount = async (email: string): Promise<SdkApiTypes.TCreateSubOrganizationResponse> => {
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

  loginUser = async (): Promise<SdkApiTypes.TGetWhoamiResponse> => {
    const whoamiResult = await this.getWhoami({});
    const currentUser: User = {
      userId: whoamiResult.userId,
      username: whoamiResult.username
    }
    const currentSubOrganization: SubOrganization = {
      organizationId: whoamiResult.organizationId,
      organizationName: whoamiResult.organizationName
    }
    await setStorageValue(StorageKeys.CurrentUser, currentUser);
    await setStorageValue(StorageKeys.CurrentSubOrganization, currentSubOrganization);
    return whoamiResult;
  }

  logoutUser = async (): Promise<boolean> => {
    await removeStorageValue(StorageKeys.CurrentUser);
    await removeStorageValue(StorageKeys.CurrentSubOrganization);
    return true;
  }

  // Storage Values
  getCurrentUser = async (): Promise<User | undefined> => {
    return await getStorageValue(StorageKeys.CurrentUser);
  }

  getCurrentSubOrganization = async (): Promise<SubOrganization | undefined> => {
    return await getStorageValue(StorageKeys.CurrentSubOrganization)
  }

  // Test Get User WalletsX
  getWalletsX = async (): Promise<SdkApiTypes.TGetWalletsResponse> => {
    const currentSubOrganization = await getStorageValue(StorageKeys.CurrentSubOrganization);
    if (currentSubOrganization) {
      return await this.getWallets({}, {organizationId: currentSubOrganization.organizationId});
    } else {
      return await this.getWallets({});
    }
  }

}
