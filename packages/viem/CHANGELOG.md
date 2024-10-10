# @turnkey/viem

## 0.6.2

### Patch Changes

- Updated dependencies [9ebd062]
  - @turnkey/sdk-browser@1.8.0
  - @turnkey/sdk-server@1.5.0
  - @turnkey/http@2.15.0

## 0.6.1

### Patch Changes

- Updated dependencies [abe7138]
- Updated dependencies [96d7f99]
  - @turnkey/sdk-server@1.4.2
  - @turnkey/sdk-browser@1.7.1
  - @turnkey/http@2.14.2
  - @turnkey/api-key-stamper@0.4.3

## 0.6.0

### Minor Changes

- 2bb9ea0: Add synchronous createAccount variant (thank you @mshrieve)

  - Closes https://github.com/tkhq/sdk/issues/349
  - Originally attributed to https://github.com/tkhq/sdk/pull/348
  - Upshot: no change required if your setup was working. However, if you would like a synchronous option for creating a Viem account, now you may do so with `createAccountWithAddress`

### Patch Changes

- Updated dependencies [ff059d5]
- Updated dependencies [ff059d5]
  - @turnkey/sdk-browser@1.7.0
  - @turnkey/sdk-server@1.4.1
  - @turnkey/http@2.14.1
  - @turnkey/api-key-stamper@0.4.2

## 0.5.0

### Minor Changes

- 848f8d3: Support awaiting consensus and improve error handling

  - Add new error types that extend `BaseError` (and thus implement `error.walk`)
    - `TurnkeyConsensusNeededError` wraps consensus-related errors
    - `TurnkeyActivityError` wraps base Turnkey errors
  - Add a few new helper functions:
    - `serializeSignature` serializes a raw signature
    - `isTurnkeyActivityConsensusNeededError` and `isTurnkeyActivityError` use `error.walk` to check the type of a Viem error

### Patch Changes

- Updated dependencies [c988ed0]
- Updated dependencies [848f8d3]
  - @turnkey/sdk-browser@1.6.0
  - @turnkey/sdk-server@1.4.0
  - @turnkey/http@2.14.0

## 0.4.31

### Patch Changes

- Updated dependencies [1813ed5]
  - @turnkey/sdk-browser@1.5.0

## 0.4.30

### Patch Changes

- Updated dependencies [bab5393]
- Updated dependencies [a16073c]
- Updated dependencies [7e7d209]
  - @turnkey/sdk-browser@1.4.0

## 0.4.29

### Patch Changes

- Updated dependencies [93dee46]
  - @turnkey/http@2.13.0
  - @turnkey/sdk-browser@1.3.0
  - @turnkey/sdk-server@1.3.0

## 0.4.28

### Patch Changes

- Updated dependencies [e2f2e0b]
  - @turnkey/sdk-browser@1.2.4
  - @turnkey/sdk-server@1.2.4
  - @turnkey/http@2.12.3

## 0.4.27

### Patch Changes

- Updated dependencies
  - @turnkey/sdk-browser@1.2.3
  - @turnkey/sdk-server@1.2.3

## 0.4.26

### Patch Changes

- Updated dependencies [2d7e5a9]
- Updated dependencies [f4b607f]
  - @turnkey/api-key-stamper@0.4.1
  - @turnkey/http@2.12.2
  - @turnkey/sdk-browser@1.2.2
  - @turnkey/sdk-server@1.2.2

## 0.4.25

### Patch Changes

- Updated dependencies [f17a229]
  - @turnkey/http@2.12.1
  - @turnkey/sdk-browser@1.2.1
  - @turnkey/sdk-server@1.2.1

## 0.4.24

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.12.0
  - @turnkey/sdk-browser@1.2.0
  - @turnkey/sdk-server@1.2.0

## 0.4.23

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.11.0
  - @turnkey/sdk-browser@1.1.0
  - @turnkey/sdk-server@1.1.0

## 0.4.22

### Patch Changes

- Updated dependencies
  - @turnkey/sdk-browser@1.0.0
  - @turnkey/sdk-server@1.0.0

## 0.4.21

### Patch Changes

- @turnkey/sdk-browser@0.4.1

## 0.4.20

### Patch Changes

- d59e1b6: Add export of turnkey viem account functions
- Updated dependencies [e4b29da]
  - @turnkey/sdk-browser@0.4.0

## 0.4.19

### Patch Changes

- Updated dependencies [d409d81]
  - @turnkey/sdk-browser@0.3.0

## 0.4.18

### Patch Changes

- @turnkey/sdk-browser@0.2.1

## 0.4.17

### Patch Changes

- Updated dependencies
- Updated dependencies [e4d2a84]
  - @turnkey/sdk-browser@0.2.0
  - @turnkey/sdk-server@0.2.0

## 0.4.16

### Patch Changes

- Updated dependencies
  - @turnkey/sdk-browser@0.1.0
  - @turnkey/sdk-server@0.1.0

## 0.4.15

### Patch Changes

- a6502e6: Add support for new Turnkey Client types

## 0.4.14

### Patch Changes

- Updated dependencies [7a9ce7a]
  - @turnkey/http@2.10.0

## 0.4.13

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.9.1

## 0.4.12

### Patch Changes

- Updated dependencies [83b62b5]
  - @turnkey/http@2.9.0

## 0.4.11

### Patch Changes

- Updated dependencies [46a7d90]
  - @turnkey/http@2.8.0

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
