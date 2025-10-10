import { View, StyleSheet } from "react-native";
import { OtpInput } from "react-native-otp-entry";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface OtpVerificationProps {
  onTextChange: (text: string) => void;
  onFilled?: (text: string) => void;
  value?: string;
}

export const OtpVerification: React.FC<OtpVerificationProps> = ({
  onTextChange,
  onFilled,
  value,
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <View style={styles.container}>
      <OtpInput
        numberOfDigits={6}
        onTextChange={onTextChange}
        onFilled={onFilled}
        focusColor={colors.primary}
        type="alphanumeric"
        autoFocus
        theme={{
          containerStyle: styles.otpContainer,
          pinCodeContainerStyle: {
            borderWidth: 1,
            borderColor: colors.inputBorder,
            borderRadius: 8,
            backgroundColor: colors.background,
            width: 48,
            height: 56,
          },
          pinCodeTextStyle: {
            fontSize: 24,
            color: colors.primaryText,
            fontWeight: "600",
          },
          focusedPinCodeContainerStyle: {
            borderColor: colors.primary,
            borderWidth: 2,
          },
          filledPinCodeContainerStyle: {
            borderColor: colors.primary,
          },
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
});
