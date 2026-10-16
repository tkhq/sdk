export * from "./types";
export {
  parseBinding,
  createSecretRef,
  redactionEntries,
  type SecretMetadata,
} from "./binding";
export { matchesOrigin, matchesUrl, type UrlRule } from "./matcher";
export type {
  URLPatternConstructor,
  URLPatternInitLike,
  URLPatternLike,
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
