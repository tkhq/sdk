import { useEffect, useRef } from "react";
import { useTurnkey } from "../../providers/client/Hook";
import { useModal } from "../../providers/modal/Hook";
import { ActionPage } from "../auth/Action";
import { WalletButton } from "../auth/wallet/WalletButton";
import { DesktopWalletConnectScreen } from "../auth/wallet/DesktopWalletConnectScreen";
import { MobileWalletConnectScreen } from "../auth/wallet/MobileWalletConnectScreen";
import { ShowAllWalletsScreen } from "../auth/wallet/ShowAllWalletsScreen";
import { isWalletConnect } from "../../utils/utils";
import clsx from "clsx";
import {
  Chain,
  type OnRampCaip19,
  type OnRampCaip2,
  type WalletAccount,
  type WalletProvider,
} from "@turnkey/core";
import {
  accountsForProvider,
  OnRampExternalAccountSelector,
} from "./OnRampExternalAccountSelector";
import { OnRampCryptoSend } from "./OnRampCryptoSend";

export type OnRampExternalWalletProps = {
  walletAccount: WalletAccount;
  lockedCaip19?: OnRampCaip19 | undefined;
  lockedCaip2?: OnRampCaip2 | undefined;
  rpcUrl?: string | undefined;
  successPageDuration?: number | undefined;
  onSuccess?: (() => void) | undefined;
  onError?: ((error: unknown) => void) | undefined;
};

export function OnRampExternalWallet(props: OnRampExternalWalletProps) {
  const {
    walletAccount,
    lockedCaip19,
    lockedCaip2,
    rpcUrl,
    successPageDuration,
    onSuccess,
    onError,
  } = props;
  const { pushPage, popPage, popToPage, isMobile } = useModal();
  const { walletProviders, wallets, connectWalletAccount } = useTurnkey();
  const chain = chainForAccount(walletAccount);

  const providers = walletProviders.filter(
    (provider) => !chain || provider.chainInfo.namespace === chain,
  );
  const grouped = providers.reduce<Record<string, WalletProvider[]>>(
    (acc, provider) => {
      const name = provider.info.name;
      if (!acc[name]) acc[name] = [];
      acc[name]!.push(provider);
      return acc;
    },
    {},
  );

  const openWalletList = () =>
    pushPage({
      key: "Select wallet provider",
      content: (
        <OnRampExternalWallet
          walletAccount={walletAccount}
          lockedCaip19={lockedCaip19}
          lockedCaip2={lockedCaip2}
          rpcUrl={rpcUrl}
          successPageDuration={successPageDuration}
          onSuccess={onSuccess}
          onError={onError}
        />
      ),
    });

  const openSend = (
    externalWallet: WalletProvider,
    externalAccount: WalletAccount,
  ) => {
    popToPage("Deposit");
    pushPage({
      key: "Send",
      showTitle: false,
      content: (
        <OnRampCryptoSend
          destination={walletAccount}
          externalWallet={externalWallet}
          externalAccount={externalAccount}
          lockedCaip19={lockedCaip19}
          lockedCaip2={lockedCaip2}
          rpcUrl={rpcUrl}
          successPageDuration={successPageDuration}
          onSuccess={onSuccess}
          onError={onError}
          onChangeWallet={openWalletList}
        />
      ),
    });
  };

  const openAccounts = (provider: WalletProvider) => {
    const current =
      walletProviders.find(
        (item) =>
          item.info.name === provider.info.name &&
          item.chainInfo.namespace === provider.chainInfo.namespace,
      ) ?? provider;
    const accounts = accountsForProvider(wallets, current);
    if (accounts.length === 1 && accounts[0]) {
      openSend(current, accounts[0]);
      return;
    }

    popToPage("Select wallet provider");
    pushPage({
      key: "Select account",
      content: (
        <OnRampExternalAccountSelector
          provider={provider}
          onSelect={openSend}
        />
      ),
    });
  };

  const connectThenSend = (provider: WalletProvider) => {
    pushPage({
      key: `Connect ${provider.info.name}`,
      showTitle: false,
      content: (
        <ActionPage
          title={`Connecting ${provider.info.name}`}
          closeOnComplete={false}
          icon={
            <img
              className="size-11 rounded-full"
              src={provider.info.icon || ""}
            />
          }
          action={async () => {
            await connectWalletAccount(provider);
            openAccounts(provider);
          }}
        />
      ),
    });
  };

  const openWalletConnect = (provider: WalletProvider) => {
    const connectAndSend = async (selected: WalletProvider) => {
      await connectWalletAccount(selected);
      openAccounts(selected);
    };

    const pushQr = (
      selected: WalletProvider,
      onSelectAllWallets?: () => Promise<void>,
    ) => {
      pushPage({
        key: "Connect WalletConnect",
        content: (
          <DesktopWalletConnectScreen
            provider={selected}
            closeOnComplete={false}
            onAction={connectAndSend}
            {...(onSelectAllWallets
              ? { onSelectAllWallets, selectAllPopCount: 1 }
              : {})}
          />
        ),
      });
    };

    const pushDeepLink = (selected: WalletProvider) => {
      pushPage({
        key: "Open app",
        content: (
          <MobileWalletConnectScreen
            provider={selected}
            closeOnComplete={false}
            onConnect={connectAndSend}
            onSelectQRCode={async () => pushQr(selected)}
          />
        ),
      });
    };

    const pushAppList = () => {
      pushPage({
        key: "Connect WalletConnect",
        content: (
          <ShowAllWalletsScreen
            chain={chain}
            onSelect={async (selected) => pushDeepLink(selected)}
            onSelectQRCode={async () => pushQr(provider)}
          />
        ),
      });
    };

    if (!isMobile) {
      pushQr(provider, async () => pushAppList());
      return;
    }

    pushAppList();
  };

  const selectProvider = (provider: WalletProvider) => {
    if (provider.connectedAddresses.length > 0) {
      openAccounts(provider);
      return;
    }

    if (isWalletConnect(provider)) {
      openWalletConnect(provider);
      return;
    }

    connectThenSend(provider);
  };

  const groups = Object.values(grouped);
  const onlyProvider = groups.length === 1 ? groups[0]?.[0] : undefined;
  const didAutoSelect = useRef(false);

  useEffect(() => {
    if (didAutoSelect.current || !onlyProvider) return;
    didAutoSelect.current = true;
    // Drop this page so Back does not return to a one-item list.
    popPage();
    selectProvider(onlyProvider);
  }, [onlyProvider, popPage, selectProvider]);

  if (onlyProvider) return null;

  if (Object.keys(grouped).length === 0) {
    return (
      <div
        className={clsx(
          "mt-4 flex h-40 flex-col items-center justify-center gap-2 text-center text-xs text-icon-text-light dark:text-icon-text-dark",
          isMobile ? "w-full" : "w-80",
        )}
      >
        <span className="text-sm font-medium">
          No wallet providers available.
        </span>
        <span>
          Only wallets supporting EIP-1193 (Ethereum) or the Solana wallet
          standard are supported.
        </span>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "tk-scrollbar mt-12 max-h-64 min-h-42 overflow-y-auto p-0.5",
        isMobile ? "w-full" : "w-80",
      )}
    >
      <div className="flex flex-col gap-2">
        {Object.entries(grouped).map(([name, group]) => {
          const first = group[0]!;
          return (
            <WalletButton
              key={name}
              icon={first.info.icon ?? ""}
              name={first.info.name ?? ""}
              chains={group.map((provider) => ({
                namespace: provider.chainInfo.namespace,
                isConnected: provider.connectedAddresses.length > 0,
              }))}
              onClick={() => selectProvider(first)}
              isMobile={isMobile}
            />
          );
        })}
      </div>
    </div>
  );
}

function chainForAccount(
  account?: WalletAccount | undefined,
): Chain | undefined {
  if (account?.addressFormat === "ADDRESS_FORMAT_ETHEREUM")
    return Chain.Ethereum;
  if (account?.addressFormat === "ADDRESS_FORMAT_SOLANA") return Chain.Solana;
  return undefined;
}
