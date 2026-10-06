/**
 * `@turnkey/browser-secrets/testing`: the conformance fixture runner, for
 * host adapters and ports that must reproduce `fixtures/*.json`. It is a
 * separate entry point so that production bundles do not include it.
 */
export {
  runConformanceCase,
  runConformanceFixture,
  type AuthorizeFixtureCase,
  type ConformanceCase,
  type ConformanceFixtureFile,
  type ConformanceResult,
  type ParseFixtureCase,
} from "./conformance";
