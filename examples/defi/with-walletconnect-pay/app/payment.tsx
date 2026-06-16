import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTurnkey, ClientState } from "@turnkey/react-native-wallet-kit";
import { WebView } from "react-native-webview";
import {
  getWcPayClient,
  buildAccounts,
  normalizePaymentLink,
} from "@/constants/walletconnect";
import { signAllWcPayActions } from "@/lib/turnkey-signer";
import { Colors } from "@/constants/theme";
import { formatUnits } from "viem";

const colors = Colors.dark;

type PaymentStep =
  | "loading"
  | "options"
  | "collecting_data"
  | "signing"
  | "confirming"
  | "success"
  | "failed"
  | "error";

export default function PaymentScreen() {
  const { paymentLink } = useLocalSearchParams<{ paymentLink: string }>();
  const router = useRouter();

  const { wallets, signMessage, clientState } = useTurnkey();

  const ethAccount = wallets
    ?.flatMap((w: any) => w.accounts || [])
    .find((a: any) => a.addressFormat === "ADDRESS_FORMAT_ETHEREUM");
  const walletAddress = ethAccount?.address || "";

  const [step, setStep] = useState<PaymentStep>("loading");
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [paymentOptions, setPaymentOptions] = useState<any[]>([]);
  const [selectedOption, setSelectedOption] = useState<any>(null);
  const [paymentId, setPaymentId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState("");
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const [collectDataUrl, setCollectDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (paymentLink && walletAddress && clientState === ClientState.Ready) {
      fetchPaymentOptions();
    }
  }, [paymentLink, walletAddress, clientState]);

  const fetchPaymentOptions = async () => {
    try {
      setStep("loading");
      const client = getWcPayClient();
      const accounts = buildAccounts(walletAddress);

      const normalizedLink = normalizePaymentLink(paymentLink!);

      const response = await client.getPaymentOptions({
        paymentLink: normalizedLink,
        accounts,
        includePaymentInfo: true,
      });

      setPaymentInfo(response.info);
      setPaymentOptions(response.options || []);
      setPaymentId(response.paymentId);

      const firstOption = response.options?.[0] ?? null;
      setSelectedOption(firstOption);

      setStep("options");
    } catch (error: any) {
      console.error("[WCPay] getPaymentOptions error:", error);
      setStep("error");
      const msg: string = error.message || "";
      if (msg.toLowerCase().includes("expired")) {
        setErrorMessage(
          "This payment link has expired. Please request a new one from the merchant.",
        );
      } else {
        setErrorMessage("Failed to load payment options. Please try again.");
      }
    }
  };

  const handleConfirmPayment = async () => {
    if (!paymentId || !ethAccount || !signMessage) return;
    if (!selectedOption) {
      setStep("failed");
      setErrorMessage(
        "Insufficient USDC balance to complete this payment. Please add funds to your wallet and try again.",
      );
      return;
    }

    // If identity collection is required, show the WebView first
    if (selectedOption.collectData?.url) {
      setCollectDataUrl(selectedOption.collectData.url);
      setStep("collecting_data");
      return;
    }

    // No IC required — proceed directly to signing
    await executePayment();
  };

  const handleIcComplete = () => {
    setCollectDataUrl(null);
    executePayment();
  };

  const handleIcError = (error?: string) => {
    setCollectDataUrl(null);
    setStep("failed");
    setErrorMessage(error || "Identity verification failed. Please try again.");
  };

  const executePayment = async () => {
    if (!selectedOption || !paymentId || !ethAccount || !signMessage) return;

    try {
      setStep("signing");
      const client = getWcPayClient();

      const actionsResponse = await client.getRequiredPaymentActions({
        paymentId,
        optionId: selectedOption.id,
      });
      const actions = actionsResponse;

      const signatures = await signAllWcPayActions(
        actions,
        signMessage,
        ethAccount,
      );

      setStep("confirming");
      const result = await client.confirmPayment({
        paymentId,
        optionId: selectedOption.id,
        signatures,
      });

      const status = result?.status?.toUpperCase();
      if (
        status &&
        (status === "FAILED" || status === "REJECTED" || status === "ERROR")
      ) {
        throw new Error(`Payment failed with status: ${result.status}`);
      }

      setPaymentResult(result);
      setStep("success");
    } catch (error: any) {
      console.error("[WCPay] Payment failed:", error);
      setStep("failed");
      const msg: string = error.message || "";
      if (/insufficient|balance|funds/i.test(msg)) {
        setErrorMessage(
          "Insufficient USDC balance. Please add funds to your wallet and try again.",
        );
      } else {
        setErrorMessage(msg || "Payment failed. Please try again.");
      }
    }
  };

  const handleDone = () => router.dismissAll();
  const handleRetry = () => {
    setStep("loading");
    setErrorMessage("");
    setCollectDataUrl(null);
    fetchPaymentOptions();
  };

  // ─── Renders ─────────────────────────────────────────────────

  if (step === "loading")
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.statusTitle, { color: colors.secondaryText }]}>
            Loading payment...
          </Text>
        </View>
      </View>
    );

  if (step === "collecting_data" && collectDataUrl)
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.webviewHeader}>
          <Text style={[styles.webviewTitle, { color: colors.primaryText }]}>
            Identity Verification
          </Text>
          <TouchableOpacity
            onPress={() => {
              setCollectDataUrl(null);
              setStep("options");
            }}
          >
            <Text
              style={[styles.webviewCancel, { color: colors.secondaryText }]}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
        <WebView
          source={{ uri: collectDataUrl }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (
                data.type === "IC_COMPLETE" ||
                data.resultType === "IC_COMPLETE"
              ) {
                handleIcComplete();
              } else if (
                data.type === "IC_ERROR" ||
                data.resultType === "IC_ERROR"
              ) {
                handleIcError(data.message || data.error);
              }
            } catch {
              // Non-JSON message, ignore
            }
          }}
          onShouldStartLoadWithRequest={(request) => {
            if (
              request.navigationType === "click" &&
              !request.url.includes("pay.walletconnect.com") &&
              !request.url.includes("walletconnect.org")
            ) {
              Linking.openURL(request.url);
              return false;
            }
            return true;
          }}
        />
      </View>
    );

  if (step === "signing")
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.statusTitle, { color: colors.primaryText }]}>
            Signing with Turnkey...
          </Text>
          <Text style={[styles.statusSub, { color: colors.secondaryText }]}>
            Turnkey is securely signing your payment authorization.
          </Text>
        </View>
      </View>
    );

  if (step === "confirming")
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.statusTitle, { color: colors.primaryText }]}>
            Confirming payment...
          </Text>
          <Text style={[styles.statusSub, { color: colors.secondaryText }]}>
            WalletConnect Pay is processing your payment.
          </Text>
        </View>
      </View>
    );

  if (step === "success")
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Text style={styles.resultEmoji}>✅</Text>
          <Text style={[styles.resultTitle, { color: colors.primaryText }]}>
            Payment Successful!
          </Text>
          <Text style={[styles.resultSub, { color: colors.secondaryText }]}>
            {paymentInfo?.merchant?.name
              ? `${paymentInfo.merchant.name} has been paid`
              : "Payment complete"}
            {paymentInfo?.amount?.display
              ? ` ${formatDisplayAmount(paymentInfo.amount)}`
              : ""}
          </Text>

          {paymentResult && (
            <View style={[styles.txCard, { backgroundColor: "#1E1F20" }]}>
              <Text style={[styles.txLabel, { color: colors.secondaryText }]}>
                Status
              </Text>
              <Text style={[styles.txValue, { color: colors.primaryText }]}>
                {paymentResult.status || "Completed"}
              </Text>
            </View>
          )}

          <View style={styles.demoBadge}>
            <Text style={styles.demoBadgeText}>
              Payment processed by WalletConnect Pay. Signed by Turnkey.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: colors.primary }]}
            onPress={handleDone}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );

  if (step === "failed" || step === "error")
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Text style={styles.resultEmoji}>
            {step === "failed" ? "❌" : "⚠️"}
          </Text>
          <Text style={[styles.resultTitle, { color: colors.primaryText }]}>
            {step === "failed" ? "Payment Failed" : "Error"}
          </Text>
          <Text style={[styles.resultSub, { color: colors.secondaryText }]}>
            {errorMessage}
          </Text>
          {step === "failed" && (
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={handleRetry}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.cancelButton} onPress={handleDone}>
            <Text style={[styles.cancelText, { color: colors.secondaryText }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );

  // step === "options"
  const merchantName = paymentInfo?.merchant?.name || "Merchant";
  const displayAmount = paymentInfo?.amount
    ? formatDisplayAmount(paymentInfo.amount)
    : "";
  const optionDisplay = selectedOption?.amount?.display;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.optionsContainer}>
        <View style={styles.demoBadge}>
          <Text style={styles.demoBadgeText}>
            Gas handled by WalletConnect Pay
          </Text>
        </View>

        <View style={styles.merchantCard}>
          <Text style={[styles.merchantLabel, { color: colors.secondaryText }]}>
            Paying
          </Text>
          <Text style={[styles.merchantName, { color: colors.primaryText }]}>
            {merchantName}
          </Text>
        </View>

        {displayAmount ? (
          <View style={styles.amountContainer}>
            <Text
              style={[styles.amountCurrency, { color: colors.secondaryText }]}
            >
              $
            </Text>
            <Text style={[styles.amountValue, { color: colors.primaryText }]}>
              {displayAmount}
            </Text>
          </View>
        ) : null}

        {optionDisplay && (
          <Text style={[styles.amountSubtext, { color: colors.secondaryText }]}>
            {optionDisplay.assetSymbol || "USDC"} on{" "}
            {optionDisplay.networkName || "Base"}
          </Text>
        )}

        <View style={[styles.detailCard, { backgroundColor: "#1E1F20" }]}>
          {optionDisplay?.networkName && (
            <Row label="Network" value={optionDisplay.networkName} />
          )}
          {optionDisplay?.assetSymbol && (
            <Row label="Asset" value={optionDisplay.assetSymbol} />
          )}
          <Row label="Gas" value="Handled by WalletConnect Pay" />
          <Row
            label="From"
            value={`${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`}
            mono
          />
        </View>

        {/* Option selector (if multiple options) */}
        {paymentOptions.length > 1 && (
          <View style={styles.optionsList}>
            <Text
              style={[styles.optionsLabel, { color: colors.secondaryText }]}
            >
              Payment option:
            </Text>
            {paymentOptions.map((opt: any) => (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.optionItem,
                  {
                    backgroundColor:
                      selectedOption?.id === opt.id ? "#2a2d5e" : "#1E1F20",
                    borderColor:
                      selectedOption?.id === opt.id
                        ? colors.primary
                        : "transparent",
                  },
                ]}
                onPress={() => setSelectedOption(opt)}
              >
                <Text
                  style={[styles.optionText, { color: colors.primaryText }]}
                >
                  {opt.amount?.display?.assetSymbol || "Token"} on{" "}
                  {opt.amount?.display?.networkName || "Network"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.confirmButton, { backgroundColor: colors.primary }]}
          onPress={handleConfirmPayment}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmButtonText}>Confirm & Pay</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
        >
          <Text style={[styles.cancelText, { color: colors.secondaryText }]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.secondaryText }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.detailValue,
          { color: colors.primaryText },
          mono && styles.mono,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function formatDisplayAmount(amount: any): string {
  if (!amount) return "";
  if (amount.display?.decimals != null && amount.value) {
    return parseFloat(
      formatUnits(BigInt(amount.value), amount.display.decimals),
    ).toFixed(2);
  }
  if (amount.value) return amount.value;
  return "";
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  statusTitle: { fontSize: 20, fontWeight: "700", marginTop: 20 },
  statusSub: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  optionsContainer: { padding: 24, paddingBottom: 40 },
  demoBadge: {
    backgroundColor: "#1a2744",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "center",
    marginBottom: 16,
    marginTop: 8,
  },
  demoBadgeText: {
    fontSize: 13,
    color: "#93b4fd",
    fontWeight: "600",
    textAlign: "center",
  },
  merchantCard: { alignItems: "center", marginBottom: 8 },
  merchantLabel: { fontSize: 14, marginBottom: 4 },
  merchantName: { fontSize: 24, fontWeight: "bold" },
  amountContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    marginTop: 20,
  },
  amountCurrency: { fontSize: 28, fontWeight: "600", marginTop: 8 },
  amountValue: { fontSize: 56, fontWeight: "800" },
  amountSubtext: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
    fontWeight: "500",
  },
  detailCard: { borderRadius: 14, padding: 16, marginBottom: 16, gap: 12 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: "600" },
  mono: { fontFamily: "monospace" },
  optionsList: { marginBottom: 16, gap: 8 },
  optionsLabel: { fontSize: 14, marginBottom: 4 },
  optionItem: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  optionText: { fontSize: 14, fontWeight: "600" },
  confirmButton: {
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  confirmButtonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  cancelButton: { paddingVertical: 12, alignItems: "center" },
  cancelText: { fontSize: 16 },
  resultEmoji: { fontSize: 64, marginBottom: 16 },
  resultTitle: { fontSize: 24, fontWeight: "bold", marginBottom: 8 },
  resultSub: { fontSize: 15, textAlign: "center", marginBottom: 8 },
  txCard: {
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    width: "100%",
    gap: 6,
  },
  txLabel: { fontSize: 12, fontWeight: "600" },
  txValue: { fontSize: 13, fontFamily: "monospace", fontWeight: "500" },
  doneButton: {
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 24,
  },
  doneButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  retryButton: {
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  retryButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  webviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  webviewTitle: { fontSize: 17, fontWeight: "600" },
  webviewCancel: { fontSize: 16 },
  webview: { flex: 1 },
});
