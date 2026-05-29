import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, randomBytes } from "@noble/hashes/utils";
import { useTurnkey } from "@turnkey/react-native-wallet-kit";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { IOS_CLIENT_ID } from "@/constants/turnkey";
import { TurnkeyLogo } from "@/components/TurnkeyLogo";
import { Platform } from "react-native";

// Needed for WebBrowser on web; no-op on native
WebBrowser.maybeCompleteAuthSession();

const base64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

// Derives the iOS reversed-client-ID URL scheme from the client ID.
// e.g. "xxx.apps.googleusercontent.com" → "com.googleusercontent.apps.xxx"
const iosScheme = (clientId: string) => clientId.split(".").reverse().join(".");

export default function LoginScreen() {
  const { completeOauth, createApiKeyPair } = useTurnkey();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      // 1. Generate ephemeral key pair — public key becomes the nonce binding
      const publicKey = await createApiKeyPair();

      // 2. Compute nonce as hex(sha256(publicKey)) — stored verbatim in the JWT
      //    by the browser flow, matching Turnkey's expected format exactly.
      const nonce = bytesToHex(sha256(publicKey));

      // 3. PKCE: code_verifier + code_challenge
      const codeVerifier = base64url(randomBytes(32));
      const codeChallenge = base64url(
        sha256(new TextEncoder().encode(codeVerifier)),
      );

      const scheme = iosScheme(IOS_CLIENT_ID);
      const redirectUri = `${scheme}:/oauth2redirect`;

      // 4. Open Google OAuth in ASWebAuthenticationSession (iOS system browser)
      const params = new URLSearchParams({
        client_id: IOS_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state: bytesToHex(randomBytes(8)),
      });

      const result = await WebBrowser.openAuthSessionAsync(
        `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
        redirectUri,
      );

      if (result.type !== "success") return;

      // 5. Extract auth code from redirect
      const queryString = result.url.split("?")[1] ?? "";
      const code = new URLSearchParams(queryString).get("code");
      if (!code) throw new Error("No authorization code in redirect");

      // 6. Exchange code for tokens (no client_secret needed for iOS clients)
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: IOS_CLIENT_ID,
          code,
          code_verifier: codeVerifier,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }).toString(),
      });

      const tokens = await tokenRes.json();
      if (!tokens.id_token) throw new Error("No id_token in token response");

      // 7. Complete OAuth with Turnkey — id_token.aud = IOS_CLIENT_ID,
      //    id_token.nonce = hex(sha256(publicKey)) ← matches Turnkey's check
      await completeOauth({ oidcToken: tokens.id_token, publicKey });
    } catch (error) {
      console.error("Sign-in failed:", error);
      Alert.alert(
        "Sign-in failed",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <TurnkeyLogo width={140} />
          <Text style={[styles.demoLabel, { color: colors.secondaryText }]}>
            OAuth Cross-Platform Demo
            {Platform.OS === "ios" ? " (iOS)" : " (Android)"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
            Sign in with the same Google account you used on the web app to
            confirm your identity resolves across platforms.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.googleButton, { borderColor: colors.buttonBorder }]}
          onPress={handleGoogleSignIn}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#4285F4" />
          ) : (
            <View style={styles.googleButtonContent}>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 48,
    gap: 12,
  },
  demoLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  },
  googleButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  googleButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#4285F4",
  },
  googleButtonText: {
    color: "#3C4043",
    fontSize: 16,
    fontWeight: "600",
  },
});
