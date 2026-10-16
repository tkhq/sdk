# @turnkey/browser-secrets

Destination binding, target authorization, and output redaction for browser agents that fill Turnkey secrets into web pages.

> Status: early and unpublished (`private` in `package.json`). This version has the binding, decision, and redaction core only. It does not call Turnkey yet. The API can change before the first stable release.

## Scope

The package decides whether a secret may be written into a specific element on a live page, and it removes secret values from agent-facing output. It does not drive a browser. The host (for example Secure Browser MCP) owns browser automation, observes the page, and writes the value.

- `parseBinding` and `createSecretRef` read `sbm:*` static properties into a binding. They accept the same secrets as Secure Browser MCP.
- `matchesOrigin` and `matchesUrl` are the one origin and URL-pattern matcher. `URLPattern` comes from the global when it exists (Node 24+, workerd, browsers) and from `urlpattern-polyfill` otherwise. There is no weaker fallback.
- `authorize` is a pure decision: `allowed`, or a typed deny reason that is safe to show an agent.
- `RedactionRegistry` scrubs values and tags document-scoped target elements.
- `BrowserSecretsError` and `toSafeError` carry fixed messages and codes only.
- `fixtures/conformance.json` holds one case per deny reason, the frame-ancestry rules, and every binding key. `runConformanceFixture` runs it.

## Destination bindings

A secret's binding comes from its static properties, which are fixed at import:

| Property           | Meaning                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| `sbm:origin`       | Required. Exact top-level page origin, for example `https://shop.example`.                              |
| `sbm:url-pattern`  | Optional. Top-level pathname pattern in `URLPattern` syntax, for example `/checkout*`. Empty means any. |
| `sbm:frame-origin` | Optional. Exact iframe origin. The secret then fills only into an iframe, never the top level.          |
| `sbm:selector`     | Optional. CSS selector the target element must match.                                                   |
| `sbm:fields`       | Optional. JSON map from payload key to CSS selector, for a JSON secret with several parts.              |

Without `sbm:origin` the secret is unbound and never fills. A malformed declared part makes the binding invalid, and the secret never fills; it never falls back to a looser binding. Unknown keys are kept on the `SecretRef` and ignored by the decision.

## Usage

```ts
import {
  authorize,
  BrowserSecretsError,
  createSecretRef,
  isSameDestination,
  RedactionRegistry,
  redactionEntries,
  requiredSelectors,
} from "@turnkey/browser-secrets";

const ref = createSecretRef({ secretId, name, staticProperties });
const request = { targets: [{ elementId: "e12" }] };

// The host evaluates these selectors on the live elements.
const selectors = requiredSelectors(ref, request);

const decision = authorize(ref, request, observation);
if (!decision.allowed) throw BrowserSecretsError.fromDecision(decision);

// Just before each write, authorize again with a fresh observation and
// check that the tab still shows the documents that were approved.
const current = authorize(ref, request, freshObservation);
if (!current.allowed) throw BrowserSecretsError.fromDecision(current);
if (!isSameDestination(decision, current))
  throw new BrowserSecretsError("destination_denied");

const registry = new RedactionRegistry(); // one per tenant and browser session
// Before injection. For a secret bound with sbm:fields this also registers
// each payload part, which the page receives one by one. Parts shorter than
// minValueLength, such as a CVC, are not text-scanned: keep the secrets
// listed in `unscanned` out of agent-visible text by other means.
const unscanned = registry.registerValues(redactionEntries(ref, plaintext));
registry.registerTarget({ ...identities, elementId: "e12" }, ref.secretId);

// In the snapshot serializer: elide registered targets, and any element
// whose value holds a copy of a secret (a re-rendered input, a summary).
const elide =
  registry.isRegisteredTarget(target) ||
  registry.findSecretIds(value).length > 0;

const safeOutput = registry.scrub(toolResult);
```

`observation` is a `TargetObservation` that the host builds from the browser: browser/session and tab identities, the live top-level URL, and for each target its element identity, the frame ancestry (frame and document identities, URL, and effective origin of each document), shadow-root mode, and selector-match evidence.

## Trust boundary

- The agent supplies secret IDs and host-owned element IDs only. An agent-supplied URL or page description is not a trusted observation.
- `authorize` checks the full frame ancestry: every intermediate frame must have the top-level origin or the bound frame origin. Opaque origins and documents that are not HTTP(S) (`about:blank`, `srcdoc`, `data:`, `blob:`) are refused. Same-origin iframes need `sbm:frame-origin` too.
- Hosts call `authorize` before export, after export or approval, and immediately before each write, each time with a fresh observation, and compare the decisions with `isSameDestination`. Each call is stateless, so without that comparison a tab that navigated to another bound page after approval still passes. This package does not make validation and injection atomic.
- `authorize` trusts the host's observation as given, including the `selectorMatches` booleans. The host adapter must read URLs, origins, and selector matches from the live browser where page script cannot change them.
- Text redaction catches the value and its common encodings (JSON, URL, HTML entities, base64 of the whole value, and case and Unicode normalization). Values of 8 or more letters and digits also match with any separators added, removed, or changed (at most 3 in a row), in any letter case and digit script, including percent-escaped copies. This covers input masks and formatters. It does not catch other transformed copies, screenshots, or live previews. An allowed destination receives the plaintext by design and can always encode it past the scan.
- Pages copy what they receive. Target tags do not follow copies into new elements, so snapshot serializers should also check element values with `findSecretIds`, or `findMatches` for a value split over several inputs.
- Values shorter than `minValueLength` (default 4) are not text-scanned. `registerValues` returns the IDs it skipped.
- JS strings cannot be zeroized; `releaseSecret` drops references only. Errors never include a raw Turnkey response, a caught error's message, or secret material.

## Not included yet

- The Turnkey backend (export, approval, decryption on `@turnkey/sdk-server`).
- Fill and resume orchestration, pending-fill storage, and typed delivery outcomes.
- Browser adapters. These stay in the host repositories.
