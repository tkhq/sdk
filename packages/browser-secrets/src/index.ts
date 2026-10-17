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
  type RedactionValue,
} from "./redaction";
export {
  BrowserSecretsError,
  DENY_REASON_MESSAGES,
  SOURCE_ERROR_MESSAGES,
  SOURCE_REQUIREMENT_MESSAGES,
  isBrowserSecretsError,
  toSafeError,
  type BrowserSecretsErrorCode,
  type BrowserSecretsErrorContext,
  type BrowserSecretsErrorJSON,
  type BrowserSecretsReason,
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
export {
  SOURCE_ERROR_CODES,
  SOURCE_REQUIREMENT_REASONS,
  STRICT_SOURCE_REQUIREMENTS,
  connectSource,
  requireSources,
  toSourceReason,
  type AuditLevel,
  type ConnectedSource,
  type Delivery,
  type DeliveryMode,
  type ExportOutcome,
  type ExportRequest,
  type ListScope,
  type PendingHandle,
  type ResumeRequest,
  type SecretSource,
  type SourceCapabilities,
  type SourceErrorCode,
  type SourceListing,
  type SourceReason,
  type SourceRequirementReason,
  type SourceRequirements,
} from "./source";
export {
  manifestSource,
  type ManifestEntry,
  type ManifestSourceOptions,
  type ManifestValue,
} from "./manifest";
export {
  runSourceConformance,
  type SourceConformanceResult,
  type SourceFixtureFile,
  type SourceHarness,
  type SourceScenario,
} from "./source-conformance";
