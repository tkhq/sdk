export * from "./types";
export {
  parseBinding,
  createSecretRef,
  redactionEntries,
  type SecretMetadata,
} from "./binding";
export {
  isExactHttpOrigin,
  isExactOrigin,
  isHttpUrl,
  httpOriginOf,
  matchesOrigin,
  matchesUrl,
  compileUrlPattern,
  type UrlRule,
} from "./matcher";
export {
  getURLPattern,
  getURLPatternSource,
  type URLPatternConstructor,
  type URLPatternInitLike,
  type URLPatternLike,
  type URLPatternSource,
} from "./urlpattern";
export {
  authorize,
  isSameDestination,
  validateRequest,
  requiredSelectors,
  DENY_REASONS,
  type DenyReason,
  type AuthorizedTarget,
  type AuthorizationAllowed,
  type AuthorizationDenied,
  type AuthorizationDecision,
  type RequestValidation,
} from "./authorize";
export {
  LOOSE_MATCH_MIN_LENGTH,
  RedactionRegistry,
  type RedactionMatch,
  type RedactionRegistryOptions,
  type RedactionTarget,
} from "./redaction";
export {
  BrowserSecretsError,
  DENY_REASON_MESSAGES,
  isBrowserSecretsError,
  toSafeError,
  type BrowserSecretsErrorCode,
  type BrowserSecretsErrorJSON,
} from "./errors";
export {
  runConformanceCase,
  runConformanceFixture,
  type AuthorizeFixtureCase,
  type ConformanceCase,
  type ConformanceFixtureFile,
  type ConformanceResult,
  type ParseFixtureCase,
} from "./conformance";
