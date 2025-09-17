import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { EmailInput, validateEmail } from '@/components/auth/email-input';
import { EmailButton } from '@/components/auth/email-button';

export default function LoginScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = async () => {
    if (!validateEmail(email)) {
      setEmailError(true);
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    setEmailError(false);
    setLoading(true);

    // Mock authentication - navigate to OTP screen
    setTimeout(() => {
      setLoading(false);
      router.push({
        pathname: '/otp',
        params: { email },
      });
    }, 1000);
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (emailError) {
      setEmailError(false);
    }
  };

  const handlePasskeyPress = () => {
    Alert.alert('Coming Soon', 'Passkey authentication will be available in Phase 2');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
              style={[styles.passkeyButton, { backgroundColor: colors.primary }]}
              onPress={handlePasskeyPress}
              activeOpacity={0.8}
            >
              <Text style={styles.passkeyButtonText}>
                Continue with passkey
              </Text>
            </TouchableOpacity>

            {/* Email Button */}
            <EmailButton
              onPress={handleEmailSubmit}
              disabled={!email}
              loading={loading}
            />

            {/* OR Divider (Placeholder for OAuth) */}
            <View style={styles.dividerContainer}>
              <View style={[styles.divider, { backgroundColor: colors.inputBorder }]} />
              <Text style={[styles.dividerText, { color: colors.secondaryText }]}>
                OR
              </Text>
              <View style={[styles.divider, { backgroundColor: colors.inputBorder }]} />
            </View>

            {/* OAuth Buttons Placeholder */}
            <Text style={[styles.placeholderText, { color: colors.secondaryText }]}>
              OAuth buttons will be added in Phase 3
            </Text>
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
    alignItems: 'center',
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 32,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 16,
  },
  passkeyButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  passkeyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
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
    textAlign: 'center',
  },
});