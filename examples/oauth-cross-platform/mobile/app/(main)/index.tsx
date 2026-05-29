import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTurnkey } from "@turnkey/react-native-wallet-kit";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { TurnkeyLogo } from "@/components/TurnkeyLogo";
import { Platform } from "react-native";

export default function Dashboard() {
  const { session, wallets, logout } = useTurnkey();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TurnkeyLogo width={100} />
          <Text style={[styles.demoLabel, { color: colors.secondaryText }]}>
            OAuth Cross-Platform Demo
            {Platform.OS === "ios" ? " (iOS)" : " (Android)"}
          </Text>
        </View>

        {/* Sub-organization */}
        <View style={[styles.card, { borderColor: colors.inputBorder }]}>
          <Text style={[styles.cardTitle, { color: colors.primaryText }]}>
            Sub-organization
          </Text>
          <Row
            label="Sub-org ID"
            value={session?.organizationId ?? "—"}
            colors={colors}
          />
          <Row label="User ID" value={session?.userId ?? "—"} colors={colors} />

          {wallets.length > 0 ? (
            wallets.map((wallet) => (
              <View key={wallet.walletId} style={styles.walletBlock}>
                <Text
                  style={[styles.walletName, { color: colors.primaryText }]}
                >
                  {wallet.walletName || "Wallet"}
                </Text>
                {wallet.accounts?.map((account, i) => (
                  <View key={i} style={styles.accountRow}>
                    <Text
                      style={[
                        styles.accountLabel,
                        { color: colors.secondaryText },
                      ]}
                    >
                      {account.addressFormat
                        .replace("ADDRESS_FORMAT_", "")
                        .replace("_", " ")}
                    </Text>
                    <Text
                      style={[
                        styles.accountAddress,
                        { color: colors.primaryText },
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="middle"
                    >
                      {account.address}
                    </Text>
                  </View>
                ))}
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
              No wallets
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => logout()}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: (typeof Colors)["light"];
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.secondaryText }]}>
        {label}
      </Text>
      <Text
        style={[styles.rowValue, { color: colors.primaryText }]}
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    gap: 16,
  },
  header: {
    marginBottom: 8,
    gap: 6,
  },
  demoLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  row: {
    gap: 2,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rowValue: {
    fontSize: 13,
    fontFamily: "monospace",
  },
  walletBlock: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
    gap: 8,
  },
  walletName: {
    fontSize: 13,
    fontWeight: "600",
  },
  accountRow: {
    gap: 2,
  },
  accountLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  accountAddress: {
    fontSize: 13,
    fontFamily: "monospace",
  },
  emptyText: {
    fontSize: 13,
    fontStyle: "italic",
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: "#fca5a5",
    backgroundColor: "#fff1f2",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#dc2626",
  },
});
