import { registerRootComponent } from "expo";
import { ExpoRoot } from "expo-router";

// Polyfills must be early to satisfy crypto/random usage across dependencies
import "react-native-get-random-values";

// WalletConnect React Native compatibility shim — must come before WC imports
import "@walletconnect/react-native-compat";

// https://docs.expo.dev/router/reference/troubleshooting/#expo_router_app_root-not-defined
export function App() {
  const ctx = require.context("./app");
  return <ExpoRoot context={ctx} />;
}

registerRootComponent(App);
