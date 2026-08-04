import {
  CreateOauthProvidersRequest,
  CreateOauthProvidersResponse,
  OauthLoginRequest,
  OauthLoginResponse,
  OtpLoginRequest,
  OtpLoginResponse,
  CreateSuborgRequest,
  CreateSuborgResponse,
  FilterType,
  GetOrCreateSuborgRequest,
  GetOrCreateSuborgResponse,
  GetSuborgsRequest,
  GetSuborgsResponse,
  GetUsersRequest,
  GetUsersResponse,
  InitEmailAuthRequest,
  SendOtpRequest,
  SendOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from "./__types__/base";
import { TurnkeyServerSDK } from "./sdk-client";
import {
  DEFAULT_ETHEREUM_ACCOUNTS,
  DEFAULT_SOLANA_ACCOUNTS,
} from "./turnkey-helpers";
import { WalletType } from "@turnkey/wallet-stamper";

/**
 * Reads a required server-side environment variable, supporting a deprecated
 * fallback name for backward compatibility.
 *
 * These values are consumed exclusively on the server (they include the API
 * private key), so they must NOT use the `NEXT_PUBLIC_` prefix, which marks a
 * value for inlining into the client bundle. The `NEXT_PUBLIC_*` names are
 * accepted only as a deprecated fallback and will be removed in a future
 * release.
 */
function requireServerEnv(name: string, deprecatedName?: string): string {
  const value =
    process.env[name] ??
    (deprecatedName ? process.env[deprecatedName] : undefined);
  if (!value) {
    throw new Error(
      `Missing required Turnkey environment variable: ${name}. ` +
        `Set it in your server environment.`,
    );
  }
  return value;
}

let _turnkeyClient: TurnkeyServerSDK | undefined;

/**
 * Lazily constructs (and memoizes) the server SDK client from environment
 * variables. Initializing lazily means importing an individual server action
 * does not require every variable to be present at module-load time, and a
 * missing variable surfaces as a clear error at call time rather than a cryptic
 * crash on import.
 */
function getTurnkeyClient(): TurnkeyServerSDK {
  if (!_turnkeyClient) {
    _turnkeyClient = new TurnkeyServerSDK({
      apiBaseUrl: requireServerEnv("TURNKEY_BASE_URL", "NEXT_PUBLIC_BASE_URL"),
      defaultOrganizationId: requireServerEnv(
        "TURNKEY_ORGANIZATION_ID",
        "NEXT_PUBLIC_ORGANIZATION_ID",
      ),
      apiPrivateKey: requireServerEnv("TURNKEY_API_PRIVATE_KEY"),
      apiPublicKey: requireServerEnv("TURNKEY_API_PUBLIC_KEY"),
    });
  }
  return _turnkeyClient;
}

export async function sendCredential(
  request: InitEmailAuthRequest,
): Promise<void> {
  try {
    if (!request.emailCustomization?.appName) {
      throw new Error("appName is required in emailCustomization");
    }

    const emailCustomization = {
      ...request.emailCustomization,
      appName: request.emailCustomization.appName,
    };

    const response = await getTurnkeyClient().apiClient().emailAuth({
      email: request.email,
      targetPublicKey: request.targetPublicKey,
      organizationId: request.suborgID,
      emailCustomization,
      ...(request.apiKeyName && { apiKeyName: request.apiKeyName }),
      ...(request.sessionLengthSeconds !== undefined && {
        expirationSeconds: request.sessionLengthSeconds.toString(),
      }),
      ...(request.invalidateExisting && {
        invalidateExisting: request.invalidateExisting,
      }),
      ...(request.sendFromEmailAddress && {
        sendFromEmailAddress: request.sendFromEmailAddress,
      }),
    });
    if (!response.userId) {
      throw new Error("Expected a non-null userId.");
    }
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function sendOtp(
  request: SendOtpRequest,
): Promise<SendOtpResponse | undefined> {
  try {
    const response = await getTurnkeyClient().apiClient().initOtp({
      contact: request.contact,
      otpType: request.otpType,
      appName: request.appName,
      ...(request.emailCustomization && {
        emailCustomization: request.emailCustomization,
      }),
      ...(request.sendFromEmailAddress && {
        sendFromEmailAddress: request.sendFromEmailAddress,
      }),
      ...(request.sendFromEmailSenderName && {
        sendFromEmailSenderName: request.sendFromEmailSenderName,
      }),
      ...(request.userIdentifier && { userIdentifier: request.userIdentifier }),
      ...(request.customSmsMessage && {
        smsCustomization: { template: request.customSmsMessage },
      }),
      ...(request.otpLength && {
        otpLength: request.otpLength,
      }),
      alphanumeric: request.alphanumeric ?? true,
    });
    if (!response.otpId) {
      throw new Error("Expected a non-null otpId.");
    }
    return response;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function verifyOtp(
  request: VerifyOtpRequest,
): Promise<VerifyOtpResponse | undefined> {
  try {
    const response = await getTurnkeyClient().apiClient().verifyOtp({
      otpId: request.otpId,
      encryptedOtpBundle: request.encryptedOtpBundle,
      ...(request.sessionLengthSeconds !== undefined && {
        expirationSeconds: request.sessionLengthSeconds.toString(),
      }),
    });

    const { verificationToken } = response;
    if (!verificationToken) {
      throw new Error("Expected a non-null value for verificationToken");
    }
    return response;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function otpLogin(
  request: OtpLoginRequest,
): Promise<OtpLoginResponse | undefined> {
  try {
    const {
      suborgID,
      verificationToken,
      clientSignature,
      publicKey,
      sessionLengthSeconds,
    } = request;

    const response = await getTurnkeyClient().apiClient().otpLogin({
      organizationId: suborgID,
      verificationToken,
      clientSignature: clientSignature,
      publicKey: publicKey,
      ...(sessionLengthSeconds !== undefined && {
        expirationSeconds: sessionLengthSeconds.toString(),
      }),
    });
    const { session } = response;
    if (!session) {
      throw new Error("Expected a non-null value for session");
    }
    return response;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function oauthLogin(
  request: OauthLoginRequest,
): Promise<OauthLoginResponse | undefined> {
  try {
    const response = await getTurnkeyClient().apiClient().oauthLogin({
      organizationId: request.suborgID,
      oidcToken: request.oidcToken,
      publicKey: request.publicKey,
      ...(request.sessionLengthSeconds !== undefined && {
        expirationSeconds: request.sessionLengthSeconds.toString(),
      }),
    });

    const { session } = response;
    if (!session) {
      throw new Error("Expected a non-null value for session");
    }
    return response;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function createOauthProviders(
  request: CreateOauthProvidersRequest,
): Promise<CreateOauthProvidersResponse | undefined> {
  // Create Oauth Providers can be called by the parent targeting the suborg only when the following cases are true:
  // 1. the oAuth issuer is Google,
  // 2. the oAuth issuer has verified the email in the token
  // 3. the email in the token matches the email that the user has already has logged in with
  try {
    const response = await getTurnkeyClient().apiClient().createOauthProviders({
      organizationId: request.organizationId,
      userId: request.userId,
      oauthProviders: request.oauthProviders,
    });

    if (!response) {
      throw new Error("Expected a non-null response.");
    }
    return response;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function getUsers(
  request: GetUsersRequest,
): Promise<GetUsersResponse | undefined> {
  try {
    const response = await getTurnkeyClient().apiClient().getUsers({
      organizationId: request.organizationId,
    });

    if (!response || !response.users) {
      throw new Error("Expected a non-null response with userIds.");
    }
    return { users: response.users };
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function getSuborgs(
  request: GetSuborgsRequest,
): Promise<GetSuborgsResponse> {
  const response = await getTurnkeyClient().apiClient().getSubOrgIds({
    organizationId: getTurnkeyClient().config.defaultOrganizationId,
    filterType: request.filterType,
    filterValue: request.filterValue,
  });

  if (!response || !response?.organizationIds) {
    throw new Error("Expected a non-null response.");
  }

  return { organizationIds: response.organizationIds };
}

export async function getVerifiedSuborgs(
  request: GetSuborgsRequest,
): Promise<GetSuborgsResponse> {
  const response = await getTurnkeyClient().apiClient().getVerifiedSubOrgIds({
    organizationId: getTurnkeyClient().config.defaultOrganizationId,
    filterType: request.filterType,
    filterValue: request.filterValue,
  });

  if (!response || !response?.organizationIds) {
    throw new Error("Expected a non-null response.");
  }

  return { organizationIds: response.organizationIds };
}

export async function createSuborg(
  request: CreateSuborgRequest,
): Promise<CreateSuborgResponse | undefined> {
  try {
    const response = await getTurnkeyClient().apiClient().createSubOrganization({
      subOrganizationName: `suborg-${String(Date.now())}`,
      rootQuorumThreshold: 1,
      rootUsers: [
        {
          userName: request.email ?? `suborg-user-${String(Date.now())}`,
          ...(request.email ? { userEmail: request.email } : {}),
          ...(request.phoneNumber
            ? { userPhoneNumber: request.phoneNumber }
            : {}),
          apiKeys: request.wallet
            ? [
                {
                  apiKeyName: `wallet-auth:${request.wallet.publicKey}`,
                  publicKey: request.wallet.publicKey,
                  curveType:
                    request.wallet.type === WalletType.Ethereum
                      ? ("API_KEY_CURVE_SECP256K1" as const)
                      : ("API_KEY_CURVE_ED25519" as const),
                },
              ]
            : [],
          authenticators: request.passkey ? [request.passkey] : [],
          oauthProviders: request.oauthProviders ?? [],
        },
      ],
      wallet: {
        walletName: `Wallet 1`,
        accounts: request.customAccounts ?? [
          ...DEFAULT_ETHEREUM_ACCOUNTS,
          ...DEFAULT_SOLANA_ACCOUNTS,
        ],
      },
    });

    if (!response.subOrganizationId) {
      throw new Error("Expected a non-null subOrganizationId.");
    }
    return { subOrganizationId: response.subOrganizationId };
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export async function getOrCreateSuborg(
  request: GetOrCreateSuborgRequest,
): Promise<GetOrCreateSuborgResponse> {
  // First try to get existing suborgs
  let suborgResponse: GetSuborgsResponse;

  const includeUnverified = request.includeUnverified === true;
  const isEmailOrPhone =
    request.filterType === FilterType.Email ||
    request.filterType === FilterType.PhoneNumber;

  if (!includeUnverified && isEmailOrPhone) {
    suborgResponse = await getVerifiedSuborgs({
      filterType: request.filterType,
      filterValue: request.filterValue,
    });
  } else {
    suborgResponse = await getSuborgs({
      filterType: request.filterType,
      filterValue: request.filterValue,
    });
  }

  // If we found atleast one subOrg, we return
  if (suborgResponse.organizationIds.length > 0) {
    return {
      subOrganizationIds: suborgResponse.organizationIds,
    };
  }

  // No existing suborg found - create a new one
  const createPayload: CreateSuborgRequest = {
    ...(request.additionalData?.email && {
      email: request.additionalData.email,
    }),
    ...(request.additionalData?.phoneNumber && {
      phoneNumber: request.additionalData.phoneNumber,
    }),
    ...(request.additionalData?.passkey && {
      passkey: request.additionalData.passkey,
    }),
    ...(request.additionalData?.oauthProviders && {
      oauthProviders: request.additionalData.oauthProviders,
    }),
    ...(request.additionalData?.customAccounts && {
      customAccounts: request.additionalData.customAccounts,
    }),
    ...(request.additionalData?.wallet && {
      wallet: request.additionalData.wallet,
    }),
  };

  const creationResponse = await createSuborg(createPayload);

  if (!creationResponse?.subOrganizationId) {
    throw new Error("Suborg creation failed");
  }

  return {
    subOrganizationIds: [creationResponse.subOrganizationId],
  };
}
