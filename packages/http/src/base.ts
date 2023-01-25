import fetch from "node-fetch";
import { stamp } from "./stamp";
import { getConfig } from "./config";
import type { RequestInit } from "node-fetch";

type TBasicType = string;

type TQueryShape = Record<string, TBasicType | Array<TBasicType>>;
type THeadersShape = Record<string, TBasicType> | undefined;
type TBodyShape = Record<string, any>;
type TSubstitutionShape = Record<string, any>;

const sharedHeaders: THeadersShape = {};

const sharedRequestOptions: Partial<RequestInit> = {
  redirect: "follow",
};

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

  const { apiPublicKey, apiPrivateKey } = getConfig();

  const url = constructUrl({
    uri: inputUri,
    query: inputQuery,
    substitution: inputSubstitution,
  });

  const sealedBody = stableStringify(inputBody);
  const jsonStamp = Buffer.from(
    stableStringify(
      stamp({
        content: sealedBody,
        privateKey: apiPrivateKey,
        publicKey: apiPublicKey,
      })
    )
  );

  const response = await fetch(url.toString(), {
    ...sharedRequestOptions,
    method,
    headers: {
      ...sharedHeaders,
      ...inputHeaders,
      "X-Stamp": jsonStamp.toString("base64url"),
    },
    body: sealedBody,
  });

  if (!response.ok) {
    // Can't use native `cause` here because it's not well supported on Node v16
    // https://node.green/#ES2022-features-Error-cause-property
    let internalErrorMessage: string | null = null;
    try {
      const { code, message } = (await response.json()) as any;
      internalErrorMessage = `Internal error ${code}: ${message}`;
    } catch (_) {}

    throw new Error(
      `${response.status}: ${response.statusText}${
        internalErrorMessage ? " | " + internalErrorMessage : ""
      }`
    );
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

  const { baseUrl } = getConfig();

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

export function stableStringify(input: Record<string, any>): string {
  return JSON.stringify(input);
}
