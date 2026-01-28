import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { EmailInput, validateEmail } from "@/components/auth/email-input";
import { SecondaryButton } from "@/components/ui/secondary-button";
import { AuthState, useTurnkey } from "@turnkey/react-native-wallet-kit";
import { OtpType } from "@/types/types";

const customWallet = {
  walletName: "Default Wallet",
  walletAccounts: [
    {
      curve: "CURVE_SECP256K1" as const,
      pathFormat: "PATH_FORMAT_BIP32" as const,
      path: `m/44'/60'/0'/0/0`,
      addressFormat: "ADDRESS_FORMAT_ETHEREUM" as const,
    },
  ],
};

export default function LoginScreen() {
  const router = useRouter();
  const {
    initOtp,
    signUpWithPasskey,
    loginWithPasskey,
    handleGoogleOauth,
    handleXOauth,
    handleDiscordOauth,
    handleFacebookOauth,
    handleAppleOauth,
    authState,
  } = useTurnkey();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = async () => {
    if (!validateEmail(email)) {
      setEmailError(true);
      Alert.alert("Invalid Email", "Please enter a valid email address");
      return;
    }

    setLoading(true);

    const otpId = await initOtp({
      otpType: OtpType.Email,
      contact: email,
    });

    if (!otpId) {
      Alert.alert("Error", "Failed to initialize OTP");
      return;
    }

    setEmailError(false);
    setLoading(false);

    router.push({
      pathname: "/otp",
      params: { email, otpId },
    });
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (emailError) {
      setEmailError(false);
    }
  };

  const handleSignUpWithPasskeyPress = async () => {
    try {
      setLoading(true);
      console.log("signing up with passkey");
      await signUpWithPasskey({
        passkeyDisplayName: "DefaultPasskey",
        createSubOrgParams: {
          customWallet,
        },
      });
    } catch (error) {
      console.error("Error signing up with passkey", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginWithPasskeyPress = async () => {
    try {
      setLoading(true);
      await loginWithPasskey();
    } catch (error) {
      console.error("Error logging in with passkey", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleOauthPress = async () => {
    try {
      setLoading(true);

      await handleGoogleOauth();
    } catch (error) {
      console.error("Error signing in with Google", error);
    } finally {
      setLoading(false);
    }
  };

  const handleXOauthPress = async () => {
    try {
      setLoading(true);
      console.log("signing in with X");
      await handleXOauth();
    } catch (error) {
      console.error("Error signing in with X", error);
      Alert.alert("Error", `Failed to sign in with X: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscordOauthPress = async () => {
    try {
      setLoading(true);
      console.log("signing in with Discord");
      await handleDiscordOauth();
    } catch (error) {
      console.error("Error signing in with Discord", error);
      Alert.alert("Error", `Failed to sign in with Discord: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookOauthPress = async () => {
    try {
      setLoading(true);
      console.log("signing in with Facebook");
      await handleFacebookOauth();
    } catch (error) {
      console.error("Error signing in with Facebook", error);
      Alert.alert("Error", `Failed to sign in with Facebook: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleOauthPress = async () => {
    try {
      setLoading(true);
      console.log("signing in with Apple");
      await handleAppleOauth();
    } catch (error) {
      console.error("Error signing in with Apple", error);
      Alert.alert("Error", `Failed to sign in with Apple: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            {/* Logo */}
            <Text style={[styles.logo, { color: colors.primaryText }]}>
              Turnkey
            </Text>

            {/* Title */}
            <Text style={[styles.title, { color: colors.primaryText }]}>
              Log in or sign up
            </Text>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <EmailInput
                value={email}
                onChangeText={handleEmailChange}
                error={emailError}
                onSubmitEditing={handleEmailSubmit}
              />
            </View>

            {/* Passkey Button (Placeholder) */}
            <TouchableOpacity
              style={[
                styles.passkeyButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={handleLoginWithPasskeyPress}
              activeOpacity={0.8}
            >
              <Text style={styles.passkeyButtonText}>Login with passkey</Text>
            </TouchableOpacity>
            {/* Sign up with passkey Button */}
            <SecondaryButton
              onPress={handleSignUpWithPasskeyPress}
              disabled={!email}
              loading={loading}
            >
              Sign up with passkey
            </SecondaryButton>

            {/* Google OAuth Button */}
            <TouchableOpacity
              style={[styles.googleButton]}
              onPress={handleGoogleOauthPress}
              activeOpacity={0.8}
              disabled={loading}
            >
              <View style={styles.googleButtonContent}>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleButtonText}>
                  Continue with Google
                </Text>
              </View>
            </TouchableOpacity>

            {/* X OAuth Button */}
            <TouchableOpacity
              style={[styles.xButton]}
              onPress={handleXOauthPress}
              activeOpacity={0.8}
              disabled={loading}
            >
              <View style={styles.xButtonContent}>
                <Text style={styles.xIcon}>𝕏</Text>
                <Text style={styles.xButtonText}>Continue with X</Text>
              </View>
            </TouchableOpacity>

            {/* Discord OAuth Button */}
            <TouchableOpacity
              style={[styles.discordButton]}
              onPress={handleDiscordOauthPress}
              activeOpacity={0.8}
              disabled={loading}
            >
              <View style={styles.discordButtonContent}>
                <Text style={styles.discordIcon}>D</Text>
                <Text style={styles.discordButtonText}>
                  Continue with Discord
                </Text>
              </View>
            </TouchableOpacity>

            {/* Facebook OAuth Button */}
            <TouchableOpacity
              style={[styles.facebookButton]}
              onPress={handleFacebookOauthPress}
              activeOpacity={0.8}
              disabled={loading}
            >
              <View style={styles.facebookButtonContent}>
                <Text style={styles.facebookIcon}>f</Text>
                <Text style={styles.facebookButtonText}>
                  Continue with Facebook
                </Text>
              </View>
            </TouchableOpacity>

            {/* Apple OAuth Button */}
            <TouchableOpacity
              style={[styles.appleButton]}
              onPress={handleAppleOauthPress}
              activeOpacity={0.8}
              disabled={loading}
            >
              <View style={styles.appleButtonContent}>
                <Text style={styles.appleIcon}></Text>
                <Text style={styles.appleButtonText}>Continue with Apple</Text>
              </View>
            </TouchableOpacity>

            {/* Email Button */}
            <SecondaryButton
              onPress={handleEmailSubmit}
              disabled={!email}
              loading={loading}
            >
              Continue with email
            </SecondaryButton>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    alignItems: "center",
  },
  logo: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 32,
  },
  inputContainer: {
    width: "100%",
    marginBottom: 16,
  },
  passkeyButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  passkeyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
  },
  placeholderText: {
    fontSize: 14,
    textAlign: "center",
  },
  googleButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
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
  xButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  xButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  xIcon: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  xButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  discordButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: "#5865F2",
    borderWidth: 1,
    borderColor: "#5865F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  discordButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  discordIcon: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  discordButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  facebookButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: "#1877F2",
    borderWidth: 1,
    borderColor: "#1877F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  facebookButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  facebookIcon: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  facebookButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  appleButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  appleButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  appleIcon: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  appleButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
