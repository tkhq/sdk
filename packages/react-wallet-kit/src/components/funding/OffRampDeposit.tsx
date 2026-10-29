import { faCheck, faCopy, faWallet } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  TurnkeyError,
  TurnkeyErrorCodes,
  WalletSource,
  type OnRampCaip19,
  type StamperType,
  type v1FiatRampProvider,
  type WalletAccount,
} from "@turnkey/core";
import { useTurnkey } from "../../providers/client/Hook";
import { useModal } from "../../providers/modal/Hook";
import { useSupportedAssets } from "../../providers/SupportedAssetsProvider";
import {
  applyReturnedAmount,
  buildUnsignedOnRampTransaction,
  chainLabel,
  depositPlan,
  embeddedDepositTransaction,
  ensureEthereumChain,
  evmChainId,
  isDepositAddress,
  isUserRejected,
  positiveAtomic,
  sendErrorMessage,
  tokenSymbol,
  transferFromAsset,
} from "../../utils/funding";
import { truncateAddress } from "../../utils/utils";
import { ActionPage } from "../auth/Action";
import { ActionButton } from "../design/Buttons";
import { EthereumLogo, SolanaLogo } from "../design/Svg";
import { OnRampCryptoStatus } from "./OnRampCryptoStatus";
import { TokenLogo } from "./TokenSelect";
import { providerLogos, providerName } from "./QuoteOption";
import {
  ackOffRampReturn,
  clearOffRampHandoff,
  isOffRampDepositMessage,
  moonPayDeposit,
  readRememberedOffRampDeposit,
  rememberOffRampDeposit,
  rememberOffRampSendError,
  subscribeOffRampReturn,
  type MoonPayDeposit,
} from "./offRampRedirect";

export type OffRampDepositProps = {
  token: OnRampCaip19;
  amount: string;
  atomicAmount: string;
  walletAccount: WalletAccount;
  provider: v1FiatRampProvider;
  organizationId?: string | undefined;
  stampWith?: StamperType | undefined;
  rpcUrl?: string | undefined;
  sandboxMode?: boolean | undefined;
  successPageDuration?: number | undefined;
  widget?: Window | undefined;
  initialAddress?: string | undefined;
  initialAmount?: string | undefined;
  initialTag?: string | undefined;
  onSuccess?: (() => void) | undefined;
};

export function OffRampDeposit(props: OffRampDepositProps) {
  const {
    token,
    amount,
    atomicAmount,
    walletAccount,
    provider,
    organizationId,
    stampWith,
    rpcUrl,
    sandboxMode,
    successPageDuration,
    widget,
    initialAddress,
    initialAmount,
    initialTag,
    onSuccess,
  } = props;
  const { handleSendTransaction, signAndSendTransaction, walletProviders } =
    useTurnkey();
  const { isMobile, pushPage } = useModal();
  const { assetsByCaip2 } = useSupportedAssets();
  const restored = initialAddress ? undefined : readRememberedOffRampDeposit();
  const startingTag = initialTag ?? restored?.tag;
  const [destination, setDestination] = useState(
    initialAddress ?? restored?.address ?? "",
  );
  const [returnedAmount, setReturnedAmount] = useState<string | undefined>(
    initialAmount ?? restored?.amount,
  );
  const [filledFromProvider, setFilledFromProvider] = useState(
    !!(initialAddress || restored?.address),
  );
  const [sending, setSending] = useState(false);
  const [isHoveringFrom, setIsHoveringFrom] = useState(false);
  const [isHoveringTo, setIsHoveringTo] = useState(false);
  const [showCopiedFrom, setShowCopiedFrom] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [error, setError] = useState<string | undefined>(
    startingTag
      ? "MoonPay included a deposit tag. This transfer cannot attach it."
      : restored?.error,
  );
  const providerLabel = providerName(provider);
  const plan = applyReturnedAmount(
    depositPlan({
      token,
      amount,
      atomicAmount,
      provider,
      sandboxMode: !!sandboxMode,
      rpcUrl,
      symbol: tokenSymbol(token, assetsByCaip2),
    }),
    returnedAmount,
  );

  const acceptDeposit = (deposit: MoonPayDeposit) => {
    rememberOffRampDeposit(deposit);
    setDestination(deposit.address);
    setFilledFromProvider(true);
    setError(
      deposit.tag
        ? "MoonPay included a deposit tag. This transfer cannot attach it."
        : undefined,
    );
    if (deposit.amount) setReturnedAmount(deposit.amount);
  };

  const widgetRef = useRef(widget);
  widgetRef.current = widget;
  const acceptDepositRef = useRef(acceptDeposit);
  acceptDepositRef.current = acceptDeposit;

  useEffect(() => {
    if (provider !== "FIAT_RAMP_PROVIDER_MOONPAY") return;
    const seen = new Set<string>();
    let filled = false;

    const take = (deposit: MoonPayDeposit, id?: string) => {
      if (id && !seen.has(id)) {
        seen.add(id);
        ackOffRampReturn(id);
      }
      if (filled) return;
      filled = true;
      acceptDepositRef.current(deposit);
      const popup = widgetRef.current;
      try {
        if (popup && !popup.closed) popup.close();
      } catch {
        // MoonPay can sever the handle. The return window closes itself.
      }
      try {
        window.focus();
      } catch {
        // Ignore focus failures.
      }
    };

    const unsubscribe = subscribeOffRampReturn(({ id, deposit }) =>
      take(deposit, id),
    );
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!isOffRampDepositMessage(event.data)) return;
      take(event.data.deposit, event.data.id);
    };
    window.addEventListener("message", onMessage);

    const timer = window.setInterval(() => {
      const popup = widgetRef.current;
      if (!popup) return;
      try {
        if (popup.closed) return;
        const deposit = moonPayDeposit(popup.location.href);
        if (!deposit) return;
        take(deposit);
      } catch {
        // The window is still on MoonPay. location is readable after it returns here.
      }
    }, 250);

    return () => {
      unsubscribe();
      window.removeEventListener("message", onMessage);
      window.clearInterval(timer);
    };
  }, [provider]);

  const address = destination.trim();
  const canSend =
    plan.mode === "send" &&
    isDepositAddress(plan.caip2, address) &&
    positiveAtomic(plan.atomicAmount);

  const send = async () => {
    if (!walletAccount.address || plan.mode !== "send" || !canSend) return;
    setSending(true);
    setError(undefined);
    try {
      if (walletAccount.source === WalletSource.Connected) {
        const walletProvider = walletProviders.find((provider) =>
          provider.connectedAddresses.some(
            (connected) =>
              connected.toLowerCase() === walletAccount.address.toLowerCase(),
          ),
        );
        if (!walletProvider) {
          throw new TurnkeyError(
            "Reconnect this wallet and try the send again.",
            TurnkeyErrorCodes.NO_WALLET_FOUND,
          );
        }
        const transfer = transferFromAsset({
          caip2: plan.caip2,
          asset: plan.asset,
          quotedToken: token,
          from: walletAccount.address,
          to: address,
          atomicAmount: plan.atomicAmount,
        });
        if (transfer.transactionType === "TRANSACTION_TYPE_ETHEREUM") {
          const chainId = Number(plan.caip2.slice("eip155:".length));
          if (evmChainId(walletProvider.chainInfo) !== chainId) {
            await ensureEthereumChain(walletProvider.provider, chainId);
          }
        }
        const unsignedTransaction = await buildUnsignedOnRampTransaction({
          transfer,
          provider: walletProvider.provider,
          rpcUrl: plan.rpcUrl,
        });
        const transactionId = await signAndSendTransaction({
          walletAccount,
          unsignedTransaction,
          transactionType: transfer.transactionType,
          ...(plan.rpcUrl ? { rpcUrl: plan.rpcUrl } : {}),
          ...(organizationId ? { organizationId } : {}),
          ...(stampWith ? { stampWith } : {}),
        });
        clearOffRampHandoff();
        pushPage({
          key: "Sending",
          showTitle: false,
          content: (
            <OnRampCryptoStatus
              chain={
                transfer.transactionType === "TRANSACTION_TYPE_SOLANA"
                  ? "solana"
                  : "ethereum"
              }
              caip2={plan.caip2}
              transactionId={transactionId}
              provider={walletProvider.provider}
              rpcUrl={plan.rpcUrl}
              successPageDuration={successPageDuration}
              iconUrl={walletProvider.info.icon}
              onSuccess={() => onSuccess?.()}
              onError={(caught) => {
                const message = sendErrorMessage(caught);
                rememberOffRampSendError(message);
                setError(message);
              }}
            />
          ),
        });
        return;
      }

      const transaction = await embeddedDepositTransaction({
        caip2: plan.caip2,
        asset: plan.asset,
        quotedToken: token,
        from: walletAccount.address,
        to: address,
        atomicAmount: plan.atomicAmount,
        rpcUrl: plan.rpcUrl,
      });
      await handleSendTransaction({
        transaction,
        ...(organizationId ? { organizationId } : {}),
        ...(stampWith ? { stampWith } : {}),
        ...(successPageDuration !== undefined ? { successPageDuration } : {}),
      });
      clearOffRampHandoff();
      onSuccess?.();
    } catch (caught) {
      if (
        (caught instanceof TurnkeyError &&
          caught.code === TurnkeyErrorCodes.USER_CANCELED) ||
        isUserRejected(caught)
      ) {
        setSending(false);
        return;
      }
      const message = sendErrorMessage(caught);
      rememberOffRampSendError(message);
      setError(message);
      setShaking(true);
      setTimeout(() => setShaking(false), 250);
      setSending(false);
    }
  };

  const lockedAddress = filledFromProvider && plan.mode === "send";
  const ProviderLogo = providerLogos[provider];

  if (plan.mode === "send" && !lockedAddress) {
    return (
      <ActionPage
        title={`Finish the sale in ${providerLabel}`}
        subtitle="You will be redirected back here to send your funds"
        icon={<ProviderLogo className="size-10" />}
      />
    );
  }

  if (plan.mode === "send") {
    const ChainLogo = plan.caip2.startsWith("solana:")
      ? SolanaLogo
      : EthereumLogo;
    const amountToken =
      tokenSymbol(token, assetsByCaip2) === plan.symbol ? token : undefined;

    return (
      <div
        className={clsx(
          "relative flex flex-col items-center justify-center gap-4 py-4 text-center",
          isMobile ? "w-full" : "w-96",
        )}
      >
        <div className="flex w-full flex-col items-center">
          <div className="flex w-full items-end justify-center gap-1.5 bg-transparent px-4 py-4 text-inherit">
            <div className="relative max-w-full pb-0.5">
              <span className="pointer-events-none absolute top-0 right-full pr-0.5">
                {amountToken ? (
                  <TokenLogo
                    token={amountToken}
                    assetsByCaip2={assetsByCaip2}
                    className="size-3.5"
                  />
                ) : (
                  <span className="block size-3.5 shrink-0 rounded-full bg-icon-background-light dark:bg-icon-background-dark" />
                )}
              </span>
              <span className="whitespace-pre px-0.5 text-6xl font-bold">
                {plan.amount || "0"}
              </span>
            </div>
            <div className="pb-1">
              <span className="text-lg font-bold leading-none">
                {plan.symbol}
              </span>
            </div>
          </div>
          <p className="-mt-2 text-sm text-icon-text-light dark:text-icon-text-dark">
            on {chainLabel(plan.caip2)}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 text-left">
          <div className="flex flex-col gap-1">
            <div className={partyLabelClassName}>From</div>
            <ActionButton
              name="offramp-send-from"
              onClick={() => {
                setShowCopiedFrom(true);
                void navigator.clipboard.writeText(walletAccount.address);
                setTimeout(() => setShowCopiedFrom(false), 1500);
              }}
              {...(!isMobile && {
                onMouseEnter: () => setIsHoveringFrom(true),
                onMouseLeave: () => setIsHoveringFrom(false),
              })}
              className={clsx(
                "relative flex w-full items-center gap-2 bg-button-light text-inherit dark:bg-button-dark",
                showCopiedFrom ? "overflow-visible" : "overflow-hidden",
              )}
            >
              <span className="relative flex size-6 shrink-0 items-center justify-center">
                <FontAwesomeIcon icon={faWallet} className="size-4" />
                <span className="absolute -right-1.5 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-button-light dark:bg-button-dark">
                  <ChainLogo className="size-2.5" />
                </span>
              </span>
              <span className="min-w-0 truncate text-sm">
                {truncateAddress(walletAccount.address)}
              </span>
              <div
                className={clsx(
                  "absolute transition-all duration-200",
                  isHoveringFrom || showCopiedFrom || isMobile
                    ? "right-4"
                    : "-right-4",
                )}
              >
                <div className="relative">
                  <FontAwesomeIcon
                    icon={showCopiedFrom ? faCheck : faCopy}
                    className={clsx(
                      "transition-colors",
                      showCopiedFrom
                        ? "text-success-light dark:text-success-dark"
                        : "text-icon-text-light dark:text-icon-text-dark",
                    )}
                  />
                  {showCopiedFrom && (
                    <FontAwesomeIcon
                      icon={faCheck}
                      className="absolute inset-0 m-auto text-success-light dark:text-success-dark animate-ping"
                    />
                  )}
                </div>
              </div>
            </ActionButton>
          </div>

          <div className="flex flex-col gap-1">
            <div className={partyLabelClassName}>To</div>
            <ActionButton
              name="offramp-send-to"
              onClick={() => {
                setShowCopied(true);
                void navigator.clipboard.writeText(address);
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
              <ProviderLogo className="size-6 shrink-0" />
              <span className="text-sm" data-testid="offramp-deposit-address">
                {truncateAddress(address)}
              </span>
              <div
                className={clsx(
                  "absolute transition-all duration-200",
                  isHoveringTo || showCopied || isMobile
                    ? "right-4"
                    : "-right-4",
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
          name="offramp-send-deposit"
          onClick={() => void send()}
          disabled={!canSend}
          loading={sending}
          spinnerClassName="text-primary-text-light dark:text-primary-text-dark"
          className={clsx(
            "w-full bg-primary-light text-primary-text-light dark:bg-primary-dark dark:text-primary-text-dark",
            shaking && "animate-shake",
          )}
        >
          Continue
        </ActionButton>
        <p
          data-testid="offramp-deposit-error"
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

  return (
    <div
      className={clsx(
        "flex min-w-0 max-w-full flex-col items-center gap-4 py-4 text-center",
        isMobile ? "w-full" : "w-96",
      )}
    >
      <div className="flex flex-col gap-2 px-2">
        <p className="text-base font-medium">{plan.title}</p>
        <p className="text-sm text-icon-text-light dark:text-icon-text-dark">
          {plan.instructions}
        </p>
        {address ? (
          <LockedDepositAddress address={address} provider={providerLabel} />
        ) : null}
      </div>
      {plan.complete && (
        <ActionButton
          name="offramp-sandbox-done"
          onClick={() => onSuccess?.()}
          className="w-full bg-primary-light text-primary-text-light dark:bg-primary-dark dark:text-primary-text-dark"
        >
          Done
        </ActionButton>
      )}
      {error && (
        <p
          className="w-full text-sm text-danger-light dark:text-danger-dark"
          data-testid="offramp-deposit-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function LockedDepositAddress(props: { address: string; provider: string }) {
  const { address, provider } = props;
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex w-full min-w-0 flex-col gap-1 text-left">
      <div className="px-1 text-xs font-medium text-icon-text-light dark:text-icon-text-dark">
        {provider} deposit address
      </div>
      <button
        type="button"
        data-testid="offramp-deposit-address"
        onClick={() => {
          void navigator.clipboard
            .writeText(address)
            .then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            })
            .catch(() => undefined);
        }}
        className="flex w-full min-w-0 items-center gap-3 rounded-md bg-button-light px-3 py-3 text-left text-sm text-inherit dark:bg-button-dark"
      >
        <span className="min-w-0 flex-1 truncate font-mono">
          {truncateAddress(address)}
        </span>
        <FontAwesomeIcon
          icon={copied ? faCheck : faCopy}
          className={clsx(
            "shrink-0",
            copied
              ? "text-success-light dark:text-success-dark"
              : "text-icon-text-light dark:text-icon-text-dark",
          )}
        />
      </button>
    </div>
  );
}

const partyLabelClassName =
  "px-1 text-xs font-medium text-icon-text-light dark:text-icon-text-dark";
