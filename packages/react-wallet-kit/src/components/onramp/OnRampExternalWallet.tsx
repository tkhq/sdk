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
  WalletSource,
  type ConnectedWallet,
  type OnRampCaip19,
  type OnRampCaip2,
  type WalletAccount,
  type WalletProvider,
} from "@turnkey/core";
import { OnRampCryptoSend } from "./OnRampCryptoSend";

export type OnRampExternalWalletProps = {
  walletAccount?: WalletAccount | undefined;
  lockedCaip19?: OnRampCaip19 | undefined;
  lockedCaip2?: OnRampCaip2 | undefined;
};

export function OnRampExternalWallet(props: OnRampExternalWalletProps) {
  const { walletAccount, lockedCaip19, lockedCaip2 } = props;
  const { pushPage, popToPage, isMobile } = useModal();
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
        />
      ),
    });

  const openSend = (externalWallet: WalletProvider, externalAccount: WalletAccount) => {
    popToPage("Fund");
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
          onChangeWallet={openWalletList}
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
            const account = await connectWalletAccount(provider);
            openSend(provider, account);
          }}
        />
      ),
    });
  };

  const openWalletConnect = (provider: WalletProvider) => {
    const connectAndSend = async (selected: WalletProvider) => {
      const account = await connectWalletAccount(selected);
      openSend(selected, account);
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
    const existing = connectedAccount(wallets, provider);
    if (existing) {
      openSend(provider, existing);
      return;
    }

    if (isWalletConnect(provider)) {
      openWalletConnect(provider);
      return;
    }

    connectThenSend(provider);
  };

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

function chainForAccount(account?: WalletAccount | undefined): Chain | undefined {
  if (account?.addressFormat === "ADDRESS_FORMAT_ETHEREUM") return Chain.Ethereum;
  if (account?.addressFormat === "ADDRESS_FORMAT_SOLANA") return Chain.Solana;
  return undefined;
}

function connectedAccount(
  wallets: { source: WalletSource; accounts: WalletAccount[] }[],
  provider: WalletProvider,
): WalletAccount | undefined {
  const address = provider.connectedAddresses[0]?.toLowerCase();
  if (!address) return undefined;

  return wallets
    .filter((wallet): wallet is ConnectedWallet => wallet.source === WalletSource.Connected)
    .flatMap((wallet) => wallet.accounts)
    .find((account) => account.address.toLowerCase() === address);
}
