import { Platform, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link } from 'expo-router';
import { useTurnkey } from '@turnkey/react-native-wallet-kit';

export default function HomeScreen() {
  const { logout, session, authState } = useTurnkey();

  console.log('logout', logout);
  console.log('session', session);
  console.log('authState', authState);

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
            <TouchableOpacity style={styles.logoutButton} onPress={() => logout()}>
              <ThemedText style={styles.logoutButtonText}>Logout</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        )}

        <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 1: Try it</ThemedText>
        <ThemedText>
          Edit <ThemedText type="defaultSemiBold">app/(tabs)/index.tsx</ThemedText> to see changes.
          Press{' '}
          <ThemedText type="defaultSemiBold">
            {Platform.select({
              ios: 'cmd + d',
              android: 'cmd + m',
              web: 'F12',
            })}
          </ThemedText>{' '}
          to open developer tools.
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <Link href="/modal">
          <Link.Trigger>
            <ThemedText type="subtitle">Step 2: Explore</ThemedText>
          </Link.Trigger>
          <Link.Preview />
          <Link.Menu>
            <Link.MenuAction title="Action" icon="cube" onPress={() => alert('Action pressed')} />
            <Link.MenuAction
              title="Share"
              icon="square.and.arrow.up"
              onPress={() => alert('Share pressed')}
            />
            <Link.Menu title="More" icon="ellipsis">
              <Link.MenuAction
                title="Delete"
                icon="trash"
                destructive
                onPress={() => alert('Delete pressed')}
              />
            </Link.Menu>
          </Link.Menu>
        </Link>

        <ThemedText>
          {`Tap the Explore tab to learn more about what's included in this starter app.`}
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 3: Get a fresh start</ThemedText>
        <ThemedText>
          {`When you're ready, run `}
          <ThemedText type="defaultSemiBold">npm run reset-project</ThemedText> to get a fresh{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> directory. This will move the current{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> to{' '}
          <ThemedText type="defaultSemiBold">app-example</ThemedText>.
        </ThemedText>
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
});
