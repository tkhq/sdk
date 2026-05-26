import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Colors } from "@/constants/theme";

const colors = Colors.dark;

export default function ScannerScreen() {
  const router = useRouter();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualLink, setManualLink] = useState("");

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;

    if (data.includes("pay.walletconnect.com")) {
      setScanned(true);
      navigateToPayment(data);
    } else {
      Alert.alert(
        "Invalid QR Code",
        "This doesn't look like a WalletConnect Pay QR code. Try again.",
        [{ text: "OK", onPress: () => setScanned(false) }],
      );
    }
  };

  const navigateToPayment = (paymentLink: string) => {
    router.replace({
      pathname: "/payment",
      params: { paymentLink },
    });
  };

  const handleManualSubmit = () => {
    if (!manualLink.trim()) return;
    navigateToPayment(manualLink.trim());
  };

  // Permission not yet determined
  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.primaryText }}>
          Requesting camera permission...
        </Text>
      </View>
    );
  }

  // Permission denied — show manual entry fallback
  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.permissionContainer}>
          <Text style={[styles.permissionTitle, { color: colors.primaryText }]}>
            Camera Access Needed
          </Text>
          <Text
            style={[styles.permissionText, { color: colors.secondaryText }]}
          >
            We need camera access to scan payment QR codes. You can also paste a
            payment link below.
          </Text>
          <TouchableOpacity
            style={[styles.grantButton, { backgroundColor: colors.primary }]}
            onPress={requestPermission}
          >
            <Text style={styles.grantButtonText}>Grant Permission</Text>
          </TouchableOpacity>

          {/* Manual entry fallback */}
          <View style={styles.manualEntry}>
            <Text style={[styles.manualLabel, { color: colors.secondaryText }]}>
              Paste a payment link:
            </Text>
            <TextInput
              style={[
                styles.manualInput,
                {
                  borderColor: colors.inputBorder,
                  color: colors.primaryText,
                  backgroundColor: "#1E1F20",
                },
              ]}
              placeholder="https://pay.walletconnect.com/pay_..."
              placeholderTextColor={colors.secondaryText}
              value={manualLink}
              onChangeText={setManualLink}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: colors.primary },
                !manualLink.trim() && styles.buttonDisabled,
              ]}
              onPress={handleManualSubmit}
              disabled={!manualLink.trim()}
            >
              <Text style={styles.submitButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Camera granted — show scanner
  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      >
        {/* Overlay */}
        <View style={styles.overlay}>
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Text style={styles.scanText}>
            Point at a WalletConnect Pay QR code
          </Text>
        </View>
      </CameraView>

      {/* Manual entry at bottom */}
      <View style={[styles.bottomBar, { backgroundColor: colors.background }]}>
        <View style={styles.bottomRow}>
          <TextInput
            style={[
              styles.bottomInput,
              {
                borderColor: colors.inputBorder,
                color: colors.primaryText,
                backgroundColor: "#1E1F20",
              },
            ]}
            placeholder="Or paste payment link..."
            placeholderTextColor={colors.secondaryText}
            value={manualLink}
            onChangeText={setManualLink}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[
              styles.bottomSubmit,
              { backgroundColor: colors.primary },
              !manualLink.trim() && styles.buttonDisabled,
            ]}
            onPress={handleManualSubmit}
            disabled={!manualLink.trim()}
          >
            <Text style={styles.bottomSubmitText}>Go</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scanArea: {
    width: 250,
    height: 250,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#fff",
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  scanText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    marginTop: 24,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  grantButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 32,
  },
  grantButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  manualEntry: {
    width: "100%",
    gap: 12,
  },
  manualLabel: {
    fontSize: 14,
    textAlign: "center",
  },
  manualInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  submitButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  bottomBar: {
    padding: 16,
    paddingBottom: 32,
    gap: 10,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bottomInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  bottomSubmit: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: "center",
  },
  bottomSubmitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
