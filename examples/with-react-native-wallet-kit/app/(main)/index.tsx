import { Platform, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link, router } from 'expo-router';
import { AuthState, useTurnkey } from '@turnkey/react-native-wallet-kit';
import { useEffect } from 'react';

export default function HomeScreen() {
  const { logout, session, user, authState, wallets, createWallet, createWalletAccounts, refreshWallets } = useTurnkey();

  console.log('logout', logout);
  console.log('session', session);
  console.log('authState', authState);
  console.log('user', user);
  console.log('wallets', wallets);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const handleCreateWallet = async () => {
    try {
      const walletId = await createWallet({
        walletName: `Wallet ${wallets.length + 1}`,
        accounts: ["ADDRESS_FORMAT_ETHEREUM", "ADDRESS_FORMAT_SOLANA"],
      });
      console.log('Wallet created:', walletId);
      await refreshWallets();
    } catch (error) {
      console.error('Error creating wallet:', error);
    }
  };

  const handleCreateAccount = async () => {
    if (wallets.length === 0) {
      alert('Please create a wallet first');
      return;
    }

    try {
      const addresses = await createWalletAccounts({
        walletId: wallets[0].walletId,
        accounts: ["ADDRESS_FORMAT_ETHEREUM"],
      });
      console.log('Account created:', addresses);
      await refreshWallets();
    } catch (error) {
      console.error('Error creating account:', error);
    }
  };

  // Calculate session expiry date
  const getExpiryDate = () => {
    if (session?.expiry) {
      const date = new Date(session.expiry * 1000);
      return date.toLocaleString();
    }
    return 'N/A';
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
                <ThemedText type="defaultSemiBold">Organization ID: </ThemedText>
                {session.organizationId || 'N/A'}
              </ThemedText>
              <ThemedText>
                <ThemedText type="defaultSemiBold">User ID: </ThemedText>
                {session.userId || 'N/A'}
              </ThemedText>
              <ThemedText>
                <ThemedText type="defaultSemiBold">Session Expires: </ThemedText>
                {getExpiryDate()}
              </ThemedText>
              <ThemedText>
                <ThemedText type="defaultSemiBold">Session Type: </ThemedText>
                {session.sessionType || 'N/A'}
              </ThemedText>
            </ThemedView>

            {/* Logout Button */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <ThemedText style={styles.logoutButtonText}>Logout</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        )}

        {/* Wallets Section */}
        <ThemedView style={styles.walletsContainer}>
          <ThemedText type="subtitle">Your Wallets</ThemedText>

          {/* Wallet Actions */}
          <ThemedView style={styles.walletActions}>
            <TouchableOpacity style={styles.createButton} onPress={handleCreateWallet}>
              <ThemedText style={styles.createButtonText}>Create Wallet</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createButton} onPress={handleCreateAccount}>
              <ThemedText style={styles.createButtonText}>Create Account</ThemedText>
            </TouchableOpacity>
          </ThemedView>

          {/* Wallets List */}
          {wallets && wallets.length > 0 ? (
            <ThemedView style={styles.walletsList}>
              {wallets.map((wallet) => (
                <ThemedView key={wallet.walletId} style={styles.walletItem}>
                  <ThemedText type="defaultSemiBold">{wallet.walletName || 'Unnamed Wallet'}</ThemedText>
                  <ThemedText style={styles.walletId}>ID: {wallet.walletId}</ThemedText>

                  {/* Wallet Accounts */}
                  {wallet.accounts && wallet.accounts.length > 0 && (
                    <ThemedView style={styles.accountsList}>
                      <ThemedText style={styles.accountsHeader}>Accounts:</ThemedText>
                      {wallet.accounts.map((account, index) => (
                        <ThemedText key={index} style={styles.accountItem}>
                          • {account.addressFormat}: {account.address.slice(0, 10)}...{account.address.slice(-8)}
                        </ThemedText>
                      ))}
                    </ThemedView>
                  )}
                </ThemedView>
              ))}
            </ThemedView>
          ) : (
            <ThemedText style={styles.noWallets}>No wallets yet. Create one to get started!</ThemedText>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  sessionContainer: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  sessionInfo: {
    gap: 8,
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  walletsContainer: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  walletActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  createButton: {
    flex: 1,
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  walletsList: {
    gap: 12,
    marginTop: 8,
  },
  walletItem: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  walletId: {
    fontSize: 12,
    opacity: 0.7,
  },
  accountsList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  accountsHeader: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  accountItem: {
    fontSize: 11,
    marginLeft: 8,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  noWallets: {
    textAlign: 'center',
    opacity: 0.6,
    marginTop: 12,
  },
});
