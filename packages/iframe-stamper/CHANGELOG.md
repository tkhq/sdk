# @turnkey/iframe-stamper

## 2.5.0

### Minor Changes

- e501690: Add new utility functions

  - Add `clearEmbeddedKey()` async function, which clears the embedded key within an iframe
  - Add `initEmbeddedKey()` async function, which reinitializes the embedded key within an iframe

## 2.4.0

### Minor Changes

- a833088: Add `getEmbeddedPublicKey()` async function to get the public key of the live embedded key within the iframe

## 2.3.0

### Minor Changes

- 9147962: Add `dangerouslyOverrideIframeKeyTtl` option to override iframe embedded key TTL (for longer lived read/write sessions)

## 2.2.0

### Minor Changes

- a216a47: Add `requestId` to iframe requests. This allows developers to send multiple requests at once to an iframe, and have the corresponding responses be handled correctly (in order)

## 2.1.0

### Minor Changes

- fad7c37: `@turnkey/iframe-stamper` - Implemented MessageChannel API for secure communication between the parent and iframe.

  @turnkey/sdk-browser - fixed spelling in package.json
  @turnkey/sdk-server - fixed spelling in package.json

## 2.0.0

### Major Changes

- 5d0bfde: Include `organizationId` and `userId` in injected import and export bundles.

### Minor Changes

- 2f2d09a: Add implementation for `applySettings()`
  - This is a function to apply settings on allowed parameters in the iframe.
  - Ultimately, this is used to style the HTML element used for plaintext in wallet and private key import.

### Patch Changes

- 976663e: Add `sandbox` attribute to iframe element

## 1.2.0

### Minor Changes

- 0281b88: Remove optional publicKey parameter from injectKeyExportBundle.
- 0e3584a: Add optional keyFormat and publicKey parameters to injectKeyExportBundle. Add extractKeyEncryptedBundle.

## 1.1.0

### Minor Changes

- 46a7d90: Add injectImportBundle and extractWalletEncryptedBundle to support wallet import.

## 1.0.0

### Major Changes

- This breaking change uses an HTML element instead of an ID to reference the iframe's container.

## 0.4.1

### Patch Changes

- Upgrade to Node v18 (#184)

## 0.4.0

### Minor Changes

- c98c222: - Add support for auth (e.g. via email), and include recovery under it. Note that the preferred path is now to use `injectCredentialBundle`, as opposed to `injectRecoveryBundle` (deprecated).

## 0.3.0

### Minor Changes

- Use rollup to build ESM and CommonJS, fix ESM support (#174)

## 0.2.1

### Patch Changes

- Catch and bubble up errors in the underlying iframe by listening to `ERROR` events (#165)

## 0.2.0

### Minor Changes

- Support wallet and private key export

## 0.1.0

Initial release
