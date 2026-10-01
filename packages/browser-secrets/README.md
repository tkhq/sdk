# @turnkey/browser-secrets

Destination binding, target authorization, and output redaction for browser agents that fill Turnkey secrets into web pages.

> Status: early and unpublished (`private` in `package.json`). This version has the binding, decision, and redaction core only. It does not call Turnkey yet. The API can change before the first stable release.

## Scope

The package decides whether a secret may be written into a specific element on a live page, and it removes secret values from agent-facing output. It does not drive a browser. The host (for example Secure Browser MCP) owns browser automation, observes the page, and writes the value.

This release contains:

- Types for secret references, destination bindings, fill requests, and trusted target observations.
- Parsing of `sbm:*` static properties into a binding (`parseBinding`, `createSecretRef`). It accepts the same secrets as Secure Browser MCP.
- One origin and URL-pattern matcher (`matchesOrigin`, `matchesUrl`) with a `URLPattern` loader. The loader uses the global `URLPattern` when it exists (Node 24+, workerd, browsers) and `urlpattern-polyfill` otherwise (Node 20 and 22). It never falls back to a weaker wildcard.
- A pure authorization decision (`authorize`) that returns `allowed` or a typed deny reason.
- A redaction registry (`RedactionRegistry`) for values and document-scoped target identities.
- Typed safe errors (`BrowserSecretsError`, `toSafeError`) with fixed messages.
- JSON conformance fixtures in `fixtures/`.

## Destination bindings

A secret's binding comes from its static properties, which are fixed at import:

| Property           | Meaning                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `sbm:origin`       | Required. Exact top-level page origin, for example `https://shop.example`.                                                |
| `sbm:url-pattern`  | Optional. Top-level pathname pattern in `URLPattern` syntax, for example `/checkout*`. An empty value constrains nothing. |
| `sbm:frame-origin` | Optional. Exact iframe origin. The secret then fills only into an iframe, never the top level.                            |
| `sbm:selector`     | Optional. CSS selector the target element must match.                                                                     |
| `sbm:fields`       | Optional. JSON map from payload key to CSS selector, for a JSON secret with several parts.                                |

Parsing follows Secure Browser MCP, so existing secrets keep working:

- Without `sbm:origin`, the secret is unbound, even if it has other `sbm:` keys. An unbound secret never fills.
- `sbm:origin` must be an exact, serialized origin: `new URL(value).origin` equals the value and is not `"null"`. Only HTTP(S) pages can match it.
- `sbm:url-pattern` is valid when `new URLPattern({ pathname, baseURL: origin })` succeeds.
- Unknown `sbm:` keys and keys outside the `sbm:` namespace, such as relay `demo:*` keys, are kept on the `SecretRef` and ignored by the decision.

A malformed declared part makes the binding invalid, and the secret never fills. A malformed part never falls back to a looser binding.

A request may name one element under two different keys. The same key and element twice is a duplicate.

## Usage

```ts
import {
  authorize,
  BrowserSecretsError,
  createSecretRef,
  RedactionRegistry,
  requiredSelectors,
} from "@turnkey/browser-secrets";

const ref = createSecretRef({ secretId, name, staticProperties });
const request = { targets: [{ elementId: "e12" }] };

// The host evaluates these selectors on the live elements.
const selectors = requiredSelectors(ref, request);

const decision = authorize(ref, request, observation);
if (!decision.allowed) throw BrowserSecretsError.fromDecision(decision);

const registry = new RedactionRegistry(); // one per tenant and browser session
registry.registerValue(plaintext, ref.secretId); // before injection
registry.registerTarget({ ...identities, elementId: "e12" }, ref.secretId);
const safeOutput = registry.scrub(toolResult);
```

`observation` is a `TargetObservation` that the host builds from the browser: browser/session and tab identities, the live top-level URL, and for each target its element identity, the frame ancestry (frame and document identities, URL, and effective origin of each document), shadow-root mode, and selector-match evidence.

## Trust boundary

- The agent supplies secret IDs and host-owned element IDs only. An agent-supplied URL or page description is not a trusted observation.
- `authorize` checks the top-level origin and pathname separately from the target frame. It checks the full frame ancestry: every intermediate frame must have the top-level origin or the bound frame origin. Opaque origins and documents that are not HTTP(S) (`about:blank`, `srcdoc`, `data:`, `blob:`) are refused. Same-origin iframes need `sbm:frame-origin` too.
- Hosts call `authorize` before export, after export or approval, and immediately before each write, each time with a fresh observation. Validation and injection are separate browser operations. This package does not make them atomic.
- An allowed destination receives the plaintext by design. A compromised allowed site is outside the threat model.
- The package does not protect secrets from its embedding host process. JS strings cannot be zeroized; `releaseSecret` drops references only.
- Text redaction does not cover screenshots, live previews, recordings, or transformed copies of a secret. Hosts must restrict those output paths separately.
- Errors carry fixed messages and codes. They never include a raw Turnkey response, a caught error's message, or secret material.

## Conformance fixtures

`fixtures/*.json` hold binding-parse and authorization cases taken from Secure Browser MCP and its iframe work. Each case has an input (static properties, or secret, request, and observation), an expected result, and the test it came from. Host adapters and any future port must reproduce every result. In JavaScript, run them with `runConformanceFixture`:

```ts
import fixture from "@turnkey/browser-secrets/fixtures/authorize-frames.json";
import { runConformanceFixture } from "@turnkey/browser-secrets";

const failed = runConformanceFixture(fixture).filter((r) => !r.pass);
```

The jest suite runs every fixture with the runtime's `URLPattern` and again with the polyfill. The `internal/workers-e2e` check runs them in workerd.

## Not included yet

- The Turnkey backend (export, approval, decryption on `@turnkey/sdk-server`).
- Fill and resume orchestration with request binding, the `PendingStore` interface with atomic claims, and typed delivery outcomes.
- Registered-recipient ciphertext release.
- Browser adapters. These stay in the host repositories.
