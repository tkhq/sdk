# @turnkey/react-native-wallet-kit

The easiest and most powerful way to integrate Turnkey's Embedded Wallets into your React Native applications.

## Installation

```bash
npm install @turnkey/react-native-wallet-kit
# or
yarn add @turnkey/react-native-wallet-kit
```

### Peer Dependencies

This package requires the following peer dependencies:

```bash
npm install react react-native react-native-gesture-handler react-native-safe-area-context react-native-svg
```

## Quick Start

### 1. Wrap your app with WalletKitProvider

```tsx
import { WalletKitProvider } from '@turnkey/react-native-wallet-kit';

export default function App() {
  return (
    <WalletKitProvider
      config={{
        organizationId: 'your-organization-id',
        apiBaseUrl: 'https://api.turnkey.com', // optional
      }}
    >
      {/* Your app content */}
    </WalletKitProvider>
  );
}
```

### 2. Use the wallet hook

```tsx
import { useWallet, WalletButton } from '@turnkey/react-native-wallet-kit';

function WalletScreen() {
  const { wallet, isConnecting, connect, disconnect, isConnected } = useWallet();

  return (
    <View>
      {!isConnected ? (
        <WalletButton
          onPress={connect}
          title={isConnecting ? 'Connecting...' : 'Connect Wallet'}
          disabled={isConnecting}
        />
      ) : (
        <View>
          <Text>Connected to: {wallet?.name}</Text>
          <Text>Address: {wallet?.address}</Text>
          <WalletButton onPress={disconnect} title="Disconnect" />
        </View>
      )}
    </View>
  );
}
```

## API Reference

### Components

- `WalletKitProvider` - Context provider for wallet configuration
- `WalletButton` - Pre-styled button component for wallet actions

### Hooks

- `useWallet` - Main hook for wallet state and actions
- `useWalletKit` - Hook to access wallet kit configuration

### Types

- `WalletKitConfig` - Configuration interface
- `Wallet` - Wallet interface
- `AuthState` - Authentication state interface

## Development

This package is part of the Turnkey SDK monorepo. To build:

```bash
pnpm build
```

To run tests:

```bash
pnpm test
```

## License

MIT