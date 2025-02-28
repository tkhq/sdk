---
"@turnkey/telegram-cloud-storage-stamper": major
---

Remove default export and used all named exports for consistency

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
