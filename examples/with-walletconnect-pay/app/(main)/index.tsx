import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useTurnkey, ClientState } from "@turnkey/react-native-wallet-kit";
import { Colors } from "@/constants/theme";

const colors = Colors.dark;

const USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_RPC = "https://mainnet.base.org";

async function fetchUsdcBalance(walletAddress: string): Promise<string> {
  // balanceOf(address) selector = 0x70a08231
  const paddedAddress = walletAddress.slice(2).toLowerCase().padStart(64, "0");
  const data = "0x70a08231" + paddedAddress;

  try {
    const resp = await fetch(BASE_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: USDC_CONTRACT, data }, "latest"],
      }),
    });
    const json = await resp.json();
    if (json.result) {
      const raw = BigInt(json.result);
      const whole = raw / BigInt(1e6);
      const frac = raw % BigInt(1e6);
      return `${whole}.${frac.toString().padStart(6, "0").slice(0, 2)}`;
    }
  } catch (e) {
    console.error("USDC balance fetch error:", e);
  }
  return "—";
}

export default function HomeScreen() {
  const router = useRouter();

  const { logout, wallets, createWallet, refreshWallets, clientState } =
    useTurnkey();

  const isClientReady = clientState === ClientState.Ready;
  const [refreshing, setRefreshing] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState<string>("...");
  const [copied, setCopied] = useState(false);

  // Get the first Ethereum address from wallets
  const ethAccount = wallets
    ?.flatMap((w) => w.accounts || [])
    .find((a) => a.addressFormat === "ADDRESS_FORMAT_ETHEREUM");

  const walletAddress = ethAccount?.address || null;

  useEffect(() => {
    if (walletAddress) {
      fetchUsdcBalance(walletAddress).then(setUsdcBalance);
    }
  }, [walletAddress]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshWallets();
      if (walletAddress) {
        const bal = await fetchUsdcBalance(walletAddress);
        setUsdcBalance(bal);
      }
    } catch (e) {
      console.error("Refresh error:", e);
    }
    setRefreshing(false);
  }, [refreshWallets, walletAddress]);

  const handleCreateWallet = async () => {
    try {
      await createWallet({
        walletName: "WCPay Wallet",
        accounts: ["ADDRESS_FORMAT_ETHEREUM"],
      });
      await refreshWallets();
    } catch (error) {
      console.error("Create wallet error:", error);
      Alert.alert("Error", "Failed to create wallet");
    }
  };

  const handleScanToPay = () => {
    if (!walletAddress) {
      Alert.alert("No Wallet", "Please create a wallet first.");
      return;
    }
    router.push({ pathname: "/scanner" });
  };

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    await Clipboard.setStringAsync(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.secondaryText}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Wallet Card */}
        <View style={[styles.walletCard, { backgroundColor: "#1E1F20" }]}>
          {walletAddress ? (
            <>
              <Text
                style={[styles.walletLabel, { color: colors.secondaryText }]}
              >
                Your wallet address
              </Text>
              <View style={styles.addressRow}>
                <Text
                  style={[styles.walletAddress, { color: colors.primaryText }]}
                  selectable
                >
                  {walletAddress}
                </Text>
                <TouchableOpacity
                  onPress={handleCopyAddress}
                  style={styles.copyButton}
                >
                  <Text style={styles.copyIcon}>{copied ? "✓" : "⧉"}</Text>
                </TouchableOpacity>
              </View>

              {/* USDC Balance */}
              <View style={styles.balanceRow}>
                <Text
                  style={[styles.balanceLabel, { color: colors.secondaryText }]}
                >
                  USDC Balance
                </Text>
                <Text
                  style={[styles.balanceValue, { color: colors.primaryText }]}
                >
                  {usdcBalance} USDC
                </Text>
              </View>

              <View style={styles.balanceRow}>
                <Text
                  style={[styles.balanceLabel, { color: colors.secondaryText }]}
                >
                  Network
                </Text>
                <Text
                  style={[styles.balanceValue, { color: colors.primaryText }]}
                >
                  Base
                </Text>
              </View>

              {/* SDK Status */}
              <View style={styles.statusRow}>
                <Text
                  style={[styles.statusLabel, { color: colors.secondaryText }]}
                >
                  Status
                </Text>
                <View
                  style={[
                    styles.statusPill,
                    isClientReady ? styles.statusReady : styles.statusLoading,
                  ]}
                >
                  <Text style={styles.statusPillText}>
                    {isClientReady ? "Ready" : "Loading..."}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.noWalletContainer}>
              <Text
                style={[styles.noWalletText, { color: colors.secondaryText }]}
              >
                No wallet yet
              </Text>
              <TouchableOpacity
                style={[
                  styles.createWalletButton,
                  { backgroundColor: colors.primary },
                  !isClientReady && styles.buttonDisabled,
                ]}
                onPress={handleCreateWallet}
                disabled={!isClientReady}
              >
                <Text style={styles.createWalletButtonText}>Create Wallet</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Scan to Pay FAB */}
      {walletAddress && (
        <View style={styles.fabContainer}>
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.primary }]}
            onPress={handleScanToPay}
            activeOpacity={0.8}
          >
            <Text style={styles.fabIcon}>📷</Text>
            <Text style={styles.fabText}>Scan to Pay</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 24,
  },
  logoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#ef4444",
  },
  logoutText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  walletCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  walletLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 16,
  },
  walletAddress: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "monospace",
    flex: 1,
  },
  copyButton: {
    padding: 4,
    marginTop: -2,
  },
  copyIcon: {
    fontSize: 18,
    color: "#9BA1A6",
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 14,
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  statusLabel: {
    fontSize: 14,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  statusReady: {
    backgroundColor: "#bbf7d0",
  },
  statusLoading: {
    backgroundColor: "#fde68a",
  },
  noWalletContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  noWalletText: {
    fontSize: 16,
    marginBottom: 16,
  },
  createWalletButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  createWalletButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  fabContainer: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
  },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabIcon: {
    fontSize: 22,
  },
  fabText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
});
