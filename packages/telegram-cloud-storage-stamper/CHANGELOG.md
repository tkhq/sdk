# @turnkey/telegram-cloud-storage-stamper

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
