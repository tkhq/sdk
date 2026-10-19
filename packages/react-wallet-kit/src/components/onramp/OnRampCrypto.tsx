import { faChevronRight, faWallet } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import { useMemo, useState } from "react";
import {
  Chain,
  type OnRampCaip19,
  type OnRampCaip2,
  type WalletAccount,
  type WalletConnectAppEntry,
  type WalletProvider,
} from "@turnkey/core";
import { useTurnkey } from "../../providers/client/Hook";
import { useModal } from "../../providers/modal/Hook";
import { useWalletConnect } from "../../providers/WalletConnectProvider";
import { isWalletConnect } from "../../utils/utils";
import { ActionButton } from "../design/Buttons";
import { OnRampExternalWallet } from "./OnRampExternalWallet";

export function OnRampCrypto(props: {
  walletAccount?: WalletAccount | undefined;
  lockedCaip19?: OnRampCaip19 | undefined;
  lockedCaip2?: OnRampCaip2 | undefined;
  rpcUrl?: string | undefined;
  successPageDuration?: number | undefined;
  onSuccess?: (() => void) | undefined;
  onError?: ((error: unknown) => void) | undefined;
}) {
  const {
    walletAccount,
    lockedCaip19,
    lockedCaip2,
    rpcUrl,
    successPageDuration,
    onSuccess,
    onError,
  } = props;
  const { pushPage, isMobile } = useModal();
  const { walletProviders } = useTurnkey();
  const { walletConnectApps } = useWalletConnect();
  const [isHovering, setIsHovering] = useState(false);
  const icons = useMemo(
    () =>
      previewWalletIcons({
        providers: walletProviders,
        apps: walletConnectApps,
        chain: chainForAccount(walletAccount),
      }),
    [walletAccount, walletConnectApps, walletProviders],
  );

  return (
    <div className="flex w-full flex-col gap-2">
      <ActionButton
        name="onramp-external-wallet"
        onClick={() =>
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
          })
        }
        {...(!isMobile && {
          onMouseEnter: () => setIsHovering(true),
          onMouseLeave: () => setIsHovering(false),
        })}
        className="relative flex w-full items-center justify-between gap-2 overflow-hidden bg-button-light text-inherit dark:bg-button-dark"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center">
            <FontAwesomeIcon icon={faWallet} className="size-4" />
          </span>
          <span className="flex flex-col items-start">
            <span>External wallet</span>
            <span className="text-xs text-icon-text-light dark:text-icon-text-dark">
              Send from a connected external wallet
            </span>
          </span>
        </span>
        {icons.length > 0 && (
          <span className="flex shrink-0 items-center gap-1">
            {icons.map((icon, index) => (
              <span
                key={`${icon}-${index}`}
                style={{ transitionDelay: `${50 + index * 30}ms` }}
                className={clsx(
                  "relative size-4 transition-all duration-200",
                  isHovering ? "-translate-x-8" : "translate-x-0",
                )}
              >
                <img src={icon} alt="" className="size-4 rounded-full" />
              </span>
            ))}
          </span>
        )}
        <FontAwesomeIcon
          className={clsx(
            "absolute transition-all duration-200 text-icon-text-light dark:text-icon-text-dark",
            isHovering ? "right-4" : "-right-4",
          )}
          icon={faChevronRight}
        />
      </ActionButton>
    </div>
  );
}

function previewWalletIcons(params: {
  providers: WalletProvider[];
  apps: WalletConnectAppEntry[];
  chain?: Chain | undefined;
}) {
  const providers = params.providers.filter(
    (provider) =>
      !params.chain || provider.chainInfo.namespace === params.chain,
  );
  const onlyWalletConnect =
    providers.length > 0 && providers.every(isWalletConnect);

  // If there is only one provider and it is a WalletConnect app, return the icons for the apps
  if (onlyWalletConnect) {
    const seen = new Set<string>();
    const icons: string[] = [];
    for (const app of params.apps) {
      if (params.chain && app.chain !== params.chain) continue;
      if (!app.icon || seen.has(app.id)) continue;
      seen.add(app.id);
      icons.push(app.icon);
      if (icons.length === 3) break;
    }
    return icons;
  }

  // Otherwise, return the icons for the providers
  return providers
    .map((provider) => provider.info.icon)
    .filter((icon): icon is string => !!icon)
    .slice(0, 3);
}

function chainForAccount(account?: WalletAccount | undefined) {
  if (account?.addressFormat === "ADDRESS_FORMAT_ETHEREUM")
    return Chain.Ethereum;
  if (account?.addressFormat === "ADDRESS_FORMAT_SOLANA") return Chain.Solana;
  return undefined;
}
