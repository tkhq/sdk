# @turnkey/browser-secrets

Destination binding, target authorization, and output redaction for browser agents that fill stored secrets into web pages. It works with any secret store through a source contract. Turnkey is the default source.

> Status: early and unpublished (`private` in `package.json`). This version has the binding, decision, redaction, and source-contract core. It does not call Turnkey yet. The API can change before the first stable release.

## Scope

The package decides whether a secret may be written into a specific element on a live page, and it removes secret values from agent-facing output. It does not drive a browser. The host (for example Secure Browser MCP) owns browser automation, observes the page, and writes the value.

- `parseBinding` and `createSecretRef` read `sbm:*` static properties into a binding. They accept the same secrets as Secure Browser MCP.
- `matchesOrigin` and `matchesUrl` are the one origin and URL-pattern matcher. `URLPattern` comes from the global when it exists (Node 24+, workerd, browsers) and from `urlpattern-polyfill` otherwise. There is no weaker fallback.
- `authorize` is a pure decision: `allowed`, or a typed deny reason that is safe to show an agent.
- `RedactionRegistry` scrubs values and tags document-scoped target elements.
- `BrowserSecretsError` and `toSafeError` carry fixed messages and codes only.
- `SecretSource`, `requireSources`, `connectSource`, and `manifestSource` connect a secret store. See [Secret sources](#secret-sources).
- `fixtures/conformance.json` holds one case per deny reason, the frame-ancestry rules, and every binding key. `runConformanceFixture` runs it.

## Destination bindings

A secret's binding comes from its static properties. Turnkey sets them when the secret is imported, and they cannot change. A manifest-based source compiles them from operator config. Every source uses the same keys:

| Property           | Meaning                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| `sbm:origin`       | Required. Exact top-level page origin, for example `https://shop.example`.                              |
| `sbm:url-pattern`  | Optional. Top-level pathname pattern in `URLPattern` syntax, for example `/checkout*`. Empty means any. |
| `sbm:frame-origin` | Optional. Exact iframe origin. The secret then fills only into an iframe, never the top level.          |
| `sbm:selector`     | Optional. CSS selector the target element must match.                                                   |
| `sbm:fields`       | Optional. JSON map from payload key to CSS selector, for a JSON secret with several parts.              |

Without `sbm:origin` the secret is unbound and never fills. A malformed declared part makes the binding invalid, and the secret never fills; it never falls back to a looser binding. Unknown keys are kept on the `SecretRef` and ignored by the decision.

Each consumer owns one static property prefix and reads only its own keys. A new consumer picks a new prefix.

| Prefix   | Owner                                                    |
| -------- | -------------------------------------------------------- |
| `sbm:`   | Destination bindings, read by this package               |
| `valet:` | Valet                                                    |
| `op:`    | 1Password provenance, for example `op:ref`, `op:version` |
| `aws:`   | AWS Secrets Manager provenance                           |
| `demo:`  | Relay demo metadata                                      |

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

## Secret sources

A source is a secret store. It implements `SecretSource`: `id`, `capabilities`, `listRefs`, `export`, and `resume` (required when it supports approvals). `export` and `resume` return the value to the core, never to the agent, as one of:

- `ready`: `ciphertext` (encrypted to the core's per-request key) or `plaintext` (only for a source inside the trusted host). `expiresAt` marks a one-time code; pass it to `registerValue`.
- `pending`: waiting for approval. The handle is plain JSON. Persist it with the parked fill, encrypted, because `handle.state` can hold key material. Call `resume` with it; `resume` checks once and returns `pending` again until approvers act. When `handle.expiresAt` is past, `connectSource` returns `denied` with `expired` and does not call the source.
- `denied`: the source refused.
- `failed`: `submitted: "no"` means a retry is safe. `"unknown"` means do not retry on your own.

Denied and failed outcomes carry a fixed code and the IDs only. Wrap vendor errors with `toSourceReason`.

The host, never the agent, states what it requires. The defaults are strict: every guarantee Turnkey gives (approvals, bindings fixed at the source, policy on each export, a signed audit record, ciphertext delivery). `connectSource` refuses a source that does not meet them with a `source_refused` error and a typed reason, such as `approvals_required`. A host that accepts less names each guarantee it gives up:

```ts
const source = connectSource(turnkeySource); // strict defaults

const onePassword = manifestSource({
  id: "onepassword",
  entries: [
    {
      secretId: "op://<vaultId>/<itemId>",
      binding: { origin: "https://shop.example", urlPattern: "/login*" },
      properties: { "op:ref": "op://<vaultId>/<itemId>/password" },
    },
  ],
  resolve: async (entry) =>
    client.secrets.resolve(entry.properties!["op:ref"]!),
  verify: async (ref) => itemWebsiteMatches(ref.secretId, ref.binding!.origin),
  audit: "provider-log",
});
const selfHosted = connectSource(
  onePassword,
  requireSources({
    approvals: false,
    bindings: "any",
    exportPolicy: false,
    audit: "any",
    delivery: "any",
  }),
);
```

`connectSource` stamps each ref with `source` and `bindingProvenance`, rebuilds outcomes from known fields only, and turns a thrown error into `failed` with `submitted: "unknown"`. `manifestSource` lists its entries only, runs `verify` and then `resolve` on every export with no cache, and refuses an entry that does not bind. Each host connects one source.

`fixtures/source-outcomes.json` holds the scenarios every source must pass: ready, denied, unknown secret, failure before submission, unknown submission, approved, still pending, rejected, and expired. Run them with `runSourceConformance` and a harness that puts your backend (or a mock) into each scenario. A scenario that needs approvals is skipped for a source without them. A skipped scenario has `skipped: true` and counts as passing. A host that requires approvals must also check that no approval scenario was skipped.

### Cross-channel rule

A secret with `sbm:origin` leaves its source only through browser-secrets. A host that also delivers secrets another way (for example `valet-secrets run`, which puts values into a process environment) must not deliver a secret with `sbm:origin` that way, or the binding does not hold. Until Turnkey policy can enforce this (EMG-173, EMG-65), each host filters on `sbm:origin` before env-style delivery.

## Not included yet

- The Turnkey source (export, approval, decryption on `@turnkey/sdk-server`, EMG-165).
- Fill and resume orchestration, pending-fill storage, and typed delivery outcomes.
- Browser adapters. These stay in the host repositories.
