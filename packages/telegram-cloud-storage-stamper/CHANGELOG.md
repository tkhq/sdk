# @turnkey/telegram-cloud-storage-stamper

## 2.1.0

### Minor Changes

- [#677](https://github.com/tkhq/sdk/pull/677) [`06347ad`](https://github.com/tkhq/sdk/commit/06347adfa08fb0867c350e43821d0fed06c49624) Author [@amircheikh](https://github.com/amircheikh) - SDK beta release @turnkey/react-wallet-kit @turnkey/core

### Patch Changes

- Updated dependencies [[`06347ad`](https://github.com/tkhq/sdk/commit/06347adfa08fb0867c350e43821d0fed06c49624)]:
  - @turnkey/api-key-stamper@0.5.0

## 2.1.0-beta.6

### Patch Changes

- Updated dependencies []:
  - @turnkey/api-key-stamper@0.5.0-beta.6

## 2.1.0-beta.5

### Minor Changes

- SDK beta release @turnkey/react-wallet-kit @turnkey/core

### Patch Changes

- Updated dependencies []:
  - @turnkey/api-key-stamper@0.5.0-beta.5

## 2.0.4-beta.4

### Patch Changes

- Updated dependencies []:
  - @turnkey/api-key-stamper@0.4.8-beta.4

## 2.0.4-beta.3

### Patch Changes

- Updated dependencies []:
  - @turnkey/api-key-stamper@0.4.8-beta.3

## 2.0.4-beta.2

### Patch Changes

- Updated dependencies []:
  - @turnkey/api-key-stamper@0.4.8-beta.2

## 2.0.4-beta.1

### Patch Changes

- Updated dependencies []:
  - @turnkey/api-key-stamper@0.4.8-beta.1

## 2.0.4-beta.0

### Patch Changes

- Updated dependencies []:
  - @turnkey/api-key-stamper@0.4.8-beta.0

## 2.0.3

### Patch Changes

- Updated dependencies [[`7625df0`](https://github.com/tkhq/sdk/commit/7625df0538002c3455bd5862211210e38472e164)]:
  - @turnkey/api-key-stamper@0.4.7

## 2.0.2

### Patch Changes

- Updated dependencies []:
  - @turnkey/api-key-stamper@0.4.6

## 2.0.1

### Patch Changes

- Updated dependencies [4d1d775]
  - @turnkey/api-key-stamper@0.4.5

## 2.0.0

### Major Changes

- 24ca647: Remove default export and used all named exports for consistency

  ### Package imports for `@turnkey/telegram-cloud-storage-stamper`

  #### for versions < v2.0.0

  ```typescript
  import TelegramCloudStorageStamper, {
    CloudStorageAPIKey,
  } from "@turnkey/telegram-cloud-storage-stamper";
  ```

  #### for versions >= v2.0.0

  ```typescript
  import {
    TelegramCloudStorageStamper,
    CloudStorageAPIKey,
  } from "@turnkey/telegram-cloud-storage-stamper";
  ```

## 1.0.3

### Patch Changes

- Updated dependencies [2d5977b]
  - @turnkey/api-key-stamper@0.4.4

## 1.0.2

### Patch Changes

- Export the default cloud storage api key location

## 1.0.1

### Patch Changes

- Update the default cloud storage key to conform to cloud storage key constraints

## 1.0.0

### Major Changes

- Initial release of the telegram-cloud-storage-stamper package. This package is to be used alongside Telegram mini-app development and provides a stamping utility and an interface into Telegram Cloud Storage. More can be read in the [README](../packages/telegram-cloud-storage-stamper/README.md).
