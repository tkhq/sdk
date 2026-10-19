import { faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  Chain,
  WalletSource,
  type WalletAccount,
  type WalletProvider,
} from "@turnkey/core";
import { useTurnkey } from "../../providers/client/Hook";
import { useModal } from "../../providers/modal/Hook";
import { ActionButton } from "../design/Buttons";
import { EthereumLogo, SolanaLogo } from "../design/Svg";

export function OnRampExternalAccountSelector(props: {
  provider: WalletProvider;
  onSelect: (provider: WalletProvider, account: WalletAccount) => void;
}) {
  const { provider, onSelect } = props;
  const { walletProviders, wallets } = useTurnkey();
  const { isMobile } = useModal();
  const current =
    walletProviders.find(
      (item) =>
        item.info.name === provider.info.name &&
        item.chainInfo.namespace === provider.chainInfo.namespace,
    ) ?? provider;
  const accounts = accountsForProvider(wallets, current);
  const didSkip = useRef(false);

  useEffect(() => {
    if (didSkip.current || accounts.length !== 1) return;
    const account = accounts[0];
    if (!account) return;
    didSkip.current = true;
    onSelect(current, account);
  }, [accounts, current, onSelect]);

  if (accounts.length < 2) return null;

  const ChainLogo =
    current.chainInfo.namespace === Chain.Solana ? SolanaLogo : EthereumLogo;

  return (
    <div
      className={clsx(
        "mt-11 flex w-72 flex-col items-center justify-center gap-4",
        isMobile ? "w-full" : "w-72",
      )}
    >
      <img src={current.info.icon} alt="" className="size-14 rounded-full" />
      <span className="text-center text-sm text-icon-text-light dark:text-icon-text-dark">
        {`You have multiple accounts for ${current.info.name ?? "this wallet provider"}. Select which account you would like to use.`}
      </span>
      <div className="tk-scrollbar flex max-h-64 w-full flex-col gap-2 overflow-y-auto p-0.5">
        {accounts.map((account) => (
          <AccountButton
            key={account.walletAccountId}
            account={account}
            ChainLogo={ChainLogo}
            onSelect={() => onSelect(current, account)}
          />
        ))}
      </div>
    </div>
  );
}

function AccountButton(props: {
  account: WalletAccount;
  ChainLogo: typeof EthereumLogo;
  onSelect: () => void;
}) {
  const { account, ChainLogo, onSelect } = props;
  const { isMobile } = useModal();
  const [isHovering, setIsHovering] = useState(false);

  return (
    <ActionButton
      name="onramp-external-account"
      onClick={onSelect}
      {...(!isMobile && {
        onMouseEnter: () => setIsHovering(true),
        onMouseLeave: () => setIsHovering(false),
      })}
      className="relative flex w-full items-center justify-start gap-2 overflow-hidden bg-button-light text-inherit dark:bg-button-dark"
    >
      <ChainLogo className="size-5" />
      <span>
        {account.address.slice(0, 4)}...{account.address.slice(-3)}
      </span>
      <FontAwesomeIcon
        className={clsx(
          "absolute text-icon-text-light transition-all duration-200 dark:text-icon-text-dark",
          isHovering ? "right-4" : "-right-4",
        )}
        icon={faChevronRight}
      />
    </ActionButton>
  );
}

export function accountsForProvider(
  wallets: {
    source: WalletSource;
    walletId: string;
    accounts: WalletAccount[];
  }[],
  provider: WalletProvider,
) {
  const walletId =
    provider.info.name?.toLowerCase().replace(/\s+/g, "-") || "unknown";
  const addressFormat =
    provider.chainInfo.namespace === Chain.Solana
      ? "ADDRESS_FORMAT_SOLANA"
      : "ADDRESS_FORMAT_ETHEREUM";
  const connected = new Set(
    provider.connectedAddresses.map((address) => address.toLowerCase()),
  );

  return wallets
    .filter(
      (wallet) =>
        wallet.source === WalletSource.Connected &&
        wallet.walletId === walletId,
    )
    .flatMap((wallet) => wallet.accounts)
    .filter(
      (account) =>
        account.addressFormat === addressFormat &&
        connected.has(account.address.toLowerCase()),
    );
}
