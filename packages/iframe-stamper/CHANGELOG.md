# @turnkey/iframe-stamper

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
