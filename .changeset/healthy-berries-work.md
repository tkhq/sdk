---
"@turnkey/sdk-browser": minor
---

Expose `getEmbeddedPublicKey()` via `TurnkeyIframeClient`. This can be used to fetch the live public key of the target embedded key living within an iframe.

Usage may look like the following:

```javascript
import { useTurnkey } from "@turnkey/sdk-react";

...

const { authIframeClient } = useTurnkey();

const publicKey = await authIframeClient!.getEmbeddedPublicKey();
```

Functionally, this can be useful for scenarios where the developer would like to verify whether an iframe has a live embedded key within it. This contrasts from the static `iframeStamper.iframePublicKey` exposed by `@turnkey/iframe-stamper`'s `publicKey()` method.
