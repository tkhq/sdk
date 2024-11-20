# @turnkey/cosmjs

## 0.6.3

### Patch Changes

- Updated dependencies [8bea78f]
  - @turnkey/sdk-browser@1.10.0

## 0.6.2

### Patch Changes

- Updated dependencies [3dd74ac]
- Updated dependencies [1e36edf]
- Updated dependencies [4df8914]
- Updated dependencies [11a9e2f]
  - @turnkey/sdk-browser@1.9.0
  - @turnkey/sdk-server@1.6.0
  - @turnkey/http@2.16.0

## 0.6.1

### Patch Changes

- Updated dependencies [9ebd062]
  - @turnkey/sdk-browser@1.8.0
  - @turnkey/sdk-server@1.5.0
  - @turnkey/http@2.15.0

## 0.6.0

### Minor Changes

- 5e60923: Add compatibility with wallet accounts and @turnkey/sdk-browser and @turnkey/sdk-server

### Patch Changes

- Updated dependencies [abe7138]
- Updated dependencies [96d7f99]
  - @turnkey/sdk-server@1.4.2
  - @turnkey/sdk-browser@1.7.1
  - @turnkey/http@2.14.2
  - @turnkey/api-key-stamper@0.4.3

## 0.5.21

### Patch Changes

- Updated dependencies [ff059d5]
  - @turnkey/http@2.14.1

## 0.5.20

### Patch Changes

- Updated dependencies [848f8d3]
  - @turnkey/http@2.14.0

## 0.5.19

### Patch Changes

- Updated dependencies [93dee46]
  - @turnkey/http@2.13.0

## 0.5.18

### Patch Changes

- Updated dependencies [e2f2e0b]
  - @turnkey/http@2.12.3

## 0.5.17

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.12.2

## 0.5.16

### Patch Changes

- Updated dependencies [f17a229]
  - @turnkey/http@2.12.1

## 0.5.15

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.12.0

## 0.5.14

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.11.0

## 0.5.13

### Patch Changes

- Updated dependencies [7a9ce7a]
  - @turnkey/http@2.10.0

## 0.5.12

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.9.1

## 0.5.11

### Patch Changes

- Updated dependencies [83b62b5]
  - @turnkey/http@2.9.0

## 0.5.10

### Patch Changes

- Updated dependencies [46a7d90]
  - @turnkey/http@2.8.0

## 0.5.9

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.7.1

## 0.5.8

### Patch Changes

- Updated dependencies [d73725b]
  - @turnkey/http@2.7.0

## 0.5.7

### Patch Changes

- Updated dependencies [f9d636c]
  - @turnkey/http@2.6.2

## 0.5.6

### Patch Changes

- Updated dependencies [52e2389]
  - @turnkey/http@2.6.1

## 0.5.5

### Patch Changes

- Updated dependencies [7a3c890]
  - @turnkey/http@2.6.0

## 0.5.4

### Patch Changes

- Upgrade to Node v18 (#184)
- Updated dependencies
  - @turnkey/http@2.5.1

## 0.5.3

### Patch Changes

- Updated dependencies [464ac0e]
  - @turnkey/http@2.5.0

## 0.5.2

### Patch Changes

- @turnkey/http@2.4.2

## 0.5.1

### Patch Changes

- Updated dependencies [f87ced8]
  - @turnkey/http@2.4.1

## 0.5.0

### Minor Changes

- Use rollup to build ESM and CommonJS, fix ESM support (#174)

### Patch Changes

- Updated dependencies [fc5b291]
  - @turnkey/http@2.4.0

## 0.4.14

### Patch Changes

- @turnkey/http@2.3.1

## 0.4.13

### Patch Changes

- Updated dependencies [f1bd68a]
  - @turnkey/http@2.3.0

## 0.4.12

### Patch Changes

- Updated dependencies [ed50a0f]
- Updated dependencies
  - @turnkey/http@2.2.0

## 0.4.11

### Patch Changes

- Updated dependencies [bb6ea0b]
  - @turnkey/http@2.1.0

## 0.4.10

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.0.0
- Updated the shape of signing

## 0.4.9

### Patch Changes

- Updated dependencies
  - @turnkey/http@1.3.0

## 0.4.8

### Patch Changes

- Updated dependencies
  - @turnkey/http@1.2.0

## 0.4.7

### Patch Changes

- @turnkey/http@1.1.1

## 0.4.6

### Patch Changes

- Updated dependencies
  - @turnkey/http@1.1.0

## 0.4.5

### Patch Changes

- Updated dependencies [8d1d0e8]
  - @turnkey/http@1.0.1

## 0.4.4

### Patch Changes

- 46473ec: This breaking change updates generated code to be shorter and more intuitive to read:

  - generated fetchers do not include the HTTP method in their name. For example `useGetGetActivity` is now `useGetActivity`, and `usePostSignTransaction` is `useSignTransaction`.
  - input types follow the same convention (no HTTP method in the name): `TPostCreatePrivateKeysInput` is now `TCreatePrivateKeysInput`.
  - the "federated" request helpers introduced in `0.18.0` are now named "signed" requests to better reflect what they are. `FederatedRequest` is now `SignedRequest`, and generated types follow. For example: `federatedPostCreatePrivateKeys` is now `signCreatePrivateKeys`, `federatedGetGetActivity` is now `signGetActivity`, and so on.

  The name updates should be automatically suggested if you use VSCode since the new names are simply shorter versions of the old one.

- Updated dependencies [46473ec]
- Updated dependencies [38b424f]
  - @turnkey/http@1.0.0

## 0.4.3

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.18.1

## 0.4.2

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.18.0

## 0.4.1

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.17.1

## 0.4.0

### Minor Changes

- No public facing changes

### Patch Changes

- Updated dependencies [9317f51]
  - @turnkey/http@0.17.0

## 0.3.0

### Minor Changes

- No public facing changes

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.16.0
    - Fix `.postGetPrivateKey(...)`'s underlying path, while adding `@deprecated` `.postGetPrivateKeyBackwardsCompat(...)` for backward compatibility

## 0.2.1

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.15.0

## 0.2.0

### Minor Changes

- Moved `sha256` hashing from local to remote

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.14.0

## 0.1.1

### Patch Changes

- New `TurnkeyRequestError` error class that contains rich error details
- Updated dependencies
  - @turnkey/http@0.13.2

## 0.1.0

- Initial release
