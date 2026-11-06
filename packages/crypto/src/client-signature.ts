import { decodeBase64urlToString } from "@turnkey/encoding";
import type {
  ProxyTSignupV3Body as ProxyTSignupV3BodyType,
  v1ApiKeyParamsV2,
  v1AuthenticatorParamsV2,
  v1ClientSignatureEntry,
  v1ClientSignatureV2,
  v1OauthProviderParamsV2,
  v1OtpParams,
  v1RootUserParamsV6,
  v1SignupUsageV3,
  v1SignupV3Request,
  v1TokenUsage,
  v1WalletAuthenticatorParams,
} from "@turnkey/sdk-types";

import { VerificationToken, publicKeyNonce } from "./verification-token";

export const CLIENT_SIGNATURE_SCHEME_API_P256 =
  "CLIENT_SIGNATURE_SCHEME_API_P256" as const;

export type BuildClientSignatureMessageParams = {
  otpAuthenticators?: v1OtpParams[];
  apiKeys?: v1ApiKeyParamsV2[];
  authenticators?: v1AuthenticatorParamsV2[];
  oauthProviders?: v1OauthProviderParamsV2[];
  walletAuthenticators?: v1WalletAuthenticatorParams[];
};

/**
 * Compressed P-256 public keys the caller can sign with, or a function that
 * returns them. Core passes `stamper.listKeyPairs()`; custom servers can pass
 * an in-memory list.
 */
export type ClientSignatureListPublicKeys =
  | (() => Iterable<string | undefined> | Promise<Iterable<string | undefined>>)
  | Iterable<string | undefined>
  | Promise<Iterable<string | undefined>>;

export type ClientSignatureKeySource = {
  /** OTP, wallet, and OIDC JWTs. Nonce claims are matched against `publicKeys`. */
  tokens?: Array<string | undefined>;
  /** Candidate compressed P-256 public keys. Extra keys that match no token are ignored. */
  publicKeys?: Array<string | undefined>;
};

/** Canonical SignupV3 `TokenUsage` JSON. */
export function buildSignupClientSignatureMessage(
  params: BuildClientSignatureMessageParams = {},
): string {
  const usage: v1SignupUsageV3 = {
    ...(params.otpAuthenticators
      ? { otpAuthenticators: params.otpAuthenticators }
      : {}),
    ...(params.apiKeys ? { apiKeys: params.apiKeys } : {}),
    ...(params.authenticators ? { authenticators: params.authenticators } : {}),
    ...(params.oauthProviders ? { oauthProviders: params.oauthProviders } : {}),
    ...(params.walletAuthenticators
      ? { walletAuthenticators: params.walletAuthenticators }
      : {}),
  };

  const payload: v1TokenUsage = {
    type: "USAGE_TYPE_SIGNUP",
    tokenId: crypto.randomUUID(),
    signupV3: usage,
  };

  return JSON.stringify(payload);
}

/**
 * Unique compressed P-256 public keys that must sign the client-signature
 * message. Each token's `nonce` / `tknonce` is looked up in the nonce map of
 * `publicKeys`. Duplicate keys are returned once. Extra unmatched keys are
 * ignored.
 */
export function collectClientSignaturePublicKeys(
  source: ClientSignatureKeySource = {},
): string[] {
  const nonceToPublicKey = new Map<string, string>();
  for (const publicKey of uniqueNonEmpty(source.publicKeys ?? [])) {
    const compressed = publicKey.toLowerCase();
    nonceToPublicKey.set(publicKeyNonce(compressed), compressed);
  }

  const publicKeys: string[] = [];
  const seen = new Set<string>();
  for (const token of uniqueNonEmpty(source.tokens ?? [])) {
    const match = tokenNonces(token)
      .map((nonce) => nonceToPublicKey.get(nonce))
      .find((publicKey): publicKey is string => publicKey !== undefined);
    if (!match) {
      throw new Error("no stored public key matches the token nonce");
    }
    if (seen.has(match)) {
      continue;
    }
    seen.add(match);
    publicKeys.push(match);
  }

  return publicKeys;
}

/**
 * Builds the SignupV3 client-signature message and the unique ephemeral public
 * keys that must sign it. Sign each key over `message` (raw P-256, r || s) and
 * pass the results to {@link buildClientSignatureV2}.
 */
export function getClientSignatureMessageForSignup(
  params: BuildClientSignatureMessageParams = {},
  source: ClientSignatureKeySource = {},
): { message: string; publicKeys: string[] } {
  return {
    message: buildSignupClientSignatureMessage(params),
    publicKeys: collectClientSignaturePublicKeys(source),
  };
}

export function buildClientSignatureV2(params: {
  message: string;
  signatures: Array<{ publicKey: string; signature: string }>;
}): v1ClientSignatureV2 {
  return {
    message: params.message,
    signatures: params.signatures.map(
      (entry): v1ClientSignatureEntry => ({
        publicKey: entry.publicKey.toLowerCase(),
        signature: entry.signature,
        scheme: CLIENT_SIGNATURE_SCHEME_API_P256,
      }),
    ),
  };
}

/**
 * Login still uses the v1 `ClientSignature` (one key, `tokenId` = `jti`).
 * Custom-server OTP login flows need this; core/wallet-kit login does not.
 */
export function getClientSignatureMessageForLogin({
  verificationToken,
  sessionPublicKey,
}: {
  verificationToken: string;
  sessionPublicKey?: string;
}): { message: string; publicKey: string } {
  const token = VerificationToken.parse(verificationToken);
  const verificationPublicKey = token.ephemeralPublicKey;
  const payload: v1TokenUsage = {
    type: "USAGE_TYPE_LOGIN",
    tokenId: token.jti,
    login: {
      publicKey: sessionPublicKey || verificationPublicKey,
    },
  };

  return {
    message: JSON.stringify(payload),
    publicKey: verificationPublicKey,
  };
}

export function oidcTokenNonces(oidcToken: string): string[] {
  return tokenNonces(
    oidcToken,
    "invalid OIDC token",
    "OIDC token is missing a nonce",
  );
}

function tokenNonces(
  token: string,
  invalidMessage = "invalid token",
  missingNonceMessage = "token is missing a nonce",
): string[] {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error(invalidMessage);
  }
  const payload = parseJwtObject(parts[1]!, invalidMessage);
  const nonces: string[] = [];
  if (typeof payload.nonce === "string" && payload.nonce.length > 0) {
    nonces.push(payload.nonce);
  }
  if (
    typeof payload.tknonce === "string" &&
    payload.tknonce.length > 0 &&
    !nonces.includes(payload.tknonce)
  ) {
    nonces.push(payload.tknonce);
  }
  if (nonces.length === 0) {
    throw new Error(missingNonceMessage);
  }
  return nonces;
}

function oidcTokenFromProvider(
  provider: v1OauthProviderParamsV2,
): string | undefined {
  if ("oidcToken" in provider && typeof provider.oidcToken === "string") {
    return provider.oidcToken;
  }
  return undefined;
}

function parseJwtObject(
  encoded: string,
  invalidMessage: string,
): Record<string, unknown> {
  let json: unknown;
  try {
    json = JSON.parse(decodeBase64urlToString(encoded));
  } catch {
    throw new Error(invalidMessage);
  }
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    throw new Error(invalidMessage);
  }
  return json as Record<string, unknown>;
}

function uniqueNonEmpty(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}

function tokensFromSignup(params: BuildClientSignatureMessageParams): string[] {
  return uniqueNonEmpty([
    ...(params.otpAuthenticators ?? []).map(
      (authenticator) => authenticator.verificationToken,
    ),
    ...(params.walletAuthenticators ?? []).map(
      (authenticator) => authenticator.verificationToken,
    ),
    ...(params.oauthProviders ?? []).map(oidcTokenFromProvider),
  ]);
}

async function publicKeysFromLister(
  listPublicKeys: ClientSignatureListPublicKeys,
): Promise<string[]> {
  const listed =
    typeof listPublicKeys === "function"
      ? await listPublicKeys()
      : await listPublicKeys;
  return uniqueNonEmpty([...listed]);
}

export type ClientSignatureSigner = (
  message: string,
  publicKey: string,
) => Promise<string>;

/**
 * Builds and signs a SignupV3 `ClientSignatureV2`.
 *
 * Use the nested request types so call sites stay on the object being signed:
 *
 * ```ts
 * const rootUserParams = new ClientSignature.RootUserParamsV6({ ... });
 * const clientSignature = await rootUserParams.sign(
 *   sign,
 *   stamper.listKeyPairs(),
 * );
 *
 * const signUpBody = new ClientSignature.ProxyTSignupV3Body({ ... });
 * await signUpBody.sign(sign, stamper.listKeyPairs());
 * ```
 */
export class ClientSignature {
  readonly message: string;
  readonly publicKeys: string[];

  constructor(message: string, publicKeys: string[]) {
    this.message = message;
    this.publicKeys = publicKeys;
  }

  static from(
    params: BuildClientSignatureMessageParams = {},
    source: ClientSignatureKeySource = {},
  ): ClientSignature {
    const { message, publicKeys } = getClientSignatureMessageForSignup(
      params,
      source,
    );
    return new ClientSignature(message, publicKeys);
  }

  static async fromListed(
    params: BuildClientSignatureMessageParams,
    listPublicKeys: ClientSignatureListPublicKeys,
  ): Promise<ClientSignature> {
    const tokens = tokensFromSignup(params);
    if (tokens.length === 0) {
      return new ClientSignature(buildSignupClientSignatureMessage(params), []);
    }
    return ClientSignature.from(params, {
      tokens,
      publicKeys: await publicKeysFromLister(listPublicKeys),
    });
  }

  async sign(
    signer: ClientSignatureSigner,
  ): Promise<v1ClientSignatureV2 | undefined> {
    if (this.publicKeys.length === 0) {
      return undefined;
    }

    const signatures = [];
    for (const publicKey of this.publicKeys) {
      const signature = await signer(this.message, publicKey);
      if (!signature) {
        throw new Error("Failed to sign client signature for signup");
      }
      signatures.push({ publicKey, signature });
    }

    return buildClientSignatureV2({ message: this.message, signatures });
  }
}

export namespace ClientSignature {
  /**
   * Root user on `CREATE_SUB_ORGANIZATION_V9`. `.sign()` returns the
   * `ClientSignatureV2` to set on the intent.
   */
  export class RootUserParamsV6 {
    userName: string;
    otpAuthenticators: v1OtpParams[];
    apiKeys: v1ApiKeyParamsV2[];
    authenticators: v1AuthenticatorParamsV2[];
    oauthProviders: v1OauthProviderParamsV2[];
    walletAuthenticators: v1WalletAuthenticatorParams[];

    constructor(params: v1RootUserParamsV6) {
      this.userName = params.userName;
      this.otpAuthenticators = params.otpAuthenticators;
      this.apiKeys = params.apiKeys;
      this.authenticators = params.authenticators;
      this.oauthProviders = params.oauthProviders;
      this.walletAuthenticators = params.walletAuthenticators;
    }

    async sign(
      signer: ClientSignatureSigner,
      listPublicKeys: ClientSignatureListPublicKeys = async () => [],
    ): Promise<v1ClientSignatureV2 | undefined> {
      const unsigned = await ClientSignature.fromListed(
        {
          otpAuthenticators: this.otpAuthenticators,
          apiKeys: this.apiKeys,
          authenticators: this.authenticators,
          oauthProviders: this.oauthProviders,
          walletAuthenticators: this.walletAuthenticators,
        },
        listPublicKeys,
      );
      return unsigned.sign(signer);
    }

    toJSON(): v1RootUserParamsV6 {
      return {
        userName: this.userName,
        otpAuthenticators: this.otpAuthenticators,
        apiKeys: this.apiKeys,
        authenticators: this.authenticators,
        oauthProviders: this.oauthProviders,
        walletAuthenticators: this.walletAuthenticators,
      };
    }
  }

  /**
   * Auth-proxy / public SignupV3 body. `.sign()` attaches `clientSignature`
   * when the body carries a verification token or OIDC token whose nonce
   * matches a listed public key.
   */
  export class ProxyTSignupV3Body {
    userTag?: string;
    userName?: string;
    organizationName?: string;
    otpAuthenticators: v1OtpParams[];
    apiKeys: v1ApiKeyParamsV2[];
    authenticators: v1AuthenticatorParamsV2[];
    oauthProviders: v1OauthProviderParamsV2[];
    wallet?: ProxyTSignupV3BodyType["wallet"];
    clientSignature?: v1ClientSignatureV2;
    walletAuthenticators: v1WalletAuthenticatorParams[];

    constructor(body: ProxyTSignupV3BodyType | v1SignupV3Request) {
      this.otpAuthenticators = body.otpAuthenticators;
      this.apiKeys = body.apiKeys;
      this.authenticators = body.authenticators;
      this.oauthProviders = body.oauthProviders;
      this.walletAuthenticators = body.walletAuthenticators;
      copyOptional(this, body, [
        "userTag",
        "userName",
        "organizationName",
        "wallet",
        "clientSignature",
      ]);
    }

    async sign(
      signer: ClientSignatureSigner,
      listPublicKeys: ClientSignatureListPublicKeys = async () => [],
    ): Promise<ProxyTSignupV3BodyType> {
      const unsigned = await ClientSignature.fromListed(
        {
          otpAuthenticators: this.otpAuthenticators,
          apiKeys: this.apiKeys,
          authenticators: this.authenticators,
          oauthProviders: this.oauthProviders,
          walletAuthenticators: this.walletAuthenticators,
        },
        listPublicKeys,
      );
      const clientSignature = await unsigned.sign(signer);

      if (clientSignature) {
        this.clientSignature = clientSignature;
      }
      return this.toJSON();
    }

    toJSON(): ProxyTSignupV3BodyType {
      return {
        otpAuthenticators: this.otpAuthenticators,
        apiKeys: this.apiKeys,
        authenticators: this.authenticators,
        oauthProviders: this.oauthProviders,
        walletAuthenticators: this.walletAuthenticators,
        ...(this.userTag ? { userTag: this.userTag } : {}),
        ...(this.userName ? { userName: this.userName } : {}),
        ...(this.organizationName
          ? { organizationName: this.organizationName }
          : {}),
        ...(this.wallet ? { wallet: this.wallet } : {}),
        ...(this.clientSignature
          ? { clientSignature: this.clientSignature }
          : {}),
      };
    }
  }
}

function copyOptional<T extends object, K extends keyof T>(
  target: T,
  source: Pick<T, K>,
  keys: readonly K[],
): void {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) {
      target[key] = value;
    }
  }
}
