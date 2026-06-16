import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "@/constants/theme";
import { useTurnkey, OtpType } from "@turnkey/react-native-wallet-kit";

const colors = Colors.dark;

const customWallet = {
  walletName: "WCPay Wallet",
  walletAccounts: [
    {
      curve: "CURVE_SECP256K1" as const,
      pathFormat: "PATH_FORMAT_BIP32" as const,
      path: "m/44'/60'/0'/0/0",
      addressFormat: "ADDRESS_FORMAT_ETHEREUM" as const,
    },
  ],
};

export default function LoginScreen() {
  const { initOtp, completeOtp } = useTurnkey();

  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpId, setOtpId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"email" | "otp">("email");

  const handleSendOtp = async () => {
    if (!email.trim() || !email.includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    try {
      setLoading(true);
      const id = await initOtp({
        otpType: OtpType.Email,
        contact: email.trim(),
      });
      if (id) {
        setOtpId(id);
        setStep("otp");
      } else {
        Alert.alert("Error", "Failed to send verification code.");
      }
    } catch (error) {
      console.error("OTP init error:", error);
      Alert.alert("Error", "Failed to send verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOtp = async () => {
    if (!otpCode.trim() || !otpId) return;
    try {
      setLoading(true);
      await completeOtp({
        otpId,
        otpCode: otpCode.trim(),
        otpType: OtpType.Email,
        contact: email.trim(),
        createSubOrgParams: {
          customWallet,
        },
      });
      // Auth success — the AuthGate in _layout.tsx will redirect to (main)
    } catch (error) {
      console.error("OTP complete error:", error);
      Alert.alert(
        "Error",
        "Invalid code or verification failed. Please try again.",
      );
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
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <View style={styles.logoStack}>
              <View style={[styles.logoPill, { backgroundColor: "#3396FF" }]}>
                <Text style={styles.logoPillText}>WalletConnect</Text>
              </View>
              <Text style={[styles.logoPlus, { color: colors.secondaryText }]}>
                +
              </Text>
              <View style={[styles.logoPill, { backgroundColor: "#4c48ff" }]}>
                <Text style={styles.logoPillText}>Turnkey</Text>
              </View>
            </View>
            <Text style={[styles.appName, { color: colors.primaryText }]}>
              WalletConnect Pay Demo
            </Text>
            <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
              Powered by Turnkey
            </Text>
          </View>

          {step === "email" ? (
            <>
              <Text
                style={[styles.description, { color: colors.secondaryText }]}
              >
                Enter your email to sign in or create a new wallet.
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: colors.inputBorder,
                    color: colors.primaryText,
                    backgroundColor: "#1E1F20",
                  },
                ]}
                placeholder="you@example.com"
                placeholderTextColor={colors.secondaryText}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.primary },
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleSendOtp}
                activeOpacity={0.8}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    Send Verification Code
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text
                style={[styles.description, { color: colors.secondaryText }]}
              >
                Enter the code sent to {email}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: colors.inputBorder,
                    color: colors.primaryText,
                    backgroundColor: "#1E1F20",
                    fontSize: 24,
                    letterSpacing: 8,
                    textAlign: "center",
                  },
                ]}
                placeholder="000000"
                placeholderTextColor={colors.secondaryText}
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                maxLength={6}
                editable={!loading}
              />
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.primary },
                  (loading || otpCode.length < 6) && styles.buttonDisabled,
                ]}
                onPress={handleCompleteOtp}
                activeOpacity={0.8}
                disabled={loading || otpCode.length < 6}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Verify & Sign In</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  setStep("email");
                  setOtpCode("");
                  setOtpId(null);
                }}
              >
                <Text
                  style={[
                    styles.backButtonText,
                    { color: colors.secondaryText },
                  ]}
                >
                  Use a different email
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  logoContainer: { alignItems: "center", marginBottom: 32 },
  logoStack: {
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  logoPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  logoPillText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  logoPlus: {
    fontSize: 18,
    fontWeight: "600",
  },
  appName: { fontSize: 28, fontWeight: "bold" },
  subtitle: { fontSize: 16, marginTop: 4 },
  description: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  input: {
    width: "100%",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  primaryButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "600" },
  buttonDisabled: { opacity: 0.5 },
  backButton: { paddingVertical: 16 },
  backButtonText: { fontSize: 15 },
});
