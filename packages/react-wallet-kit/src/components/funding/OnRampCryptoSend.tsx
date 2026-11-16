import {
  faCheck,
  faChevronRight,
  faCopy,
  faWallet,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type {
  OnRampCaip19,
  OnRampCaip2,
  WalletAccount,
  WalletProvider,
} from "@turnkey/core";
import { useTurnkey } from "../../providers/client/Hook";
import { useModal } from "../../providers/modal/Hook";
import { useSupportedAssets } from "../../providers/SupportedAssetsProvider";
import {
  buildOnRampCryptoTransfer,
  buildUnsignedOnRampTransaction,
  caip2Of,
  chainLabel,
  evmChainId,
  isUserRejected,
  sendErrorMessage,
  solanaRpcUrl,
  onRampTokensForAccount,
  switchSelectedEthereumChain,
  tokenDecimals,
} from "../../utils/funding";
import { truncateAddress } from "../../utils/utils";
import { ActionButton } from "../design/Buttons";
import { EthereumLogo, SolanaLogo } from "../design/Svg";
import { CryptoAmountInput } from "./CryptoAmountInput";
import { OnRampCryptoStatus } from "./OnRampCryptoStatus";

const partyLabelClassName =
  "px-1 text-xs font-medium text-icon-text-light dark:text-icon-text-dark";

export type OnRampCryptoSendProps = {
  destination: WalletAccount;
  externalWallet: WalletProvider;
  externalAccount: WalletAccount;
  lockedCaip19?: OnRampCaip19 | undefined;
  lockedCaip2?: OnRampCaip2 | undefined;
  rpcUrl?: string | undefined;
  successPageDuration?: number | undefined;
  onSuccess?: (() => void) | undefined;
  onError?: ((error: unknown) => void) | undefined;
  onChangeWallet: () => void;
};

export function OnRampCryptoSend(props: OnRampCryptoSendProps) {
  const {
    destination,
    externalWallet,
    externalAccount,
    lockedCaip19,
    lockedCaip2,
    rpcUrl,
    successPageDuration,
    onSuccess,
    onError,
    onChangeWallet,
  } = props;
  const { pushPage, isMobile } = useModal();
  const { signAndSendTransaction } = useTurnkey();
  const { assetsByCaip2 } = useSupportedAssets();
  const [isHoveringFrom, setIsHoveringFrom] = useState(false);
  const [isHoveringTo, setIsHoveringTo] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
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

  useEffect(() => {
    setError(null);
  }, [amount, token]);

  const ChainLogo = isSolanaChain(destination, token)
    ? SolanaLogo
    : EthereumLogo;
  const preparedTransfer = useMemo(() => {
    if (!token) return undefined;
    try {
      return buildOnRampCryptoTransfer({
        token,
        amount,
        decimals: tokenDecimals(token, assetsByCaip2),
        from: externalAccount,
        to: destination,
      });
    } catch {
      return undefined;
    }
  }, [amount, assetsByCaip2, destination, externalAccount, token]);

  const send = async () => {
    if (!preparedTransfer || sending) return;
    setSending(true);
    setError(null);
    try {
      const provider = externalWallet.provider;
      if (preparedTransfer.transactionType === "TRANSACTION_TYPE_ETHEREUM") {
        const chainId = Number(preparedTransfer.caip2.slice("eip155:".length));
        if (evmChainId(externalWallet.chainInfo) !== chainId) {
          await switchSelectedEthereumChain(
            provider,
            `0x${chainId.toString(16)}`,
          );
        }
      }

      const resolvedRpcUrl =
        preparedTransfer.transactionType === "TRANSACTION_TYPE_SOLANA"
          ? solanaRpcUrl(preparedTransfer.caip2, rpcUrl)
          : rpcUrl;
      const unsignedTransaction = await buildUnsignedOnRampTransaction({
        transfer: preparedTransfer,
        provider,
        rpcUrl: resolvedRpcUrl,
      });
      const transactionId = await signAndSendTransaction({
        walletAccount: externalAccount,
        unsignedTransaction,
        transactionType: preparedTransfer.transactionType,
        ...(resolvedRpcUrl ? { rpcUrl: resolvedRpcUrl } : {}),
      });

      pushPage({
        key: "Sending",
        showTitle: false,
        content: (
          <OnRampCryptoStatus
            chain={
              preparedTransfer.transactionType === "TRANSACTION_TYPE_SOLANA"
                ? "solana"
                : "ethereum"
            }
            caip2={preparedTransfer.caip2}
            transactionId={transactionId}
            provider={provider}
            rpcUrl={resolvedRpcUrl}
            successPageDuration={successPageDuration}
            iconUrl={externalWallet.info.icon}
            onSuccess={onSuccess ?? (() => undefined)}
            onError={onError ?? (() => undefined)}
          />
        ),
      });
    } catch (caught) {
      if (!isUserRejected(caught)) {
        setError(sendErrorMessage(caught));
        setShaking(true);
        setTimeout(() => setShaking(false), 250);
      }
      onError?.(caught);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={clsx(
        "relative flex flex-col items-center justify-center gap-4 py-4 text-center",
        isMobile ? "w-full" : "w-96",
      )}
    >
      {token && (
        <div className="flex w-full flex-col items-center">
          <CryptoAmountInput
            value={amount}
            onChange={setAmount}
            token={token}
            tokens={tokens}
            onTokenChange={setToken}
            locked={!!lockedCaip19}
          />
          <p className="-mt-2 text-sm text-icon-text-light dark:text-icon-text-dark">
            on {chainLabel(caip2Of(token))}
          </p>
        </div>
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
            <span className="text-sm">
              {truncateAddress(externalAccount.address)}
            </span>
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
          <ActionButton
            name="onramp-crypto-to"
            disabled={!destination}
            onClick={() => {
              if (!destination) return;
              setShowCopied(true);
              void navigator.clipboard.writeText(destination.address);
              setTimeout(() => setShowCopied(false), 1500);
            }}
            {...(!isMobile && {
              onMouseEnter: () => setIsHoveringTo(true),
              onMouseLeave: () => setIsHoveringTo(false),
            })}
            className={clsx(
              "relative flex w-full items-center gap-2 bg-button-light text-inherit dark:bg-button-dark",
              showCopied ? "overflow-visible" : "overflow-hidden",
            )}
          >
            <span className="relative flex size-6 shrink-0 items-center justify-center">
              <FontAwesomeIcon icon={faWallet} className="size-4" />
              <span className="absolute -right-1.5 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-button-light dark:bg-button-dark">
                <ChainLogo className="size-2.5" />
              </span>
            </span>
            <span className="text-sm">
              {destination ? truncateAddress(destination.address) : ""}
            </span>
            <div
              className={clsx(
                "absolute transition-all duration-200",
                isHoveringTo || showCopied || isMobile ? "right-4" : "-right-4",
              )}
            >
              <div className="relative">
                <FontAwesomeIcon
                  icon={showCopied ? faCheck : faCopy}
                  className={clsx(
                    "transition-colors",
                    showCopied
                      ? "text-success-light dark:text-success-dark"
                      : "text-icon-text-light dark:text-icon-text-dark",
                  )}
                />
                {showCopied && (
                  <FontAwesomeIcon
                    icon={faCheck}
                    className="absolute inset-0 m-auto text-success-light dark:text-success-dark animate-ping"
                  />
                )}
              </div>
            </div>
          </ActionButton>
        </div>
      </div>

      <ActionButton
        name="onramp-crypto-continue"
        disabled={!preparedTransfer || sending}
        loading={sending}
        onClick={() => void send()}
        spinnerClassName="text-primary-text-light dark:text-primary-text-dark"
        className={clsx(
          "w-full bg-primary-light text-primary-text-light dark:bg-primary-dark dark:text-primary-text-dark",
          shaking && "animate-shake",
        )}
      >
        Continue
      </ActionButton>
      <p
        data-testid="onramp-crypto-error"
        className={clsx(
          "text-sm text-danger-light dark:text-danger-dark transition-opacity delay-75 line-clamp-2 w-full",
          error
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none absolute",
        )}
      >
        {error}
      </p>
    </div>
  );
}

function isSolanaChain(
  account?: WalletAccount | undefined,
  token?: OnRampCaip19 | undefined,
) {
  if (account?.addressFormat === "ADDRESS_FORMAT_SOLANA") return true;
  if (account?.addressFormat === "ADDRESS_FORMAT_ETHEREUM") return false;
  return !!token && caip2Of(token).startsWith("solana:");
}
