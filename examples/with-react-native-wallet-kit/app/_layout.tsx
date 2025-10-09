import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { TurnkeyProvider } from "@turnkey/react-native-wallet-kit";
import { TURNKEY_CONFIG, TURNKEY_CALLBACKS } from "@/constants/turnkey";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthState, useTurnkey } from "@turnkey/react-native-wallet-kit";

function AuthGate() {
  const { authState } = useTurnkey();
  const isLoggedIn = authState === AuthState.Authenticated;
  return (
    <Stack>
      <Stack.Protected guard={isLoggedIn}>
        <Stack.Screen name="(main)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack.Protected>

      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="otp" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <TurnkeyProvider config={TURNKEY_CONFIG} callbacks={TURNKEY_CALLBACKS}>
        <AuthGate />
        <StatusBar style="auto" />
      </TurnkeyProvider>
    </ThemeProvider>
  );
}
