import {
  Platform,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";

import { HelloWave } from "@/components/hello-wave";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Link, router } from "expo-router";
import { AuthState, useTurnkey } from "@turnkey/react-native-wallet-kit";
import {
  decryptCredentialBundle,
  decryptExportBundle,
  generateP256KeyPair,
} from "@turnkey/crypto";
import { useEffect } from "react";

export default function HomeScreen() {
  const {
    logout,
    session,
    user,
    authState,
    wallets,
    createWallet,
    createWalletAccounts,
    refreshWallets,
    signMessage,
    exportWallet,
    exportWalletAccount,
  } = useTurnkey();

  const handleLogout = async () => {
    await logout();
  };

  const handleCreateWallet = async () => {
    try {
      const walletId = await createWallet({
        walletName: `Wallet ${wallets.length + 1}`,
        accounts: ["ADDRESS_FORMAT_ETHEREUM", "ADDRESS_FORMAT_SOLANA"],
      });
      console.log("Wallet created:", walletId);
      await refreshWallets();
    } catch (error) {
      console.error("Error creating wallet:", error);
    }
  };

  const handleCreateAccount = async () => {
    if (wallets.length === 0) {
      alert("Please create a wallet first");
      return;
    }

    try {
      const addresses = await createWalletAccounts({
        walletId: wallets[0].walletId,
        accounts: ["ADDRESS_FORMAT_ETHEREUM"],
      });
      console.log("Account created:", addresses);
      await refreshWallets();
    } catch (error) {
      console.error("Error creating account:", error);
    }
  };

  const handleSignMessage = async (account: any) => {
    try {
      const message = "Hello, Turnkey!";
      const signature = await signMessage({
        walletAccount: account,
        message,
      });
      console.log("Message signed:", signature);
      Alert.alert(
        "Success",
        `Message signed successfully!\n\nSignature: ${signature.r}...`,
        [{ text: "OK" }],
      );
    } catch (error) {
      console.error("Error signing message:", error);
      Alert.alert("Error", "Failed to sign message");
    }
  };

  const handleExportWallet = async (walletId: string) => {
    try {
      const { publicKey, privateKey, publicKeyUncompressed } =
        generateP256KeyPair();
      console.log("Key pair:", publicKey, privateKey, publicKeyUncompressed);
      const targetPublicKey = publicKeyUncompressed;
      const bundle = await exportWallet({ walletId, targetPublicKey });
      console.log("Wallet exported:", bundle);
      const exportedWalletMnemonic = await decryptExportBundle({
        exportBundle: bundle,
        embeddedKey: privateKey,
        organizationId: session?.organizationId!,
        returnMnemonic: true,
        keyFormat: "HEXADECIMAL",
      });
      console.log("Decrypted bundle:", exportedWalletMnemonic);
      Alert.alert(
        "Success",
        "Wallet exported successfully!\n\nBundle saved to console.\n\nMnemonic: " +
          exportedWalletMnemonic,
        [{ text: "OK" }],
      );
    } catch (error) {
      console.error("Error exporting wallet:", error);
      Alert.alert("Error", "Failed to export wallet");
    }
  };

  const handleExportAccount = async (address: string) => {
    try {
      const { publicKey, privateKey, publicKeyUncompressed } =
        generateP256KeyPair();
      console.log("Key pair:", publicKey, privateKey, publicKeyUncompressed);
      const targetPublicKey = publicKeyUncompressed;
      const bundle = await exportWalletAccount({ address, targetPublicKey });
      console.log("Account exported:", bundle);
      const exportedAccountPrivateKey = await decryptExportBundle({
        exportBundle: bundle,
        embeddedKey: privateKey,
        organizationId: session?.organizationId!,
        returnMnemonic: false,
        keyFormat: "HEXADECIMAL",
      });
      console.log("Decrypted bundle:", exportedAccountPrivateKey);
      Alert.alert(
        "Success",
        "Account exported successfully!\n\nBundle saved to console.\n\nPrivate Key: " +
          exportedAccountPrivateKey,
        [{ text: "OK" }],
      );
    } catch (error) {
      console.error("Error exporting account:", error);
      Alert.alert("Error", "Failed to export account");
    }
  };

  // Calculate session expiry date
  const getExpiryDate = () => {
    if (session?.expiry) {
      const date = new Date(session.expiry * 1000);
      return date.toLocaleString();
    }
    return "N/A";
  };

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title">Welcome!</ThemedText>
          <HelloWave />
        </ThemedView>

        {/* Session Details Section */}
        {session && (
          <ThemedView style={styles.sessionContainer}>
            <ThemedText type="subtitle">Session Details</ThemedText>
            <ThemedView style={styles.sessionInfo}>
              <ThemedText>
                <ThemedText type="defaultSemiBold">
                  Organization ID:{" "}
                </ThemedText>
                {session.organizationId || "N/A"}
              </ThemedText>
              <ThemedText>
                <ThemedText type="defaultSemiBold">User ID: </ThemedText>
                {session.userId || "N/A"}
              </ThemedText>
              <ThemedText>
                <ThemedText type="defaultSemiBold">
                  Session Expires:{" "}
                </ThemedText>
                {getExpiryDate()}
              </ThemedText>
              <ThemedText>
                <ThemedText type="defaultSemiBold">Session Type: </ThemedText>
                {session.sessionType || "N/A"}
              </ThemedText>
            </ThemedView>

            {/* Logout Button */}
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <ThemedText style={styles.logoutButtonText}>Logout</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        )}

        {/* Wallets Section */}
        <ThemedView style={styles.walletsContainer}>
          <ThemedText type="subtitle">Your Wallets</ThemedText>

          {/* Wallet Actions */}
          <ThemedView style={styles.walletActions}>
            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreateWallet}
            >
              <ThemedText style={styles.createButtonText}>
                Create Wallet
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreateAccount}
            >
              <ThemedText style={styles.createButtonText}>
                Create Account
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>

          {/* Wallets List */}
          {wallets && wallets.length > 0 ? (
            <ThemedView style={styles.walletsList}>
              {wallets.map((wallet) => (
                <ThemedView key={wallet.walletId} style={styles.walletItem}>
                  {/* Wallet Header with Export Button */}
                  <ThemedView style={styles.walletHeader}>
                    <ThemedView style={styles.walletInfo}>
                      <ThemedText type="defaultSemiBold">
                        {wallet.walletName || "Unnamed Wallet"}
                      </ThemedText>
                      <ThemedText style={styles.walletId}>
                        ID: {wallet.walletId}
                      </ThemedText>
                    </ThemedView>
                    <TouchableOpacity
                      style={styles.walletExportButton}
                      onPress={() => handleExportWallet(wallet.walletId)}
                    >
                      <ThemedText style={styles.exportButtonText}>
                        Export
                      </ThemedText>
                    </TouchableOpacity>
                  </ThemedView>

                  {/* Wallet Accounts */}
                  {wallet.accounts && wallet.accounts.length > 0 && (
                    <ThemedView style={styles.accountsList}>
                      <ThemedText style={styles.accountsHeader}>
                        Accounts:
                      </ThemedText>
                      {wallet.accounts.map((account, index) => {
                        // Format address format for display (remove ADDRESS_FORMAT_ prefix)
                        const formatType = account.addressFormat.replace(
                          "ADDRESS_FORMAT_",
                          "",
                        );

                        return (
                          <ThemedView key={index} style={styles.accountCard}>
                            <ThemedText style={styles.accountAddress}>
                              {account.address.slice(0, 12)}...
                              {account.address.slice(-10)}
                            </ThemedText>
                            <ThemedView style={styles.accountButtons}>
                              <TouchableOpacity
                                style={styles.signButton}
                                onPress={() => handleSignMessage(account)}
                              >
                                <ThemedText style={styles.signButtonText}>
                                  Sign
                                </ThemedText>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.exportButton}
                                onPress={() =>
                                  handleExportAccount(account.address)
                                }
                              >
                                <ThemedText style={styles.exportButtonText}>
                                  Export
                                </ThemedText>
                              </TouchableOpacity>
                            </ThemedView>
                          </ThemedView>
                        );
                      })}
                    </ThemedView>
                  )}
                </ThemedView>
              ))}
            </ThemedView>
          ) : (
            <ThemedText style={styles.noWallets}>
              No wallets yet. Create one to get started!
            </ThemedText>
          )}
        </ThemedView>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  sessionContainer: {
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  sessionInfo: {
    gap: 8,
  },
  logoutButton: {
    backgroundColor: "#ef4444",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  logoutButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 16,
  },
  walletsContainer: {
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  walletActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  createButton: {
    flex: 1,
    backgroundColor: "#10b981",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  createButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 14,
  },
  walletsList: {
    gap: 12,
    marginTop: 8,
  },
  walletItem: {
    backgroundColor: "rgba(255,255,255,0.5)",
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  walletHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  walletInfo: {
    flex: 1,
  },
  walletId: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  walletExportButton: {
    backgroundColor: "#10b981",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  accountsList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    gap: 12,
  },
  accountsHeader: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  accountCard: {
    backgroundColor: "rgba(0,0,0,0.03)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  accountAddress: {
    fontSize: 13,
    fontFamily: "monospace",
    marginBottom: 10,
    color: "#333",
  },
  accountButtons: {
    flexDirection: "row",
    gap: 10,
  },
  signButton: {
    flex: 1,
    backgroundColor: "#3b82f6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  signButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "bold",
  },
  exportButton: {
    flex: 1,
    backgroundColor: "#10b981",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  exportButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "bold",
  },
  noWallets: {
    textAlign: "center",
    opacity: 0.6,
    marginTop: 12,
  },
});
