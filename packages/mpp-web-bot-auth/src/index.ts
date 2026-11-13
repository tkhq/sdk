import {
  parseDictionary,
  serializeDictionary,
  serializeInnerList,
  serializeItem,
} from "structured-headers";
import type { BareItem, Dictionary, InnerList } from "structured-headers";

export type Ed25519PublicJwk = {
  kty: "OKP";
  crv: "Ed25519";
  x: string;
  kid?: string;
  alg?: "EdDSA" | "Ed25519";
  use?: "sig";
};

/** Context for one HTTP attempt. A new attempt needs a new random nonce. */
export type SigningContext = {
  created: number;
  nonce: string;
};

/** Structurally compatible with MPP's Identity.Prover, without a runtime MPP dependency. */
export type WebBotAuthProver = {
  scope: readonly string[];
  headers: readonly string[];
  prove(request: Request, context?: SigningContext): Promise<Request>;
};

export type WebBotAuthConfig = {
  /** Signs the exact RFC 9421 signature-base bytes. The private key stays remote. */
  sign: (bytes: Uint8Array) => Promise<Uint8Array>;
  publicKeyJwk: Ed25519PublicJwk;
  /** HTTPS origin hosting this bot's public key directory. */
  signatureAgent: string;
  /** Explicit origins allowed to receive bot signatures. */
  scope: readonly string[];
  expiresIn?: number;
};

const encoder = new TextEncoder();
const label = "webbot";
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
 * Creates a prover for one narrow profile: the MPP HTTPS-directory Web Bot Auth
 * profile. It signs `@authority` and `Signature-Agent` only, with an external
 * signer. It signs bot identity and authority; it does not authorize an HTTP
 * operation.
 */
export async function createWebBotAuthProver(
  config: WebBotAuthConfig,
): Promise<WebBotAuthProver> {
  const jwk = validatePublicJwk(config.publicKeyJwk);
  const keyId = await jwkThumbprint(jwk);
  if (jwk.kid !== undefined && jwk.kid !== keyId)
    throw new Error("Bot JWK kid must equal its RFC 7638 thumbprint.");
  const publicKey = await crypto.subtle.importKey("jwk", jwk, "Ed25519", true, [
    "verify",
  ]);
  const signatureAgent = origin(config.signatureAgent, false);
  const scope = Object.freeze(config.scope.map((value) => origin(value, true)));
  if (scope.length === 0)
    throw new Error("At least one signing origin is required.");
  const expiresIn = config.expiresIn ?? 60;
  if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 60)
    throw new Error("Bot signatures must live from 1 through 60 seconds.");

  return {
    scope,
    headers: ["Signature", "Signature-Input", "Signature-Agent"],
    async prove(request, suppliedContext) {
      const context = suppliedContext ?? {
        created: Math.floor(Date.now() / 1000),
        nonce: base64url(crypto.getRandomValues(new Uint8Array(32))),
      };
      const url = new URL(request.url);
      if (url.username || url.password || !scope.includes(url.origin))
        throw new Error("The request origin is outside the bot signing scope.");
      if (!Number.isSafeInteger(context.created) || context.created < 0)
        throw new Error("The signing timestamp is invalid.");
      if (!/^[A-Za-z0-9_-]{8,128}$/.test(context.nonce))
        throw new Error("The signing nonce is invalid.");

      const headers = new Headers(request.headers);
      const signatures = dictionary(headers.get("Signature"));
      const inputs = dictionary(headers.get("Signature-Input"));
      const agents = dictionary(headers.get("Signature-Agent"));
      if (
        inputs.size !== signatures.size ||
        [...inputs.keys()].some((key) => !signatures.has(key))
      )
        throw new Error("Existing signature headers have different labels.");
      if (inputs.has(label) || signatures.has(label) || agents.has(label))
        throw new Error("The webbot signature label already exists.");

      const agentEntry: [string, Map<string, BareItem>] = [
        signatureAgent,
        empty(),
      ];
      agents.set(label, agentEntry);
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
          ["signature-agent", new Map([["key", label]])],
        ],
        parameters,
      ];
      const serializedInput = serializeInnerList(input);
      const bytes = encoder.encode(
        `"@authority": ${url.host}\n` +
          `"signature-agent";key="${label}": ${serializeItem(agentEntry)}\n` +
          `"@signature-params": ${serializedInput}`,
      );
      const signature = await config.sign(bytes);
      if (signature.length !== 64)
        throw new Error(
          "The bot signer returned an invalid Ed25519 signature length.",
        );
      if (
        !(await crypto.subtle.verify(
          "Ed25519",
          publicKey,
          arrayBuffer(signature),
          arrayBuffer(bytes),
        ))
      )
        throw new Error(
          "The bot signature does not match the configured public key.",
        );

      inputs.set(label, input);
      signatures.set(label, [arrayBuffer(signature), empty()]);
      headers.set("Signature-Agent", serializeDictionary(agents));
      headers.set("Signature-Input", serializeDictionary(inputs));
      headers.set("Signature", serializeDictionary(signatures));
      return new Request(request, { headers, redirect: "error" });
    },
  };
}

type RawSignInput = {
  organizationId: string;
  signWith: string;
  payload: string;
  encoding: "PAYLOAD_ENCODING_HEXADECIMAL";
  hashFunction: "HASH_FUNCTION_NOT_APPLICABLE";
};

export type TurnkeyRawSigner = {
  signRawPayload(input: RawSignInput): Promise<{
    r: string;
    s: string;
    activity?: { id?: string; status?: string };
  }>;
};

/** Adapts the SDK's raw-signing API without exporting the bot's private key. */
export function createTurnkeyBotSigner(config: {
  client: TurnkeyRawSigner;
  organizationId: string;
  signWith: string;
  onActivity?: (id: string) => void;
}): (bytes: Uint8Array) => Promise<Uint8Array> {
  if (!config.organizationId || !config.signWith)
    throw new Error(
      "A Turnkey organization and bot key reference are required.",
    );
  return async (bytes) => {
    let result: Awaited<ReturnType<TurnkeyRawSigner["signRawPayload"]>>;
    try {
      result = await config.client.signRawPayload({
        organizationId: config.organizationId,
        signWith: config.signWith,
        payload: Array.from(bytes, (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join(""),
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
      });
    } catch {
      throw new Error("Turnkey did not complete the bot signing activity.");
    }
    if (
      result.activity?.status !== undefined &&
      result.activity.status !== "ACTIVITY_STATUS_COMPLETED"
    )
      throw new Error("Turnkey did not complete the bot signing activity.");
    if (
      !/^[a-fA-F0-9]{64}$/.test(result.r) ||
      !/^[a-fA-F0-9]{64}$/.test(result.s)
    )
      throw new Error("Turnkey returned an invalid Ed25519 signature.");
    const hex = result.r + result.s;
    const signature = Uint8Array.from(hex.match(/../g)!, (byte) =>
      Number.parseInt(byte, 16),
    );
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
  )
    throw new Error("A public Ed25519 signing JWK is required.");
  return {
    kty: "OKP",
    crv: "Ed25519",
    x: jwk.x,
    ...(jwk.kid ? { kid: jwk.kid } : {}),
  };
}

function origin(value: string, allowLoopback: boolean): string {
  const url = new URL(value);
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
  )
    throw new Error(
      "An HTTPS origin is required; local request scopes may use loopback HTTP.",
    );
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
