import type { EthereumTransaction, TurnkeySDKClientConfig } from "./__types__/base";
import { TurnkeySDKClientBase } from "./__generated__/sdk-client-base";
import type * as SdkApiTypes from "./__generated__/sdk_api_types";

import { generateRandomBuffer, base64UrlEncode, bytesToHex } from "./utils";
import type { User, SubOrganization, UserSigningSession } from "./models";
import { getWebAuthnAttestation } from "@turnkey/http";
import { StorageKeys, getStorageValue, removeStorageValue, setStorageValue } from "./storage";

import { FeeMarketEIP1559Transaction } from "@ethereumjs/tx";
import elliptic from 'elliptic';

export class TurnkeySDKClient extends TurnkeySDKClientBase {
  constructor(config: TurnkeySDKClientConfig) {
    super(config);
  }

  // RPC URL to Send Transactions?

  // Transaction Helpers
  // UserConfirmation
  signTransactionObject = async (params: { signWith: string, tx: EthereumTransaction }): Promise<SdkApiTypes.TSignTransactionResponse> => {
    const encodedTransaction = FeeMarketEIP1559Transaction.fromTxData(params.tx);
    const formattedEncodedTransaction = bytesToHex(encodedTransaction.getMessageToSign()).slice(2);

    return await this.signTransaction({
      signWith: params.signWith,
      unsignedTransaction: formattedEncodedTransaction,
      type: "TRANSACTION_TYPE_ETHEREUM"
    })
  }

  // Wallet Helpers
  // UserConfirmation
  createWalletWithAccount = async (params: { walletName: string, chain: string; }): Promise<SdkApiTypes.TCreateWalletResponse> => {
    if (params.chain === "ethereum") {
      return await this.createWallet({
        walletName: params.walletName,
        accounts: [{
          curve: "CURVE_SECP256K1",
          pathFormat: "PATH_FORMAT_BIP32",
          path: "m/44'/60'/0'/0/0",
          addressFormat: "ADDRESS_FORMAT_ETHEREUM"
        }]
      })
    } else {
      return await this.createWallet({
        walletName: params.walletName,
        accounts: [{
          curve: "CURVE_SECP256K1",
          pathFormat: "PATH_FORMAT_BIP32",
          path: "m/44'/60'/0'/0/0",
          addressFormat: "ADDRESS_FORMAT_ETHEREUM"
        }]
      })
    }
  }

  // UserConfirmation
  createNextWalletAccount = async (params: { walletId: string }): Promise<SdkApiTypes.TCreateWalletAccountsResponse> => {
    const walletAccounts = await this.getWalletAccounts({ walletId: params.walletId });
    const lastAccount = walletAccounts.accounts[walletAccounts.accounts.length - 1]!;
    const lastAccountPath = lastAccount.path.split("/");
    const lastAccountPathIndex = lastAccountPath[3]!.replace(/[^0-9]/g, '');
    const nextPathIndex = Number(lastAccountPathIndex) + 1;
    lastAccountPath[3] = `${nextPathIndex}'`;
    const nextAccountPath = lastAccountPath.join("/");
    return this.createWalletAccounts({
      walletId: params.walletId,
      accounts: [{
        curve: lastAccount.curve,
        pathFormat: lastAccount.pathFormat,
        addressFormat: lastAccount.addressFormat,
        path: nextAccountPath
      }]
    })
  }

  // User Auth
  // API
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

  // UserConfirmation
  login = async (): Promise<SdkApiTypes.TGetWhoamiResponse> => {
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

  // API
  logoutUser = async (): Promise<boolean> => {
    await removeStorageValue(StorageKeys.CurrentUser);
    await removeStorageValue(StorageKeys.CurrentSubOrganization);
    return true;
  }

  // Storage Values
  // API
  getCurrentUser = async (): Promise<User | undefined> => {
    return await getStorageValue(StorageKeys.CurrentUser);
  }

  // API
  getCurrentSubOrganization = async (): Promise<SubOrganization | undefined> => {
    return await getStorageValue(StorageKeys.CurrentSubOrganization)
  }

  // Session Keys
  // API
  isSigningSessionActive = async (): Promise<boolean> => {
    return false;
  }

  // UserConfirmation
  createSigningSessionKey = async (params: { duration: number }): Promise<SdkApiTypes.TCreateApiKeysResponse> => {
    const currentUser = await this.getCurrentUser();
    const ec = new elliptic.ec("p256");
    const keyPair = ec.genKeyPair();

    const signingSession: UserSigningSession = {
      publicKey: keyPair.getPublic(true, 'hex'),
      privateKey: keyPair.getPrivate('hex'),
      expiration: (Date.now() + params.duration)
    }

    const response = await this.createApiKeys({
      apiKeys: [{
        apiKeyName: "Temporary Signing Session Key",
        publicKey: signingSession.publicKey,
        expirationSeconds: `${params.duration}`
      }],
      userId: currentUser!.userId
    })

    if (response) {
      setStorageValue(StorageKeys.CurrentUserSigningSession, signingSession);
    }

    return response;
  }

}
