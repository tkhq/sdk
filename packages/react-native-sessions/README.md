# **@turnkey/react-native-sessions**

[![npm](https://img.shields.io/npm/v/@turnkey/react-native-sessions?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/react-native-sessions)

This package provides a secure session management solution for React Native applications using Turnkey. It leverages [`react-native-keychain`](https://github.com/oblador/react-native-keychain) for secure storage and integrates with [`@turnkey/crypto`](../crypto/) to manage cryptographic operations.

## **Installation**

- Install the following dependencies in your React Native project:
  - [`react-native-keychain`](https://www.npmjs.com/package/react-native-keychain)
  - [`@turnkey/crypto`](../crypto/)
  - `@turnkey/react-native-sessions` (this package)
- Ensure your app is properly configured for secure storage and authentication.
- **You must polyfill random byte generation** to ensure `generateP256KeyPair` from `@turnkey/crypto` works properly by importing [`react-native-get-random-values`](https://www.npmjs.com/package/react-native-get-random-values) at the **entry point of your application**:

  ```tsx
  import "react-native-get-random-values";
  ```

---

## **Usage**

### **Wrapping Your App with the Provider**

```tsx
import { SessionProvider } from "@turnkey/react-native-sessions";
import { useRouter } from "expo-router";
import React from "react";

export const AppProviders = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();

  const sessionConfig = {
    onSessionCreated: () => {
      console.log("Session Created");
      router.replace("/dashboard");
    },
    onSessionExpired: () => {
      console.log("Session Expired");
      router.push("/");
    },
    onSessionCleared: () => {
      console.log("Session Cleared");
      router.push("/");
    },
  };

  return <SessionProvider config={sessionConfig}>{children}</SessionProvider>;
};
```

---

### **Creating a new Session**

```tsx
import { useSession } from "@turnkey/react-native-sessions";
import { PasskeyStamper } from "@turnkey/react-native-passkey-stamper";
import { TurnkeyClient } from "@turnkey/http";

const { createEmbeddedKey, createSession } = useSession();

const loginWithPasskey = async () => {
  try {
    const stamper = new PasskeyStamper({ rpId: RP_ID });
    const httpClient = new TurnkeyClient({ baseUrl: TURNKEY_API_URL }, stamper);

    const targetPublicKey = await createEmbeddedKey();

    const sessionResponse = await httpClient.createReadWriteSession({
      type: "ACTIVITY_TYPE_CREATE_READ_WRITE_SESSION_V2",
      timestampMs: Date.now().toString(),
      organizationId: TURNKEY_PARENT_ORG_ID,
      parameters: { targetPublicKey },
    });

    const credentialBundle =
      sessionResponse.activity.result.createReadWriteSessionResultV2
        ?.credentialBundle;

    if (credentialBundle) {
      await createSession(credentialBundle);
    }
  } catch (error) {
    console.error("Error during passkey login:", error);
  }
};
```

---

### **Using a Session**

```tsx
import { useSession } from "@turnkey/react-native-sessions";
import { TurnkeyClient, ApiKeyStamper } from "turnkey-sdk";
import { useState, useEffect } from "react";

const { session } = useSession();
const [client, setClient] = useState<TurnkeyClient | null>(null);

useEffect(() => {
  if (session) {
    const stamper = new ApiKeyStamper({
      apiPublicKey: session.publicKey,
      apiPrivateKey: session.privateKey,
    });
    const turnkeyClient = new TurnkeyClient(
      { baseUrl: TURNKEY_API_URL },
      stamper,
    );
    setClient(turnkeyClient);
  }
}, [session]);
```

---

## **Session Storage**

To enable secure authentication, two separate keychain entries are used:

- `turnkey-embedded-key`: Stores the private key that corresponds to the public key used when initiating the session request to Turnkey.
- `turnkey-session`: Stores the session credentials, including the private key, public key, and expiry time, which are decrypted from the credential bundle after a session is created.

---

## **Demo App**

Check out [this repository](https://github.com/tkhq/react-native-demo-wallet) for a full working example of session management in React Native.
