import {
  parseDictionary,
  serializeDictionary,
  serializeInnerList,
  serializeItem,
} from "structured-headers";
import type { BareItem, Dictionary, InnerList } from "structured-headers";
import {
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
} from "@turnkey/encoding";

/** Public Ed25519 signing key in JWK form. Private members are rejected. */
export type Ed25519PublicJwk = {
  kty: "OKP";
  crv: "Ed25519";
  x: string;
  kid?: string;
  alg?: "EdDSA" | "Ed25519";
  use?: "sig";
};

/**
 * Values shared by every prover contributing to one HTTP attempt. Matches
 * mppx's `Identity.ProveContext`. A new attempt needs a new random nonce.
 */
export type ProveContext = {
  /** Unix timestamp, in seconds, at which the attempt was created (RFC 9421 `created`). */
  readonly created: number;
  /** Base64url-encoded random value identifying the attempt (RFC 9421 `nonce`). */
  readonly nonce: string;
  /** On a paid attempt, the MPP Challenge being answered. This profile does not sign it. */
  readonly challenge?: unknown;
};

/** Structurally compatible with MPP's Identity.Prover, without a runtime MPP dependency. */
export type WebBotAuthProver = {
  readonly scope: readonly string[];
  prove(request: Request, context?: ProveContext): Promise<Request>;
};

/** Signs the exact RFC 9421 signature-base bytes and returns a 64-byte Ed25519 signature. */
export type BotSigner = (bytes: Uint8Array) => Promise<Uint8Array>;

/** Configuration for {@link createWebBotAuthProver}. */
export type WebBotAuthProverConfig = {
  /** Signs the exact RFC 9421 signature-base bytes. The private key stays remote. */
  sign: BotSigner;
  publicKeyJwk: Ed25519PublicJwk;
  /** HTTPS origin hosting this bot's public key directory. */
  signatureAgent: string;
  /** Explicit origins allowed to receive bot signatures. `'*'` is not accepted. */
  scope: readonly string[];
  /** Signature lifetime in seconds, from 1 through 60. @default 60 */
  expiresIn?: number;
  /** RFC 9421 dictionary label. @default 'webbot' */
  label?: string;
  /** Dictionary member name used for `Signature-Agent`. @default label */
  signatureAgentKey?: string;
};

const encoder = new TextEncoder();
const defaultLabel = "webbot";
// RFC 8941 dictionary member key.
const dictionaryKey = /^[a-z*][a-z0-9_\-.*]*$/;
const empty = () => new Map<string, BareItem>();

/** RFC 7638 thumbprint of a public Ed25519 JWK. */
export async function jwkThumbprint(jwk: Ed25519PublicJwk): Promise<string> {
  const key = validatePublicJwk(jwk);
  const canonical = JSON.stringify({ crv: key.crv, kty: key.kty, x: key.x });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(canonical),
  );
  return base64url(new Uint8Array(digest));
}

/**
 * Converts a raw Ed25519 public key, as Turnkey reports it (32 bytes of hex,
 * with or without a `0x` prefix), to a public JWK.
 */
export function ed25519PublicKeyToJwk(hex: string): Ed25519PublicJwk {
  if (typeof hex !== "string") {
    throw new TypeError("An Ed25519 public key must be a hex string.");
  }
  const digits = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]{64}$/.test(digits)) {
    throw new TypeError("An Ed25519 public key must be 32 bytes of hex.");
  }
  return {
    kty: "OKP",
    crv: "Ed25519",
    x: base64url(uint8ArrayFromHexString(digits)),
  };
}

/**
 * Creates a prover for one narrow profile: the MPP HTTPS-directory Web Bot Auth
 * profile. It signs `@authority` and `Signature-Agent` only, with an external
 * signer. It signs bot identity and authority; it does not authorize an HTTP
 * operation.
 */
export async function createWebBotAuthProver(
  config: WebBotAuthProverConfig,
): Promise<WebBotAuthProver> {
  const jwk = validatePublicJwk(config.publicKeyJwk);
  const keyId = await jwkThumbprint(jwk);
  if (jwk.kid !== undefined && jwk.kid !== keyId) {
    throw new TypeError("Bot JWK kid must equal its RFC 7638 thumbprint.");
  }
  const publicKey = await crypto.subtle.importKey("jwk", jwk, "Ed25519", true, [
    "verify",
  ]);
  const signatureAgent = origin(config.signatureAgent, false);
  if (!Array.isArray(config.scope)) {
    throw new TypeError(
      "The bot signing scope must be a list of explicit origins; '*' is not accepted.",
    );
  }
  const scope = Object.freeze(config.scope.map((value) => origin(value, true)));
  if (scope.length === 0) {
    throw new TypeError("At least one signing origin is required.");
  }
  const expiresIn = config.expiresIn ?? 60;
  if (typeof expiresIn !== "number" || !Number.isInteger(expiresIn)) {
    throw new TypeError("Bot signature lifetime must be an integer.");
  }
  if (expiresIn < 1 || expiresIn > 60) {
    throw new RangeError("Bot signatures must live from 1 through 60 seconds.");
  }
  const label = config.label ?? defaultLabel;
  const signatureAgentKey = config.signatureAgentKey ?? label;
  if (
    typeof label !== "string" ||
    typeof signatureAgentKey !== "string" ||
    !dictionaryKey.test(label) ||
    !dictionaryKey.test(signatureAgentKey)
  ) {
    throw new TypeError(
      "Signature label and Signature-Agent key must be structured-field dictionary keys.",
    );
  }

  return {
    scope,
    async prove(request, suppliedContext) {
      const context = suppliedContext ?? {
        created: Math.floor(Date.now() / 1000),
        nonce: base64url(crypto.getRandomValues(new Uint8Array(32))),
      };
      const url = new URL(request.url);
      if (url.username || url.password || !scope.includes(url.origin)) {
        throw new Error("The request origin is outside the bot signing scope.");
      }
      if (!Number.isSafeInteger(context.created)) {
        throw new TypeError("The signing timestamp is invalid.");
      }
      if (context.created < 0) {
        throw new RangeError("The signing timestamp is invalid.");
      }
      if (
        typeof context.nonce !== "string" ||
        !/^[A-Za-z0-9_-]{8,128}$/.test(context.nonce)
      ) {
        throw new TypeError("The signing nonce is invalid.");
      }

      const headers = new Headers(request.headers);
      const signatures = dictionary(headers.get("Signature"));
      const inputs = dictionary(headers.get("Signature-Input"));
      const agents = dictionary(headers.get("Signature-Agent"));
      if (
        inputs.size !== signatures.size ||
        [...inputs.keys()].some((key) => !signatures.has(key))
      ) {
        throw new Error("Existing signature headers have different labels.");
      }
      if (inputs.has(label) || signatures.has(label)) {
        throw new Error(`The "${label}" signature label already exists.`);
      }
      if (agents.has(signatureAgentKey)) {
        throw new Error(
          `The "${signatureAgentKey}" Signature-Agent member already exists.`,
        );
      }

      const agentEntry: [string, Map<string, BareItem>] = [
        signatureAgent,
        empty(),
      ];
      agents.set(signatureAgentKey, agentEntry);
      const parameters = new Map<string, BareItem>([
        ["created", context.created],
        ["expires", context.created + expiresIn],
        ["keyid", keyId],
        ["alg", "ed25519"],
        ["nonce", context.nonce],
        ["tag", "web-bot-auth"],
      ]);
      const input: InnerList = [
        [
          ["@authority", empty()],
          ["signature-agent", new Map([["key", signatureAgentKey]])],
        ],
        parameters,
      ];
      const serializedInput = serializeInnerList(input);
      const bytes = encoder.encode(
        `"@authority": ${url.host}\n` +
          `"signature-agent";key="${signatureAgentKey}": ${serializeItem(agentEntry)}\n` +
          `"@signature-params": ${serializedInput}`,
      );
      const signature = await config.sign(bytes);
      if (signature.length !== 64) {
        throw new Error(
          "The bot signer returned an invalid Ed25519 signature length.",
        );
      }
      const valid = await crypto.subtle.verify(
        "Ed25519",
        publicKey,
        arrayBuffer(signature),
        arrayBuffer(bytes),
      );
      if (!valid) {
        throw new Error(
          "The bot signature does not match the configured public key.",
        );
      }

      inputs.set(label, input);
      signatures.set(label, [arrayBuffer(signature), empty()]);
      headers.set("Signature-Agent", serializeDictionary(agents));
      headers.set("Signature-Input", serializeDictionary(inputs));
      headers.set("Signature", serializeDictionary(signatures));
      return new Request(request, { headers, redirect: "error" });
    },
  };
}

/** The `signRawPayload` request {@link createTurnkeyBotSigner} submits. */
export type SignRawPayloadInput = {
  organizationId: string;
  signWith: string;
  payload: string;
  encoding: "PAYLOAD_ENCODING_HEXADECIMAL";
  hashFunction: "HASH_FUNCTION_NOT_APPLICABLE";
};

/** The `signRawPayload` fields {@link createTurnkeyBotSigner} reads. */
export type SignRawPayloadResult = {
  r: string;
  s: string;
  activity?: { id?: string; status?: string };
};

/** The subset of an authenticated Turnkey SDK client the bot signer uses. */
export type TurnkeyRawSigner = {
  signRawPayload(input: SignRawPayloadInput): Promise<SignRawPayloadResult>;
};

/** Configuration for {@link createTurnkeyBotSigner}. */
export type TurnkeyBotSignerConfig = {
  /** An authenticated Turnkey client. */
  client: TurnkeyRawSigner;
  organizationId: string;
  /** The Ed25519 bot key: a private key ID, address, or wallet account. */
  signWith: string;
  /** Called with the activity ID of each completed signing activity. */
  onActivity?: (id: string) => void;
};

/** Adapts the SDK's raw-signing API without exporting the bot's private key. */
export function createTurnkeyBotSigner(
  config: TurnkeyBotSignerConfig,
): BotSigner {
  if (!config.organizationId || !config.signWith) {
    throw new TypeError(
      "A Turnkey organization and bot key reference are required.",
    );
  }
  return async (bytes) => {
    let result: SignRawPayloadResult;
    try {
      result = await config.client.signRawPayload({
        organizationId: config.organizationId,
        signWith: config.signWith,
        payload: uint8ArrayToHexString(bytes),
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
      });
    } catch (cause) {
      throw new Error("Turnkey did not complete the bot signing activity.", {
        cause,
      });
    }
    if (
      result.activity?.status !== undefined &&
      result.activity.status !== "ACTIVITY_STATUS_COMPLETED"
    ) {
      throw new Error("Turnkey did not complete the bot signing activity.");
    }
    if (
      !/^[a-fA-F0-9]{64}$/.test(result.r) ||
      !/^[a-fA-F0-9]{64}$/.test(result.s)
    ) {
      throw new Error("Turnkey returned an invalid Ed25519 signature.");
    }
    const signature = uint8ArrayFromHexString(result.r + result.s);
    if (result.activity?.id) config.onActivity?.(result.activity.id);
    return signature;
  };
}

function validatePublicJwk(jwk: Ed25519PublicJwk): Ed25519PublicJwk {
  if (
    typeof jwk !== "object" ||
    jwk === null ||
    "d" in jwk ||
    jwk.kty !== "OKP" ||
    jwk.crv !== "Ed25519" ||
    !/^[A-Za-z0-9_-]{43}$/.test(jwk.x) ||
    (jwk.alg !== undefined && jwk.alg !== "EdDSA" && jwk.alg !== "Ed25519") ||
    (jwk.use !== undefined && jwk.use !== "sig")
  ) {
    throw new TypeError("A public Ed25519 signing JWK is required.");
  }
  return {
    kty: "OKP",
    crv: "Ed25519",
    x: jwk.x,
    ...(jwk.kid ? { kid: jwk.kid } : {}),
  };
}

function origin(value: string, allowLoopback: boolean): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`Invalid origin: ${String(value)}`);
  }
  const loopback =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]";
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(allowLoopback && loopback && url.protocol === "http:"))
  ) {
    throw new TypeError(
      "An HTTPS origin is required; local request scopes may use loopback HTTP.",
    );
  }
  return url.origin;
}

function dictionary(value: string | null): Dictionary {
  if (value === null) return new Map();
  try {
    return parseDictionary(value);
  } catch {
    throw new Error("An existing HTTP signature header is malformed.");
  }
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}
