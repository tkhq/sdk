import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Chain,
  WalletInterfaceType,
  useTurnkey,
  type WalletConnectAppEntry,
  type WalletProvider,
} from "@turnkey/react-native-wallet-kit";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useWalletConnectApps } from "@/hooks/use-wallet-connect-apps";

const CHAIN_LABELS: Record<Chain, string> = {
  [Chain.Ethereum]: "Ethereum",
  [Chain.Solana]: "Solana",
};

type ThemeColors = (typeof Colors)["light"];

const DANGER = "#ef4444";

type Step =
  | { type: "wallets" }
  | { type: "chain"; group: WalletConnectAppEntry[] }
  | { type: "connecting"; entry: WalletConnectAppEntry }
  | { type: "sign"; entry: WalletConnectAppEntry }
  | { type: "disconnect"; provider: WalletProvider };

interface WalletPickerProps {
  visible: boolean;
  onClose: () => void;
  onSign?: (provider: WalletProvider) => Promise<void>;
}

const truncateAddress = (address: string) =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;

const findWalletConnectProvider = (providers: WalletProvider[], chain: Chain) =>
  providers.find(
    (p) =>
      p.interfaceType === WalletInterfaceType.WalletConnect &&
      p.chainInfo.namespace === chain,
  );

// universal links (https://...) need a "/" before the path, custom schemes (metamask://) don't
const buildWalletLink = (baseUri: string, path = "") =>
  baseUri.endsWith("/") || !path ? `${baseUri}${path}` : `${baseUri}/${path}`;

const buildPairingLink = (baseUri: string, pairingUri: string) =>
  buildWalletLink(baseUri, `wc?uri=${encodeURIComponent(pairingUri)}`);

export function WalletPicker({ visible, onClose, onSign }: WalletPickerProps) {
  const colors = Colors[useColorScheme() ?? "light"];
  const { walletProviders, connectWalletAccount, disconnectWalletAccount } =
    useTurnkey();
  const { walletConnectApps, isLoadingApps } = useWalletConnectApps();

  const [step, setStep] = useState<Step>({ type: "wallets" });
  const [search, setSearch] = useState("");
  const [isSigning, setIsSigning] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectFailed, setDisconnectFailed] = useState(false);

  const walletConnectProviders = walletProviders.filter(
    (p) => p.interfaceType === WalletInterfaceType.WalletConnect,
  );
  const hasConnection = walletConnectProviders.some(
    (p) => p.connectedAddresses.length > 0,
  );
  // in connect mode (no `onSign`), an open connection is shown with the option
  // to disconnect instead of the wallet list
  const showConnection = !onSign && step.type === "wallets" && hasConnection;

  // Group wallet apps by id (same wallet across different chains)
  const groups = useMemo(() => {
    const byId = new Map<string, WalletConnectAppEntry[]>();
    for (const entry of walletConnectApps) {
      byId.set(entry.id, [...(byId.get(entry.id) ?? []), entry]);
    }
    return [...byId.values()];
  }, [walletConnectApps]);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter((group) =>
      group[0]!.name.toLowerCase().includes(query),
    );
  }, [groups, search]);

  const connectingEntry = step.type === "connecting" ? step.entry : undefined;
  const activeEntry =
    step.type === "connecting" || step.type === "sign" ? step.entry : undefined;
  const provider = activeEntry
    ? findWalletConnectProvider(walletProviders, activeEntry.chain)
    : undefined;

  // Use a ref to track the latest provider for use in callbacks
  const latestProviderRef = useRef<WalletProvider | undefined>(undefined);
  latestProviderRef.current = provider;

  // bumped on each attempt and on close so stale results are ignored
  const attemptRef = useRef(0);
  // wallet we're already connecting, so the effect doesn't start twice
  const startedForRef = useRef<WalletConnectAppEntry | undefined>(undefined);
  // set while a disconnect is in flight
  const clearingSessionRef = useRef(false);

  const reset = () => {
    attemptRef.current++;
    startedForRef.current = undefined;
    clearingSessionRef.current = false;
    setIsSigning(false);
    setDisconnectFailed(false);
    setSearch("");
    setStep({ type: "wallets" });
  };

  // sign step only when `onSign` is set; otherwise close once connected
  const handleConnected = (entry: WalletConnectAppEntry) => {
    if (onSign) {
      setStep({ type: "sign", entry });
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleWalletPress = (group: WalletConnectAppEntry[]) => {
    if (group.length === 1) {
      setStep({ type: "connecting", entry: group[0]! });
    } else {
      setStep({ type: "chain", group });
    }
  };

  // alert when the wallet app can't be opened
  const openPairingLink = async (entry: WalletConnectAppEntry) => {
    const uri = latestProviderRef.current?.uri ?? "";
    try {
      await Linking.openURL(buildPairingLink(entry.uri, uri));
      return true;
    } catch {
      Alert.alert(
        `Couldn't open ${entry.name}`,
        "Please make sure it's installed.",
      );
      return false;
    }
  };

  useEffect(() => {
    if (!connectingEntry) return;

    // if provider is not found then WalletConnect failed to initialize
    if (!provider) {
      reset();
      return;
    }

    // we don't try to connect if WalletConnect is still initializing or we are already connecting
    if (provider.isLoading) return;
    if (startedForRef.current === connectingEntry) return;

    // Disconnect existing session to avoid confusion
    // Core re-pairs on disconnect, so this effect re-runs with a fresh uri
    if (provider.connectedAddresses.length > 0) {
      if (clearingSessionRef.current) return;
      clearingSessionRef.current = true;
      const attempt = ++attemptRef.current;
      disconnectWalletAccount(provider).catch(() => {
        clearingSessionRef.current = false;
        if (attempt !== attemptRef.current) return;
        setStep({ type: "wallets" });
      });
      return;
    }
    clearingSessionRef.current = false;
    startedForRef.current = connectingEntry;

    const attempt = ++attemptRef.current;
    (async () => {
      try {
        if (!(await openPairingLink(connectingEntry))) {
          if (attempt !== attemptRef.current) return;
          startedForRef.current = undefined;
          setStep({ type: "wallets" });
          return;
        }
        await connectWalletAccount(provider);
        if (attempt !== attemptRef.current) return;
        handleConnected(connectingEntry);
      } catch {
        // noop
      }
    })();
    // should only re-run when the selected wallet or its provider state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectingEntry, provider]);

  const handleSignPress = async (entry: WalletConnectAppEntry) => {
    const connected = latestProviderRef.current;
    if (!connected || !onSign) return;

    const attempt = ++attemptRef.current;
    setIsSigning(true);
    try {
      // start signing first so the request is in flight before iOS backgrounds us
      const signPromise = onSign(connected);
      Linking.openURL(entry.uri).catch(() => {});
      await signPromise;
      if (attempt !== attemptRef.current) return;
      handleClose();
    } catch {
      if (attempt !== attemptRef.current) return;
      setIsSigning(false);
    }
  };

  const handleDisconnectPress = async (walletProvider: WalletProvider) => {
    setIsDisconnecting(true);
    setDisconnectFailed(false);
    try {
      await disconnectWalletAccount(walletProvider);
      handleClose();
    } catch {
      setDisconnectFailed(true);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const title =
    step.type === "chain" || showConnection
      ? "Select a chain"
      : step.type === "wallets"
        ? "Select a wallet"
        : "";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView
        edges={["bottom"]}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.header}>
          {step.type !== "wallets" ? (
            <TouchableOpacity style={styles.headerSide} onPress={reset}>
              <Text style={[styles.headerAction, { color: colors.primary }]}>
                Back
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSide} />
          )}
          <Text style={[styles.title, { color: colors.primaryText }]}>
            {title}
          </Text>
          <TouchableOpacity
            style={[styles.headerSide, styles.headerSideRight]}
            onPress={handleClose}
          >
            <Text style={[styles.headerAction, { color: colors.primary }]}>
              Close
            </Text>
          </TouchableOpacity>
        </View>

        {showConnection ? (
          <View>
            {walletConnectProviders.map((p) => {
              const address = p.connectedAddresses[0];
              return (
                <TouchableOpacity
                  key={p.chainInfo.namespace}
                  onPress={() => setStep({ type: "disconnect", provider: p })}
                  disabled={!address}
                  activeOpacity={0.6}
                >
                  <View
                    style={[
                      styles.row,
                      { borderBottomColor: colors.buttonBorder },
                    ]}
                  >
                    <Image source={{ uri: p.info.icon }} style={styles.icon} />
                    <View style={styles.rowText}>
                      <Text
                        style={[
                          styles.walletName,
                          { color: colors.primaryText },
                        ]}
                      >
                        {CHAIN_LABELS[p.chainInfo.namespace]}
                      </Text>
                      <Text
                        style={[
                          styles.walletChains,
                          { color: colors.secondaryText },
                        ]}
                      >
                        {address
                          ? `Connected · ${truncateAddress(address)}`
                          : "Not connected"}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : step.type === "disconnect" ? (
          <View style={styles.connecting}>
            <Image
              source={{ uri: step.provider.info.icon }}
              style={styles.connectingIcon}
            />
            <Text
              style={[
                styles.connectingTitle,
                { color: disconnectFailed ? DANGER : colors.primaryText },
              ]}
            >
              {disconnectFailed
                ? "You can't disconnect this wallet!"
                : `Disconnect ${step.provider.info.name}`}
            </Text>
            <Text
              style={[styles.connectingHint, { color: colors.secondaryText }]}
            >
              {disconnectFailed
                ? `Try disconnecting directly from the ${step.provider.info.name} app`
                : "You can always connect this wallet again later."}
            </Text>
            <TouchableOpacity
              style={[
                styles.chainButton,
                styles.signButton,
                { backgroundColor: DANGER },
                isDisconnecting && styles.buttonDisabled,
              ]}
              onPress={() => handleDisconnectPress(step.provider)}
              disabled={isDisconnecting}
              activeOpacity={0.8}
            >
              {isDisconnecting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.chainButtonText}>Disconnect Wallet</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : step.type === "sign" ? (
          <View style={styles.connecting}>
            <Image
              source={{ uri: step.entry.icon }}
              style={styles.connectingIcon}
            />
            <Text
              style={[styles.connectingHint, { color: colors.secondaryText }]}
            >
              {step.entry.name} is connected! Please sign the login request
              using the app to continue.
            </Text>
            <TouchableOpacity
              style={[
                styles.chainButton,
                styles.signButton,
                { backgroundColor: colors.primary },
                isSigning && styles.buttonDisabled,
              ]}
              onPress={() => handleSignPress(step.entry)}
              disabled={isSigning}
              activeOpacity={0.8}
            >
              {isSigning ? (
                <View style={styles.signButtonContent}>
                  <ActivityIndicator color="#FFFFFF" />
                  <Text style={styles.chainButtonText}>Check the app...</Text>
                </View>
              ) : (
                <Text style={styles.chainButtonText}>Sign login request</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : step.type === "connecting" ? (
          <View style={styles.connecting}>
            <Image
              source={{ uri: step.entry.icon }}
              style={styles.connectingIcon}
            />
            <Text
              style={[styles.connectingTitle, { color: colors.primaryText }]}
            >
              Connecting to {step.entry.name}
            </Text>
            <ActivityIndicator />
            <Text
              style={[styles.connectingHint, { color: colors.secondaryText }]}
            >
              App not opening? Please ensure you have {step.entry.name}{" "}
              installed or{" "}
              <Text
                style={{ color: colors.primary }}
                onPress={() => openPairingLink(step.entry)}
              >
                try opening {step.entry.name} again.
              </Text>
            </Text>
          </View>
        ) : step.type === "chain" ? (
          <View style={styles.chainStep}>
            <WalletRow group={step.group} colors={colors} />
            {step.group.map((entry) => (
              <TouchableOpacity
                key={entry.chain}
                style={[
                  styles.chainButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={() => setStep({ type: "connecting", entry })}
                activeOpacity={0.8}
              >
                <Text style={styles.chainButtonText}>
                  Continue with {CHAIN_LABELS[entry.chain]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <>
            <TextInput
              style={[
                styles.search,
                {
                  borderColor: colors.inputBorder,
                  color: colors.primaryText,
                  backgroundColor: colors.background,
                },
              ]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search wallets..."
              placeholderTextColor={colors.secondaryText}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {isLoadingApps ? (
              <ActivityIndicator style={styles.status} />
            ) : (
              <FlatList
                data={filteredGroups}
                keyExtractor={(group) => group[0]!.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handleWalletPress(item)}
                    activeOpacity={0.6}
                  >
                    <WalletRow group={item} colors={colors} />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text
                    style={[styles.status, { color: colors.secondaryText }]}
                  >
                    No wallets found
                  </Text>
                }
              />
            )}
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function WalletRow({
  group,
  colors,
}: {
  group: WalletConnectAppEntry[];
  colors: ThemeColors;
}) {
  const { name, icon } = group[0]!;
  return (
    <View style={[styles.row, { borderBottomColor: colors.buttonBorder }]}>
      <Image source={{ uri: icon }} style={styles.icon} />
      <View style={styles.rowText}>
        <Text style={[styles.walletName, { color: colors.primaryText }]}>
          {name}
        </Text>
        <Text style={[styles.walletChains, { color: colors.secondaryText }]}>
          {group.map((entry) => CHAIN_LABELS[entry.chain]).join(" · ")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerSide: {
    width: 60,
  },
  headerSideRight: {
    alignItems: "flex-end",
  },
  headerAction: {
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
  },
  search: {
    height: 48,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  rowText: {
    flex: 1,
  },
  walletName: {
    fontSize: 16,
    fontWeight: "600",
  },
  walletChains: {
    fontSize: 13,
    marginTop: 2,
  },
  chainStep: {
    gap: 12,
  },
  chainButton: {
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  signButton: {
    alignSelf: "stretch",
    marginHorizontal: 0,
  },
  signButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  chainButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  connecting: {
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  connectingIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  connectingTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  connectingHint: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  status: {
    marginTop: 40,
    textAlign: "center",
  },
});
