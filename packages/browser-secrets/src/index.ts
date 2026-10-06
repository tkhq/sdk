export * from "./types";
export { parseBinding, createSecretRef, type SecretMetadata } from "./binding";
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
  RedactionRegistry,
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
