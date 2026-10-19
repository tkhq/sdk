import { faChevronRight, faWallet } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type {
  OnRampCaip19,
  OnRampCaip2,
  WalletAccount,
  WalletProvider,
} from "@turnkey/core";
import { useModal } from "../../providers/modal/Hook";
import { ActionButton } from "../design/Buttons";
import { EthereumLogo, SolanaLogo } from "../design/Svg";
import { CryptoAmountInput } from "./CryptoAmountInput";
import { onRampTokensForAccount } from "./onRampTokens";
import { caip2Of } from "./tokenSymbol";

const partyLabelClassName =
  "px-1 text-xs font-medium text-icon-text-light dark:text-icon-text-dark";
const partyBoxClassName =
  "box-border! flex w-full items-center gap-2 rounded-md border border-modal-background-dark/15 bg-button-light px-4 py-3 text-inherit dark:border-modal-background-light/15 dark:bg-button-dark";

export type OnRampCryptoSendProps = {
  destination?: WalletAccount | undefined;
  externalWallet: WalletProvider;
  externalAccount: WalletAccount;
  lockedCaip19?: OnRampCaip19 | undefined;
  lockedCaip2?: OnRampCaip2 | undefined;
  onChangeWallet: () => void;
};

export function OnRampCryptoSend(props: OnRampCryptoSendProps) {
  const {
    destination,
    externalWallet,
    externalAccount,
    lockedCaip19,
    lockedCaip2,
    onChangeWallet,
  } = props;
  const { isMobile } = useModal();
  const [isHoveringFrom, setIsHoveringFrom] = useState(false);
  const tokens = useMemo(
    () =>
      onRampTokensForAccount(destination, {
        caip19: lockedCaip19,
        caip2: lockedCaip2,
      }),
    [destination, lockedCaip19, lockedCaip2],
  );
  const [token, setToken] = useState<OnRampCaip19 | undefined>(
    lockedCaip19 ?? tokens[0],
  );
  const [amount, setAmount] = useState("0");

  useEffect(() => {
    if (lockedCaip19) {
      setToken(lockedCaip19);
      return;
    }
    if (!token || !tokens.includes(token)) {
      setToken(tokens[0]);
    }
  }, [lockedCaip19, token, tokens]);

  const ChainLogo = isSolanaChain(destination, token) ? SolanaLogo : EthereumLogo;

  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center gap-4 py-4 text-center",
        isMobile ? "w-full" : "w-96",
      )}
    >
      {token && (
        <CryptoAmountInput
          value={amount}
          onChange={setAmount}
          token={token}
          tokens={tokens}
          onTokenChange={setToken}
          locked={!!lockedCaip19}
        />
      )}

      <div className="flex w-full flex-col gap-2 text-left">
        <div className="flex flex-col gap-1">
          <div className={partyLabelClassName}>From</div>
          <ActionButton
            name="onramp-crypto-from"
            onClick={onChangeWallet}
            {...(!isMobile && {
              onMouseEnter: () => setIsHoveringFrom(true),
              onMouseLeave: () => setIsHoveringFrom(false),
            })}
            className="relative flex w-full items-center gap-2 overflow-hidden bg-button-light text-inherit dark:bg-button-dark"
          >
            {externalWallet.info.icon ? (
              <img
                src={externalWallet.info.icon}
                alt=""
                className="size-6 shrink-0 rounded-full"
              />
            ) : (
              <span className="size-6 shrink-0 rounded-full bg-icon-background-light dark:bg-icon-background-dark" />
            )}
            <span className="text-sm">{truncateAddress(externalAccount.address)}</span>
            <FontAwesomeIcon
              className={clsx(
                "absolute transition-all duration-200 text-icon-text-light dark:text-icon-text-dark",
                isHoveringFrom ? "right-4" : "-right-4",
              )}
              icon={faChevronRight}
            />
          </ActionButton>
        </div>

        <div className="flex flex-col gap-1">
          <div className={partyLabelClassName}>To</div>
          <div className={partyBoxClassName}>
            <span className="relative flex size-6 shrink-0 items-center justify-center">
              <FontAwesomeIcon icon={faWallet} className="size-4" />
              <span className="absolute -right-1.5 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-button-light dark:bg-button-dark">
                <ChainLogo className="size-2.5" />
              </span>
            </span>
            <span className="text-sm">
              {destination ? truncateAddress(destination.address) : ""}
            </span>
          </div>
        </div>
      </div>

      <ActionButton
        name="onramp-crypto-continue"
        className="w-full bg-primary-light text-primary-text-light dark:bg-primary-dark dark:text-primary-text-dark"
      >
        Continue
      </ActionButton>
    </div>
  );
}

function truncateAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function isSolanaChain(
  account?: WalletAccount | undefined,
  token?: OnRampCaip19 | undefined,
) {
  if (account?.addressFormat === "ADDRESS_FORMAT_SOLANA") return true;
  if (account?.addressFormat === "ADDRESS_FORMAT_ETHEREUM") return false;
  return !!token && caip2Of(token).startsWith("solana:");
}
