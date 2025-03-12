# @turnkey/sdk-react

The `@turnkey/sdk-react` package simplifies the integration of the Turnkey API into React-based applications. It builds on top of the `@turnkey/sdk-browser` package, enabling developers to implement authentication and wallet functionalities using React components.

## Overview

- **Authentication**: Supports email, passkey, phone, and social logins.
- **Wallet Operations**: Import and export wallets securely.
- **Client Utilities**: Includes `passkeyClient`, `authIframeClient`, and more.
- **Components**: Abstracts auth, session, import and export logic away from the developer and provides simple, easy to use plug-and-play components
- **Customization**: Theming options for your components to align with your application's design

Use `@turnkey/sdk-react` when building Next/React applications that interact with the Turnkey API.

## Installation

Install the package using npm or Yarn:

```bash
npm install @turnkey/sdk-react
```

## Initialization

Set up the `TurnkeyProvider` in your application entry point (e.g., `App.tsx`):

```tsx
import { TurnkeyProvider } from "@turnkey/sdk-react";

const turnkeyConfig = {
  apiBaseUrl: "https://api.turnkey.com",
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
  rpId: process.env.RPID, // Your application's domain for WebAuthn flows
  iframeUrl: "https://auth.turnkey.com",
  serverSignUrl: "http://localhost:3000/api", // Backend endpoint for signing operations (optional)
};

function App() {
  return (
    <TurnkeyProvider config={turnkeyConfig}>
      {/* Rest of the app */}
    </TurnkeyProvider>
  );
}

export default App;
```

## Using the React SDK

In components nested under the `TurnkeyProvider`, you can access Turnkey utilities using the `useTurnkey` hook:

```tsx
import { useTurnkey } from "@turnkey/sdk-react";

function ExampleComponent() {
  const { turnkey, passkeyClient, authIframeClient } = useTurnkey();

  const loginWithPasskey = async () => {
    // Creates a read only session with passkey
    await passkeyClient?.login();
  };

  const initEmailAuth = async () => {
    await turnkey?.serverSign("emailAuth", [
      {
        email: "<target user email>",
        targetPublicKey: authIframeClient.iframePublicKey,
        organizationId: "<target user suborg-id>",
      },
    ]);
  };

  const loginWithIframe = async (credentialBundle: string) => {
    await authIframeClient?.loginWithAuthBundle(credentialBundle); // Creates a read write session using a credential bundle returned from OTP Auth, Oauth, or Create Read Write session activities
  };

  return (
    <div>
      <button onClick={loginWithPasskey}>Login with Passkey</button>
      <button onClick={() => initEmailAuth()}>Initialize Email Auth</button>
    </div>
  );
}

export default ExampleComponent;
```

## Components

All components require **Next.js 13+** with the [/app directory structure](https://nextjs.org/docs/app) to leverage server actions. Before using components be sure to Import Turnkey's default styles in your `layout.tsx` or equivalent entry point:

```tsx
import "@turnkey/sdk-react/styles";
```

### Authentication

The `Auth` component provides a complete authentication solution with support for various login methods.

#### Example

```tsx
import { Auth } from "@turnkey/sdk-react";
import { toast } from "sonner";

function AuthPage() {
  const handleAuthSuccess = () => {
    console.log("Auth successful!");
  };

  const handleAuthError = (errorMessage: string) => {
    toast.error(errorMessage);
  };

  const authConfig = {
    emailEnabled: true,
    passkeyEnabled: true,
    phoneEnabled: false,
    googleEnabled: true,
    appleEnabled: false,
    facebookEnabled: false,
    sessionLengthSeconds: 3600, //1 hour r/w session
  };

  const configOrder = ["socials", "email", "phone", "passkey"];

  return (
    <Auth
      authConfig={authConfig}
      configOrder={configOrder}
      onAuthSuccess={handleAuthSuccess}
      onError={handleAuthError}
    />
  );
}

export default AuthPage;
```

### Wallet Import and Export

#### Import Wallet Example

```tsx
import { Import } from "@turnkey/sdk-react";
import { toast } from "sonner";

function ImportWallet() {
  const handleImportSuccess = () => {
    toast.success("Wallet successfully imported!");
  };

  const handleImportError = (errorMessage: string) => {
    toast.error(errorMessage);
  };

  return (
    <Import
      onHandleImportSuccess={handleImportSuccess}
      onError={handleImportError}
    />
  );
}

export default ImportWallet;
```

#### Export Wallet Example

```tsx
import { Export } from "@turnkey/sdk-react";
import { toast } from "sonner";

function ExportWallet() {
  const walletId = "your-wallet-id";

  const handleExportSuccess = () => {
    toast.success("Wallet successfully exported!");
  };

  const handleExportError = (errorMessage: string) => {
    toast.error(errorMessage);
  };

  return (
    <Export
      walletId={walletId}
      onHandleExportSuccess={handleExportSuccess}
      onError={handleExportError}
    />
  );
}

export default ExportWallet;
```

## Theming with `TurnkeyThemeProvider`

Customize Turnkey components using CSS variables with the `TurnkeyThemeProvider`.

#### Example

```tsx
import { TurnkeyThemeProvider } from "@turnkey/sdk-react";

const customTheme = {
  "--text-primary": "#333333",
  "--button-bg": "#4c48ff",
  "--button-hover-bg": "#3b38e6",
};

export default function App() {
  return (
    <TurnkeyThemeProvider theme={customTheme}>
      <YourComponent />
    </TurnkeyThemeProvider>
  );
}
```

## Code Examples

For detailed examples and advanced use cases, refer to our documentation [here](https://docs.turnkey.com/)
