import { signWithApiKey } from "@turnkey/api-key-stamper";
import { fetch } from "./universal";
import { getBrowserConfig, getConfig } from "./config";
import { stringToBase64urlString } from "@turnkey/encoding";
import {
  getWebAuthnAssertion,
  TurnkeyCredentialRequestOptions,
} from "./webauthn";
import type { TurnkeyClient } from ".";

export type { TurnkeyCredentialRequestOptions };
export { fetch };
type TBasicType = string;

type TQueryShape = Record<string, TBasicType | Array<TBasicType>>;
type THeadersShape = Record<string, TBasicType> | undefined;
type TBodyShape = Record<string, any>;
type TSubstitutionShape = Record<string, any>;

const sharedHeaders: THeadersShape = {
  "Content-Type": "application/json",
};

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
  S extends TSubstitutionShape = never,
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
  H extends THeadersShape = never,
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

export async function* requestStream<
  ResponseData = never,
  B extends TBodyShape = never,
  Q extends TQueryShape = never,
  S extends TSubstitutionShape = never,
  H extends THeadersShape = never,
>(input: {
  uri: string;
  method: "POST";
  headers?: H;
  query?: Q;
  body?: B;
  substitution?: S;
}): AsyncGenerator<ResponseData> {
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
    let res: GrpcStatus;
    try {
      res = await response.json();
    } catch (_) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    throw new TurnkeyRequestError(res);
  }

  yield* parseGrpcGatewayStream<ResponseData>(response.body, (status) => {
    return new TurnkeyRequestError(status);
  });
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
  substitutionMap: TSubstitutionShape,
): string {
  let result = uri;

  const keyList = Object.keys(substitutionMap);

  for (const key of keyList) {
    const output = result.replaceAll(`{${key}}`, substitutionMap[key]);
    invariant(
      output !== result,
      `Substitution error: cannot find "${key}" in URI "${uri}". \`substitutionMap\`: ${JSON.stringify(
        substitutionMap,
      )}`,
    );

    result = output;
  }

  invariant(
    !/\{.*\}/.test(result),
    `Substitution error: found unsubstituted components in "${result}"`,
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

type StreamChunk = ArrayBuffer | ArrayBufferView | string;

type ReadableStreamReaderLike = {
  read: () => Promise<{ done?: boolean; value?: StreamChunk }>;
  cancel?: () => Promise<void>;
  releaseLock?: () => void;
};

type ReadableStreamLike = {
  getReader: () => ReadableStreamReaderLike;
};

type AsyncIterableBody = AsyncIterable<StreamChunk> & {
  destroy?: () => void;
};

type GrpcGatewayStreamFrame<T> = {
  result?: T;
  error?: GrpcStatus;
};

export async function* parseGrpcGatewayStream<T>(
  body: unknown,
  makeError: (status: GrpcStatus) => Error,
): AsyncGenerator<T> {
  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of iterateResponseBody(body)) {
    buffer += decodeStreamChunk(decoder, chunk, true);
    let newlineIndex = buffer.indexOf("\n");

    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line !== "") {
        yield parseGrpcGatewayStreamLine<T>(line, makeError);
      }
      newlineIndex = buffer.indexOf("\n");
    }
  }

  buffer += decoder.decode();
  const finalLine = buffer.trim();
  if (finalLine !== "") {
    yield parseGrpcGatewayStreamLine<T>(finalLine, makeError);
  }
}

async function* iterateResponseBody(
  body: unknown,
): AsyncGenerator<StreamChunk> {
  if (body == null) {
    throw new Error("Streaming response is missing a response body");
  }

  if (isReadableStreamLike(body)) {
    const reader = body.getReader();
    let completed = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          completed = true;
          return;
        }

        if (value != null) {
          yield value;
        }
      }
    } finally {
      if (!completed) {
        await reader.cancel?.();
      }
      reader.releaseLock?.();
    }
  }

  if (isAsyncIterableBody(body)) {
    let completed = false;

    try {
      for await (const chunk of body) {
        yield chunk;
      }
      completed = true;
    } finally {
      if (!completed) {
        body.destroy?.();
      }
    }

    return;
  }

  throw new Error("Streaming response body is not readable");
}

function parseGrpcGatewayStreamLine<T>(
  line: string,
  makeError: (status: GrpcStatus) => Error,
): T {
  const frame = JSON.parse(line) as GrpcGatewayStreamFrame<T>;

  if (frame.error != null) {
    throw makeError(frame.error);
  }

  if (frame.result != null) {
    return frame.result;
  }

  throw new Error("Streaming response frame is missing result and error");
}

function decodeStreamChunk(
  decoder: TextDecoder,
  chunk: StreamChunk,
  stream: boolean,
): string {
  if (typeof chunk === "string") {
    return chunk;
  }

  if (chunk instanceof ArrayBuffer) {
    return decoder.decode(chunk, { stream });
  }

  return decoder.decode(
    new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength),
    { stream },
  );
}

function isReadableStreamLike(body: unknown): body is ReadableStreamLike {
  const candidate = body as { getReader?: unknown };
  return (
    typeof body === "object" &&
    body != null &&
    typeof candidate.getReader === "function"
  );
}

function isAsyncIterableBody(body: unknown): body is AsyncIterableBody {
  const candidate = body as { [Symbol.asyncIterator]?: unknown };
  return (
    typeof body === "object" &&
    body != null &&
    typeof candidate[Symbol.asyncIterator] === "function"
  );
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

// Check if the client is an instance of TurnkeyClient. We check the name field here since the 'instanceof' operator does not work across if the http client isn't EXACTLY the same (mismatching versions).
export function isHttpClient(client: any): client is TurnkeyClient {
  return client?.name === "TurnkeyClient";
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
