import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { OtpVerification } from "@/components/auth/otp-verification";
import { OtpType } from "@/types/types";
import { useTurnkey } from "@turnkey/react-native-wallet-kit";

export default function OtpScreen() {
  const router = useRouter();
  const { completeOtp, initOtp } = useTurnkey();
  const { email, otpId: otpIdParam } = useLocalSearchParams<{
    email: string;
    otpId: string;
  }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const [otpCode, setOtpCode] = useState("");
  const [otpId, setOtpId] = useState(otpIdParam);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const handleOtpChange = (text: string) => {
    setOtpCode(text);
  };

  const handleOtpFilled = (code: string) => {
    handleVerify(code);
  };

  const handleVerify = async (code?: string) => {
    const codeToVerify = code || otpCode;

    if (codeToVerify.length !== 6) {
      Alert.alert("Invalid Code", "Please enter a 6-digit verification code");
      return;
    }

    if (!otpId) {
      Alert.alert(
        "Missing OTP",
        "We could not find your OTP session. Please try again.",
      );
      return;
    }

    setLoading(true);
    console.log("completeOtp", {
      otpId,
      otpCode: codeToVerify,
      contact: email,
      otpType: OtpType.Email,
    });
    try {
      await completeOtp({
        otpId,
        otpCode: codeToVerify,
        contact: email,
        otpType: OtpType.Email,
      });
      router.replace("/(main)");
    } catch (error) {
      console.error("Error verifying OTP", error);
      Alert.alert("Error", "Failed to verify OTP");
      return;
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);

    const newOtpId = await initOtp({
      otpType: OtpType.Email,
      contact: email,
    });

    if (!newOtpId) {
      Alert.alert("Error", "Failed to initialize OTP");
      return;
    }

    setOtpId(newOtpId);

    // Mock resend
    setTimeout(() => {
      setResendLoading(false);
      Alert.alert(
        "Code Sent",
        "A new verification code has been sent to your email",
      );
    }, 1000);
  };

  const handleBack = () => {
    router.back();
  };

  const maskedEmail = email
    ? email.replace(/(.{2})(.*)(@.*)/, "$1***$3")
    : "your email";

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
            {/* Back Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.backButtonText, { color: colors.secondaryText }]}
              >
                ← Back
              </Text>
            </TouchableOpacity>

            {/* Logo */}
            <Text style={[styles.logo, { color: colors.primaryText }]}>
              Turnkey
            </Text>

            {/* Title */}
            <Text style={[styles.title, { color: colors.primaryText }]}>
              Enter verification code
            </Text>

            {/* Subtitle */}
            <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
              We sent a 6-digit code to {maskedEmail}
            </Text>

            {/* OTP Input */}
            <View style={styles.otpContainer}>
              <OtpVerification
                onTextChange={handleOtpChange}
                onFilled={handleOtpFilled}
                value={otpCode}
              />
            </View>

            {/* Resend Code */}
            <TouchableOpacity
              onPress={handleResendCode}
              disabled={resendLoading}
              activeOpacity={0.7}
              style={styles.resendButton}
            >
              {resendLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.resendText, { color: colors.primary }]}>
                  Resend Code
                </Text>
              )}
            </TouchableOpacity>

            {/* Verify Button */}
            <TouchableOpacity
              style={[
                styles.verifyButton,
                {
                  backgroundColor: colors.primary,
                  opacity: otpCode.length < 6 || loading ? 0.5 : 1,
                },
              ]}
              onPress={() => handleVerify()}
              disabled={otpCode.length < 6 || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.verifyButtonText}>Verify</Text>
              )}
            </TouchableOpacity>
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
    paddingTop: 20,
    alignItems: "center",
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 20,
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
  },
  logo: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  otpContainer: {
    width: "100%",
    marginBottom: 24,
  },
  resendButton: {
    paddingVertical: 12,
    marginBottom: 32,
  },
  resendText: {
    fontSize: 16,
    fontWeight: "500",
  },
  verifyButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
