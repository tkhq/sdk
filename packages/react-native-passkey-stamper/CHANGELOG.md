# @turnkey/react-native-passkey-stamper

## 1.0.0

### Major Changes

Upgrade react-native-passkey to 3.0.0 (see [release notes](https://github.com/f-23/react-native-passkey/releases/tag/v3.0.0)). Among other things you can now specify `withSecurityKey` and `withPlatformKey` (new optional arguments to `createPasskey`) to target platform passkeys or security keys on iOS. The same options can be passed as configuration to `PasskeyStamper` to target these features at authentication time.

This is a major change because the `transports` property, previously a string array (`Array<string>`) is now an array of enums (`Array<AuthenticatorTransport>`).

## 0.2.16

### Patch Changes

- Updated dependencies [4df8914]
  - @turnkey/http@2.16.0

## 0.2.15

### Patch Changes

- Updated dependencies [9ebd062]
  - @turnkey/http@2.15.0

## 0.2.14

### Patch Changes

- Updated dependencies [e5c4fe9]
- Updated dependencies [96d7f99]
  - @turnkey/encoding@0.4.0
  - @turnkey/http@2.14.2

## 0.2.13

### Patch Changes

- Updated dependencies [ff059d5]
- Updated dependencies [93666ff]
  - @turnkey/http@2.14.1
  - @turnkey/encoding@0.3.0

## 0.2.12

### Patch Changes

- Updated dependencies [848f8d3]
  - @turnkey/http@2.14.0

## 0.2.11

### Patch Changes

- Updated dependencies [93dee46]
  - @turnkey/http@2.13.0

## 0.2.10

### Patch Changes

- Updated dependencies [e2f2e0b]
  - @turnkey/http@2.12.3

## 0.2.9

### Patch Changes

- Updated dependencies
  - @turnkey/encoding@0.2.1
  - @turnkey/http@2.12.2

## 0.2.8

### Patch Changes

- Updated dependencies [f17a229]
  - @turnkey/http@2.12.1

## 0.2.7

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.12.0

## 0.2.6

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.11.0

## 0.2.5

### Patch Changes

- Updated dependencies [7a9ce7a]
  - @turnkey/http@2.10.0

## 0.2.4

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.9.1

## 0.2.3

### Patch Changes

- Updated dependencies [83b62b5]
  - @turnkey/http@2.9.0

## 0.2.2

### Patch Changes

- Updated dependencies [46a7d90]
  - @turnkey/http@2.8.0

## 0.2.1

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.7.1

## 0.2.0

### Minor Changes

- Introduce `@turnkey/encoding` to consolidate utility functions
- Updated dependencies [d73725b]
  - @turnkey/encoding@0.1.0
  - @turnkey/http@2.7.0

## 0.1.0

Initial release
