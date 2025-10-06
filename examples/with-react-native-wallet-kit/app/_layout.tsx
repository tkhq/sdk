import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

// Polyfills must be early to satisfy crypto/random usage across dependencies
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import '@walletconnect/react-native-compat';
import { Buffer } from 'buffer';
(global as any).Buffer = (global as any).Buffer || Buffer;

import { TurnkeyProvider } from '@turnkey/react-native-wallet-kit';
import { TURNKEY_CONFIG, TURNKEY_CALLBACKS } from '@/constants/turnkey';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <TurnkeyProvider config={TURNKEY_CONFIG} callbacks={TURNKEY_CALLBACKS}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="otp" options={{ headerShown: false }} />
          <Stack.Screen name="(main)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </TurnkeyProvider>
    </ThemeProvider>
  );
}
