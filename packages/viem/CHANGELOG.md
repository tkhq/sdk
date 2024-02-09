# @turnkey/viem

## 0.4.10

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.7.1

## 0.4.9

### Patch Changes

- Updated dependencies ([c3b423b], [d73725b])
  - @turnkey/api-key-stamper@0.4.0
  - @turnkey/http@2.7.0

## 0.4.8

### Patch Changes

- 4794c64: Updated dependencies

## 0.4.7

### Patch Changes

- Updated dependencies [f9d636c]
  - @turnkey/http@2.6.2

## 0.4.6

### Patch Changes

- Updated dependencies [52e2389]
  - @turnkey/http@2.6.1

## 0.4.5

### Patch Changes

- Updated dependencies [7a3c890]
  - @turnkey/http@2.6.0

## 0.4.4

### Patch Changes

- Upgrade to Node v18 (#184)
- Updated dependencies
  - @turnkey/api-key-stamper@0.3.1
  - @turnkey/http@2.5.1

## 0.4.3

### Patch Changes

- Updated dependencies [464ac0e]
  - @turnkey/http@2.5.0

## 0.4.2

### Patch Changes

- @turnkey/http@2.4.2

## 0.4.1

### Patch Changes

- Updated dependencies [f87ced8]
  - @turnkey/http@2.4.1

## 0.4.0

### Minor Changes

- Use rollup to build ESM and CommonJS, fix ESM support (#174)

### Patch Changes

- Updated dependencies [fc5b291]
  - @turnkey/api-key-stamper@0.3.0
  - @turnkey/http@2.4.0

## 0.3.4

### Patch Changes

- Updated dependencies
  - @turnkey/api-key-stamper@0.2.0
  - @turnkey/http@2.3.1

## 0.3.3

### Patch Changes

- Updated dependencies [f1bd68a]
  - @turnkey/http@2.3.0

## 0.3.2

### Patch Changes

- Updated dependencies [ed50a0f]
- Updated dependencies
  - @turnkey/http@2.2.0

## 0.3.0

### Minor Changes

- cf8631a: Update interface to support `signWith`

This change supports signing with wallet account addresses, private key addresses, or private key IDs. See below for an example:

```js
const httpClient = new TurnkeyClient(
  {
    baseUrl: "https://api.turnkey.com",
  },
  // This uses API key credentials.
  // If you're using passkeys, use `@turnkey/webauthn-stamper` to collect webauthn signatures:
  // new WebauthnStamper({...options...})
  new ApiKeyStamper({
    apiPublicKey: "...",
    apiPrivateKey: "...",
  })
);

// Create the Viem custom account
const turnkeyAccount = await createAccount({
  client: httpClient,
  organizationId: "...",
  signWith: "...",
  // optional; will be fetched from Turnkey if not provided
  ethereumAddress: "...",
});
```

## 0.2.7

### Patch Changes

- Updated dependencies [bb6ea0b]
  - @turnkey/http@2.1.0

## 0.2.6

### Patch Changes

- 59dcd2f: Unpin typescript
- da7c960: Bump Viem dependency to fix `getAddresses()` for LocalAccount
- Updated dependencies
  - @turnkey/http@2.0.0
- Updated the shape of signing

## 0.2.5

### Patch Changes

- Updated dependencies
  - @turnkey/http@1.3.0

## 0.2.4

### Patch Changes

- 0ec2d94: Addresses a bug when signing raw messages (see https://github.com/tkhq/sdk/issues/116)

## 0.2.3

### Patch Changes

- Updated dependencies
  - @turnkey/http@1.2.0

## 0.2.2

### Patch Changes

- Updated dependencies
  - @turnkey/api-key-stamper@0.1.1
  - @turnkey/http@1.1.1

## 0.2.1

### Patch Changes

- Fix code sample in the README; add more details and links

## 0.2.0

### Minor Changes

- Add new `createAccount` method and deprecates the existing `createApiAccount`. `createAccount` offers a superset of functionality and works with stampers (`@turnkey/api-key-stamper` / `@turnkey/webauthn-stamper`) to integrate with API keys or passkeys.

### Patch Changes

- Updated dependencies: @turnkey/http@1.1.0
- New dependency: @turnkey/api-key-stamper@0.1.0

## 0.1.1

### Patch Changes

- README updates

## 0.1.0

Initial release!
