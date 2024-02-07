import { signWithApiKey } from "@turnkey/api-key-stamper";
import { fetch } from "./universal";
import { getBrowserConfig, getConfig } from "./config";
import { stringToBase64urlString } from "@turnkey/encoding";
import {
  getWebAuthnAssertion,
  TurnkeyCredentialRequestOptions,
} from "./webauthn";

export type { TurnkeyCredentialRequestOptions };
export { fetch };
type TBasicType = string;

type TQueryShape = Record<string, TBasicType | Array<TBasicType>>;
type THeadersShape = Record<string, TBasicType> | undefined;
type TBodyShape = Record<string, any>;
type TSubstitutionShape = Record<string, any>;

const sharedHeaders: THeadersShape = {};

const sharedRequestOptions: Partial<RequestInit> = {
  redirect: "follow",
};

/**
 * Represents a signed request ready to be POSTed to Turnkey
 * @deprecated use {@link TSignedRequest} instead
 */
export type SignedRequest = {
  body: string;
  stamp: string;
  url: string;
};

/**
 * @deprecated
 */
export async function signedRequest<
  B extends TBodyShape = never,
  Q extends TQueryShape = never,
  S extends TSubstitutionShape = never
>(input: {
  uri: string;
  query?: Q;
  body?: B;
  substitution?: S;
  options?: TurnkeyCredentialRequestOptions | undefined;
}): Promise<SignedRequest> {
  const {
    uri: inputUri,
    query: inputQuery = {},
    substitution: inputSubstitution = {},
    body: inputBody = {},
  } = input;

  const url = constructUrl({
    uri: inputUri,
    query: inputQuery,
    substitution: inputSubstitution,
  });

  const body = JSON.stringify(inputBody);
  const stamp = await getWebAuthnAssertion(body, input.options);

  return {
    url: url.toString(),
    body,
    stamp,
  };
}

export async function request<
  ResponseData = never,
  B extends TBodyShape = never,
  Q extends TQueryShape = never,
  S extends TSubstitutionShape = never,
  H extends THeadersShape = never
>(input: {
  uri: string;
  method: "POST";
  headers?: H;
  query?: Q;
  body?: B;
  substitution?: S;
}): Promise<ResponseData> {
  const {
    uri: inputUri,
    method,
    headers: inputHeaders = {},
    query: inputQuery = {},
    substitution: inputSubstitution = {},
    body: inputBody = {},
  } = input;

  const url = constructUrl({
    uri: inputUri,
    query: inputQuery,
    substitution: inputSubstitution,
  });

  const { sealedBody, xStamp } = await sealAndStampRequestBody({
    body: inputBody,
  });

  const response = await fetch(url.toString(), {
    ...sharedRequestOptions,
    method,
    headers: {
      ...sharedHeaders,
      ...inputHeaders,
      "X-Stamp": xStamp,
    },
    body: sealedBody,
  });

  if (!response.ok) {
    // Can't use native `cause` here because it's not well supported on Node v16
    // https://node.green/#ES2022-features-Error-cause-property

    let res: GrpcStatus;
    try {
      res = await response.json();
    } catch (_) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    throw new TurnkeyRequestError(res);
  }

  const data = await response.json();

  return data as ResponseData;
}

function constructUrl(input: {
  uri: string;
  query: TQueryShape;
  substitution: TSubstitutionShape;
}): URL {
  const { uri, query, substitution } = input;

  const baseUrl = getBaseUrl();

  const url = new URL(substitutePath(uri, substitution), baseUrl);

  for (const key in query) {
    const value = query[key];

    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, item);
      }
    } else {
      url.searchParams.append(key, value ?? "");
    }
  }

  return url;
}

function getBaseUrl(): string {
  try {
    const { baseUrl } = getConfig();
    return baseUrl;
  } catch (e) {
    const { baseUrl } = getBrowserConfig();
    return baseUrl;
  }
}

function substitutePath(
  uri: string,
  substitutionMap: TSubstitutionShape
): string {
  let result = uri;

  const keyList = Object.keys(substitutionMap);

  for (const key of keyList) {
    const output = result.replaceAll(`{${key}}`, substitutionMap[key]);
    invariant(
      output !== result,
      `Substitution error: cannot find "${key}" in URI "${uri}". \`substitutionMap\`: ${JSON.stringify(
        substitutionMap
      )}`
    );

    result = output;
  }

  invariant(
    !/\{.*\}/.test(result),
    `Substitution error: found unsubstituted components in "${result}"`
  );

  return result;
}

function invariant(condition: any, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function stableStringify(input: Record<string, any>): string {
  return JSON.stringify(input);
}

/**
 * Seals and stamps the request body with your Turnkey API credentials.
 *
 * You can either:
 * - Before calling `sealAndStampRequestBody(...)`, initialize with your Turnkey API credentials via `init(...)`
 * - Or, provide `apiPublicKey` and `apiPrivateKey` here as arguments
 */
export async function sealAndStampRequestBody(input: {
  body: Record<string, any>;
  apiPublicKey?: string;
  apiPrivateKey?: string;
}): Promise<{
  sealedBody: string;
  xStamp: string;
}> {
  const { body } = input;
  let { apiPublicKey, apiPrivateKey } = input;

  if (!apiPublicKey) {
    const config = getConfig();
    apiPublicKey = config.apiPublicKey;
  }

  if (!apiPrivateKey) {
    const config = getConfig();
    apiPrivateKey = config.apiPrivateKey;
  }

  const sealedBody = stableStringify(body);
  const signature = await signWithApiKey({
    content: sealedBody,
    privateKey: apiPrivateKey,
    publicKey: apiPublicKey,
  });
  const sealedStamp = stableStringify({
    publicKey: apiPublicKey,
    scheme: "SIGNATURE_SCHEME_TK_API_P256",
    signature: signature,
  });

  const xStamp = stringToBase64urlString(sealedStamp);

  return {
    sealedBody,
    xStamp,
  };
}

export type THttpConfig = {
  baseUrl: string;
};

/**
 * Represents a signed request ready to be POSTed to Turnkey
 */
export type TSignedRequest = {
  body: string;
  stamp: TStamp;
  url: string;
};

/**
 * Represents a stamp header name/value pair
 */
export type TStamp = {
  stampHeaderName: string;
  stampHeaderValue: string;
};

export type GrpcStatus = {
  message: string;
  code: number;
  details: unknown[] | null;
};

/**
 * Interface to implement if you want to provide your own stampers to your {@link TurnkeyClient}.
 * Currently Turnkey provides 2 stampers:
 * - applications signing requests with Passkeys or webauthn devices should use `@turnkey/webauthn-stamper`
 * - applications signing requests with API keys should use `@turnkey/api-key-stamper`
 */
export interface TStamper {
  stamp: (input: string) => Promise<TStamp>;
}

export class TurnkeyRequestError extends Error {
  details: any[] | null;
  code: number;

  constructor(input: GrpcStatus) {
    let turnkeyErrorMessage = `Turnkey error ${input.code}: ${input.message}`;

    if (input.details != null) {
      turnkeyErrorMessage += ` (Details: ${JSON.stringify(input.details)})`;
    }

    super(turnkeyErrorMessage);

    this.name = "TurnkeyRequestError";
    this.details = input.details ?? null;
    this.code = input.code;
  }
}
