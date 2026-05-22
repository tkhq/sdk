import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { TurnkeyProvider } from "@turnkey/react-native-wallet-kit";
import { TURNKEY_CONFIG, TURNKEY_CALLBACKS } from "@/constants/turnkey";
import { AuthState, useTurnkey } from "@turnkey/react-native-wallet-kit";

function AuthGate() {
  const { authState } = useTurnkey();
  const isLoggedIn = authState === AuthState.Authenticated;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isLoggedIn}>
        <Stack.Screen name="(main)" />
        <Stack.Screen
          name="scanner"
          options={{
            presentation: "fullScreenModal",
            headerShown: true,
            headerTitle: "Scan QR Code",
          }}
        />
        <Stack.Screen
          name="payment"
          options={{
            presentation: "modal",
            headerShown: true,
            headerTitle: "Confirm Payment",
          }}
        />
      </Stack.Protected>

      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="index" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <TurnkeyProvider config={TURNKEY_CONFIG} callbacks={TURNKEY_CALLBACKS}>
        <AuthGate />
        <StatusBar style="light" />
      </TurnkeyProvider>
    </ThemeProvider>
  );
}
