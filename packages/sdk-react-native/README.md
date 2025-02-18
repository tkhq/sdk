# **@turnkey/sdk-react-native**

[![npm](https://img.shields.io/npm/v/@turnkey/sdk-react-native?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/sdk-react-native)

The `@turnkey/sdk-react-native` package simplifies the integration of the Turnkey API into React Native applications. It provides secure session management, authentication, and cryptographic operations using [`react-native-keychain`](https://github.com/oblador/react-native-keychain), [`@turnkey/crypto`](../crypto/), [`@turnkey/api-key-stamper`](../api-key-stamper/), and [`@turnkey/http`](../http/).

## **Installation**

- Install the following dependencies in your React Native project:
  - [`react-native-keychain`](https://www.npmjs.com/package/react-native-keychain)
  - [`@turnkey/crypto`](../crypto/)
  - [`@turnkey/api-key-stamper`](../api-key-stamper/)
  - [`@turnkey/http`](../http/)
  - `@turnkey/sdk-react-native` (this package)
- Ensure your app is properly configured for secure storage and authentication.
- **You must polyfill random byte generation** to ensure `generateP256KeyPair` from `@turnkey/crypto` works properly by importing [`react-native-get-random-values`](https://www.npmjs.com/package/react-native-get-random-values) at the **entry point of your application**:

  ```tsx
  import "react-native-get-random-values";
  ```

---

## **Usage**

### **Wrapping Your App with the Provider**

```tsx
import { TurnkeyProvider } from "@turnkey/sdk-react-native";
import { useRouter } from "expo-router";
import React from "react";

export const AppProviders = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();

  const turnkeyConfig = {
    apiBaseUrl: "https://api.turnkey.com",
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

  return <TurnkeyProvider config={turnkeyConfig}>{children}</TurnkeyProvider>;
};
```

---

### **Creating a new Session**

```tsx
import { useTurnkey } from "@turnkey/sdk-react-native";
import { PasskeyStamper } from "@turnkey/react-native-passkey-stamper";
import { TurnkeyClient } from "@turnkey/http";

const { createEmbeddedKey, createSession } = useTurnkey();

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
import { useTurnkey } from "@turnkey/sdk-react-native";

const { user, client, refreshUser } = useTurnkey();

const createWallet = async ({
  walletName,
  accounts,
  mnemonicLength,
}: {
  walletName: string;
  accounts: WalletAccountParams[];
  mnemonicLength?: number;
}): Promise<void> => {
  try {
    if (client == null || user == null) {
      throw new Error("Client or user not initialized");
    }

    const response = await client.createWallet({
      type: "ACTIVITY_TYPE_CREATE_WALLET",
      timestampMs: Date.now().toString(),
      organizationId: user.organizationId,
      parameters: {
        walletName,
        accounts,
        mnemonicLength,
      },
    });

    if (response.activity.result.createWalletResult?.walletId != null) {
      await refreshUser();
    }
  } catch (error: any) {
    throw error;
  }
};
```

---

## **Session Storage**

To enable secure authentication, two separate keychain entries are used:

- `turnkey-embedded-key`: Stores the private key that corresponds to the public key used when initiating the session request to Turnkey.
- `turnkey-session`: Stores the session credentials, including the private key, public key, and expiry time, which are decrypted from the credential bundle after a session is created.

---

## **Demo App**

Check out [this repository](https://github.com/tkhq/react-native-demo-wallet) for a full working example of session management in React Native.
