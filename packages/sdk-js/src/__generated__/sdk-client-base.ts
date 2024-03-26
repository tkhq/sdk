/* @generated by codegen. DO NOT EDIT BY HAND */

import { GrpcStatus, TurnkeyRequestError, ActivityResponse, TurnkeySDKClientConfig } from "../__types__/base";

import { VERSION } from "../__generated__/version";

import type * as SdkApiTypes from "./sdk_api_types";

import { StorageKeys, getStorageValue } from "../storage";


export class TurnkeySDKClientBase {
  config: TurnkeySDKClientConfig;

  constructor(config: TurnkeySDKClientConfig) {
    this.config = config;
  }

  async request<TBodyType, TResponseType>(
    url: string,
    body: TBodyType
  ): Promise<TResponseType> {
    const fullUrl = this.config.apiBaseUrl + url;
    const stringifiedBody = JSON.stringify(body);
    const stamp = await this.config.stamper.stamp(stringifiedBody);

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        [stamp.stampHeaderName]: stamp.stampHeaderValue,
        "X-Client-Version": VERSION
      },
      body: stringifiedBody,
      redirect: "follow"
    });

    if (!response.ok) {
      let res: GrpcStatus;
      try {
        res = await response.json();
      } catch (_) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      throw new TurnkeyRequestError(res);
    }

    const data = await response.json();
    return data as TResponseType;
  }

  async command<TBodyType, TResponseType>(
    url: string,
    body: TBodyType
  ): Promise<TResponseType> {
    const POLLING_DURATION = this.config.activityPoller?.duration ?? 1000;
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const initialData = await this.request<TBodyType, TResponseType>(url, body) as ActivityResponse;
    const activityId = initialData["activity"]["id"];
    let activityStatus = initialData["activity"]["status"];

    if (activityStatus !== "ACTIVITY_STATUS_PENDING") {
      return initialData as TResponseType;
      // TODO: return initialData["activity"]["result"][`${methodName}Result`];
    }

    const pollStatus = async (): Promise<TResponseType> => {
      const pollBody = { activityId: activityId };
      const pollData = await this.getActivity(pollBody) as ActivityResponse;
      const activityStatus = pollData["activity"]["status"];

      if (activityStatus === "ACTIVITY_STATUS_PENDING") {
        await delay(POLLING_DURATION);
        return await pollStatus();
      } else {
        return pollData as TResponseType;
        // TODO: return pollData["activity"]["result"][`${methodName}Result`];
      }
    }

    return await pollStatus();
  }

  async activityDecision<TBodyType, TResponseType>(
    url: string,
    body: TBodyType
  ): Promise<TResponseType> {
    const data: TResponseType = await this.request(url, body);
    return data;
    // TODO: return data["activity"]["result"];
  }




	getActivity = async (input: SdkApiTypes.TGetActivityBody, overrideParams?: any): Promise<SdkApiTypes.TGetActivityResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.request("/public/v1/query/get_activity", {
      ...{
        ...input,
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId
      }, ...overrideParams
    });
  }


	getApiKey = async (input: SdkApiTypes.TGetApiKeyBody, overrideParams?: any): Promise<SdkApiTypes.TGetApiKeyResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.request("/public/v1/query/get_api_key", {
      ...{
        ...input,
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId
      }, ...overrideParams
    });
  }


	getApiKeys = async (input: SdkApiTypes.TGetApiKeysBody, overrideParams?: any): Promise<SdkApiTypes.TGetApiKeysResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.request("/public/v1/query/get_api_keys", {
      ...{
        ...input,
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId
      }, ...overrideParams
    });
  }


	getAuthenticator = async (input: SdkApiTypes.TGetAuthenticatorBody, overrideParams?: any): Promise<SdkApiTypes.TGetAuthenticatorResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.request("/public/v1/query/get_authenticator", {
      ...{
        ...input,
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId
      }, ...overrideParams
    });
  }


	getAuthenticators = async (input: SdkApiTypes.TGetAuthenticatorsBody, overrideParams?: any): Promise<SdkApiTypes.TGetAuthenticatorsResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.request("/public/v1/query/get_authenticators", {
      ...{
        ...input,
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId
      }, ...overrideParams
    });
  }


	getOrganization = async (input: SdkApiTypes.TGetOrganizationBody, overrideParams?: any): Promise<SdkApiTypes.TGetOrganizationResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.request("/public/v1/query/get_organization", {
      ...{
        ...input,
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId
      }, ...overrideParams
    });
  }


	getPolicy = async (input: SdkApiTypes.TGetPolicyBody, overrideParams?: any): Promise<SdkApiTypes.TGetPolicyResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.request("/public/v1/query/get_policy", {
      ...{
        ...input,
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId
      }, ...overrideParams
    });
  }


	getPrivateKey = async (input: SdkApiTypes.TGetPrivateKeyBody, overrideParams?: any): Promise<SdkApiTypes.TGetPrivateKeyResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.request("/public/v1/query/get_private_key", {
      ...{
        ...input,
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId
      }, ...overrideParams
    });
  }


	getUser = async (input: SdkApiTypes.TGetUserBody, overrideParams?: any): Promise<SdkApiTypes.TGetUserResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.request("/public/v1/query/get_user", {
      ...{
        ...input,
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId
      }, ...overrideParams
    });
  }


	getWallet = async (input: SdkApiTypes.TGetWalletBody, overrideParams?: any): Promise<SdkApiTypes.TGetWalletResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.request("/public/v1/query/get_wallet", {
      ...{
        ...input,
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId
      }, ...overrideParams
    });
  }


	getActivities = async (input: SdkApiTypes.TGetActivitiesBody, overrideParams?: any): Promise<SdkApiTypes.TGetActivitiesResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.request("/public/v1/query/list_activities", {
      ...{
        ...input,
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId
      }, ...overrideParams
    });
  }


	getPolicies = async (input: SdkApiTypes.TGetPoliciesBody, overrideParams?: any): Promise<SdkApiTypes.TGetPoliciesResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.request("/public/v1/query/list_policies", {
      ...{
        ...input,
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId
      }, ...overrideParams
    });
  }


	listPrivateKeyTags = async (input: SdkApiTypes.TListPrivateKeyTagsBody, overrideParams?: any): Promise<SdkApiTypes.TListPrivateKeyTagsResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.request("/public/v1/query/list_private_key_tags", {
      ...{
        ...input,
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId
      }, ...overrideParams
    });
  }


	getPrivateKeys = async (input: SdkApiTypes.TGetPrivateKeysBody, overrideParams?: any): Promise<SdkApiTypes.TGetPrivateKeysResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.request("/public/v1/query/list_private_keys", {
      ...{
        ...input,
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId
      }, ...overrideParams
    });
  }


	getSubOrgIds = async (input: SdkApiTypes.TGetSubOrgIdsBody, overrideParams?: any): Promise<SdkApiTypes.TGetSubOrgIdsResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.request("/public/v1/query/list_suborgs", {
      ...{
        ...input,
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId
      }, ...overrideParams
    });
  }


	listUserTags = async (input: SdkApiTypes.TListUserTagsBody, overrideParams?: any): Promise<SdkApiTypes.TListUserTagsResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.request("/public/v1/query/list_user_tags", {
      ...{
        ...input,
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId
      }, ...overrideParams
    });
  }


	getUsers = async (input: SdkApiTypes.TGetUsersBody, overrideParams?: any): Promise<SdkApiTypes.TGetUsersResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.request("/public/v1/query/list_users", {
      ...{
        ...input,
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId
      }, ...overrideParams
    });
  }


	getWalletAccounts = async (input: SdkApiTypes.TGetWalletAccountsBody, overrideParams?: any): Promise<SdkApiTypes.TGetWalletAccountsResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.request("/public/v1/query/list_wallet_accounts", {
      ...{
        ...input,
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId
      }, ...overrideParams
    });
  }


	getWallets = async (input: SdkApiTypes.TGetWalletsBody, overrideParams?: any): Promise<SdkApiTypes.TGetWalletsResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.request("/public/v1/query/list_wallets", {
      ...{
        ...input,
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId
      }, ...overrideParams
    });
  }


	getWhoami = async (input: SdkApiTypes.TGetWhoamiBody, overrideParams?: any): Promise<SdkApiTypes.TGetWhoamiResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.request("/public/v1/query/whoami", {
      ...{
        ...input,
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId
      }, ...overrideParams
    });
  }


	approveActivity = async (input: SdkApiTypes.TApproveActivityBody, overrideParams?: any): Promise<SdkApiTypes.TApproveActivityResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.activityDecision("/public/v1/submit/approve_activity",
      {
        ...{
          parameters: {...input},
          organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
          timestampMs: String(Date.now()),
          type: "ACTIVITY_TYPE_APPROVE_ACTIVITY"
        }, ...overrideParams
      });
  }


	createApiKeys = async (input: SdkApiTypes.TCreateApiKeysBody, overrideParams?: any): Promise<SdkApiTypes.TCreateApiKeysResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/create_api_keys", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_CREATE_API_KEYS"
      },
      ...overrideParams
    });
  }


	createApiOnlyUsers = async (input: SdkApiTypes.TCreateApiOnlyUsersBody, overrideParams?: any): Promise<SdkApiTypes.TCreateApiOnlyUsersResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/create_api_only_users", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_CREATE_API_ONLY_USERS"
      },
      ...overrideParams
    });
  }


	createAuthenticators = async (input: SdkApiTypes.TCreateAuthenticatorsBody, overrideParams?: any): Promise<SdkApiTypes.TCreateAuthenticatorsResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/create_authenticators", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_CREATE_AUTHENTICATORS_V2"
      },
      ...overrideParams
    });
  }


	createInvitations = async (input: SdkApiTypes.TCreateInvitationsBody, overrideParams?: any): Promise<SdkApiTypes.TCreateInvitationsResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/create_invitations", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_CREATE_INVITATIONS"
      },
      ...overrideParams
    });
  }


	createPolicy = async (input: SdkApiTypes.TCreatePolicyBody, overrideParams?: any): Promise<SdkApiTypes.TCreatePolicyResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/create_policy", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_CREATE_POLICY_V3"
      },
      ...overrideParams
    });
  }


	createPrivateKeyTag = async (input: SdkApiTypes.TCreatePrivateKeyTagBody, overrideParams?: any): Promise<SdkApiTypes.TCreatePrivateKeyTagResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/create_private_key_tag", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEY_TAG"
      },
      ...overrideParams
    });
  }


	createPrivateKeys = async (input: SdkApiTypes.TCreatePrivateKeysBody, overrideParams?: any): Promise<SdkApiTypes.TCreatePrivateKeysResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/create_private_keys", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2"
      },
      ...overrideParams
    });
  }


	createSubOrganization = async (input: SdkApiTypes.TCreateSubOrganizationBody, overrideParams?: any): Promise<SdkApiTypes.TCreateSubOrganizationResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/create_sub_organization", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V4"
      },
      ...overrideParams
    });
  }


	createUserTag = async (input: SdkApiTypes.TCreateUserTagBody, overrideParams?: any): Promise<SdkApiTypes.TCreateUserTagResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/create_user_tag", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_CREATE_USER_TAG"
      },
      ...overrideParams
    });
  }


	createUsers = async (input: SdkApiTypes.TCreateUsersBody, overrideParams?: any): Promise<SdkApiTypes.TCreateUsersResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/create_users", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_CREATE_USERS_V2"
      },
      ...overrideParams
    });
  }


	createWallet = async (input: SdkApiTypes.TCreateWalletBody, overrideParams?: any): Promise<SdkApiTypes.TCreateWalletResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/create_wallet", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_CREATE_WALLET"
      },
      ...overrideParams
    });
  }


	createWalletAccounts = async (input: SdkApiTypes.TCreateWalletAccountsBody, overrideParams?: any): Promise<SdkApiTypes.TCreateWalletAccountsResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/create_wallet_accounts", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_CREATE_WALLET_ACCOUNTS"
      },
      ...overrideParams
    });
  }


	deleteApiKeys = async (input: SdkApiTypes.TDeleteApiKeysBody, overrideParams?: any): Promise<SdkApiTypes.TDeleteApiKeysResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/delete_api_keys", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_DELETE_API_KEYS"
      },
      ...overrideParams
    });
  }


	deleteAuthenticators = async (input: SdkApiTypes.TDeleteAuthenticatorsBody, overrideParams?: any): Promise<SdkApiTypes.TDeleteAuthenticatorsResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/delete_authenticators", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_DELETE_AUTHENTICATORS"
      },
      ...overrideParams
    });
  }


	deleteInvitation = async (input: SdkApiTypes.TDeleteInvitationBody, overrideParams?: any): Promise<SdkApiTypes.TDeleteInvitationResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/delete_invitation", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_DELETE_INVITATION"
      },
      ...overrideParams
    });
  }


	deletePolicy = async (input: SdkApiTypes.TDeletePolicyBody, overrideParams?: any): Promise<SdkApiTypes.TDeletePolicyResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/delete_policy", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_DELETE_POLICY"
      },
      ...overrideParams
    });
  }


	deletePrivateKeyTags = async (input: SdkApiTypes.TDeletePrivateKeyTagsBody, overrideParams?: any): Promise<SdkApiTypes.TDeletePrivateKeyTagsResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/delete_private_key_tags", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_DELETE_PRIVATE_KEY_TAGS"
      },
      ...overrideParams
    });
  }


	deleteUserTags = async (input: SdkApiTypes.TDeleteUserTagsBody, overrideParams?: any): Promise<SdkApiTypes.TDeleteUserTagsResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/delete_user_tags", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_DELETE_USER_TAGS"
      },
      ...overrideParams
    });
  }


	deleteUsers = async (input: SdkApiTypes.TDeleteUsersBody, overrideParams?: any): Promise<SdkApiTypes.TDeleteUsersResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/delete_users", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_DELETE_USERS"
      },
      ...overrideParams
    });
  }


	emailAuth = async (input: SdkApiTypes.TEmailAuthBody, overrideParams?: any): Promise<SdkApiTypes.TEmailAuthResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/email_auth", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_EMAIL_AUTH"
      },
      ...overrideParams
    });
  }


	exportPrivateKey = async (input: SdkApiTypes.TExportPrivateKeyBody, overrideParams?: any): Promise<SdkApiTypes.TExportPrivateKeyResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/export_private_key", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_EXPORT_PRIVATE_KEY"
      },
      ...overrideParams
    });
  }


	exportWallet = async (input: SdkApiTypes.TExportWalletBody, overrideParams?: any): Promise<SdkApiTypes.TExportWalletResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/export_wallet", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_EXPORT_WALLET"
      },
      ...overrideParams
    });
  }


	exportWalletAccount = async (input: SdkApiTypes.TExportWalletAccountBody, overrideParams?: any): Promise<SdkApiTypes.TExportWalletAccountResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/export_wallet_account", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_EXPORT_WALLET_ACCOUNT"
      },
      ...overrideParams
    });
  }


	importWallet = async (input: SdkApiTypes.TImportWalletBody, overrideParams?: any): Promise<SdkApiTypes.TImportWalletResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/import_wallet", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_IMPORT_WALLET"
      },
      ...overrideParams
    });
  }


	initImportPrivateKey = async (input: SdkApiTypes.TInitImportPrivateKeyBody, overrideParams?: any): Promise<SdkApiTypes.TInitImportPrivateKeyResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/init_import_private_key", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_INIT_IMPORT_PRIVATE_KEY"
      },
      ...overrideParams
    });
  }


	initImportWallet = async (input: SdkApiTypes.TInitImportWalletBody, overrideParams?: any): Promise<SdkApiTypes.TInitImportWalletResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/init_import_wallet", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_INIT_IMPORT_WALLET"
      },
      ...overrideParams
    });
  }


	initUserEmailRecovery = async (input: SdkApiTypes.TInitUserEmailRecoveryBody, overrideParams?: any): Promise<SdkApiTypes.TInitUserEmailRecoveryResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/init_user_email_recovery", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_INIT_USER_EMAIL_RECOVERY"
      },
      ...overrideParams
    });
  }


	recoverUser = async (input: SdkApiTypes.TRecoverUserBody, overrideParams?: any): Promise<SdkApiTypes.TRecoverUserResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/recover_user", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_RECOVER_USER"
      },
      ...overrideParams
    });
  }


	rejectActivity = async (input: SdkApiTypes.TRejectActivityBody, overrideParams?: any): Promise<SdkApiTypes.TRejectActivityResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.activityDecision("/public/v1/submit/reject_activity",
      {
        ...{
          parameters: {...input},
          organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
          timestampMs: String(Date.now()),
          type: "ACTIVITY_TYPE_REJECT_ACTIVITY"
        }, ...overrideParams
      });
  }


	removeOrganizationFeature = async (input: SdkApiTypes.TRemoveOrganizationFeatureBody, overrideParams?: any): Promise<SdkApiTypes.TRemoveOrganizationFeatureResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/remove_organization_feature", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_REMOVE_ORGANIZATION_FEATURE"
      },
      ...overrideParams
    });
  }


	setOrganizationFeature = async (input: SdkApiTypes.TSetOrganizationFeatureBody, overrideParams?: any): Promise<SdkApiTypes.TSetOrganizationFeatureResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/set_organization_feature", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_SET_ORGANIZATION_FEATURE"
      },
      ...overrideParams
    });
  }


	signRawPayload = async (input: SdkApiTypes.TSignRawPayloadBody, overrideParams?: any): Promise<SdkApiTypes.TSignRawPayloadResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/sign_raw_payload", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2"
      },
      ...overrideParams
    });
  }


	signTransaction = async (input: SdkApiTypes.TSignTransactionBody, overrideParams?: any): Promise<SdkApiTypes.TSignTransactionResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/sign_transaction", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2"
      },
      ...overrideParams
    });
  }


	updatePolicy = async (input: SdkApiTypes.TUpdatePolicyBody, overrideParams?: any): Promise<SdkApiTypes.TUpdatePolicyResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/update_policy", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_UPDATE_POLICY"
      },
      ...overrideParams
    });
  }


	updatePrivateKeyTag = async (input: SdkApiTypes.TUpdatePrivateKeyTagBody, overrideParams?: any): Promise<SdkApiTypes.TUpdatePrivateKeyTagResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/update_private_key_tag", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_UPDATE_PRIVATE_KEY_TAG"
      },
      ...overrideParams
    });
  }


	updateRootQuorum = async (input: SdkApiTypes.TUpdateRootQuorumBody, overrideParams?: any): Promise<SdkApiTypes.TUpdateRootQuorumResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/update_root_quorum", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_UPDATE_ROOT_QUORUM"
      },
      ...overrideParams
    });
  }


	updateUser = async (input: SdkApiTypes.TUpdateUserBody, overrideParams?: any): Promise<SdkApiTypes.TUpdateUserResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/update_user", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_UPDATE_USER"
      },
      ...overrideParams
    });
  }


	updateUserTag = async (input: SdkApiTypes.TUpdateUserTagBody, overrideParams?: any): Promise<SdkApiTypes.TUpdateUserTagResponse> => {
    const currentSubOrganization = this.config.environment === "browser" ? await getStorageValue(StorageKeys.CurrentSubOrganization) : undefined;
    return this.command("/public/v1/submit/update_user_tag", {
      ...{
        parameters: {...input},
        organizationId: currentSubOrganization?.organizationId ?? this.config.organizationId,
        timestampMs: String(Date.now()),
        type: "ACTIVITY_TYPE_UPDATE_USER_TAG"
      },
      ...overrideParams
    });
  }

}
