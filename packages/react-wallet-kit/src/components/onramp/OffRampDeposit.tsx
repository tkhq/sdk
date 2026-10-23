import { faCheck, faCopy } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { encodeFunctionData, type Hex } from "viem";
import {
  TurnkeyError,
  TurnkeyErrorCodes,
  type EthTransaction,
  type OnRampCaip19,
  type SolanaTransaction,
  type StamperType,
  type v1FiatOnRampProvider,
  type WalletAccount,
} from "@turnkey/core";
import { useTurnkey } from "../../providers/client/Hook";
import { useModal } from "../../providers/modal/Hook";
import { useSupportedAssets } from "../../providers/SupportedAssetsProvider";
import {
  buildUnsignedSolanaTransaction,
  caip2Of,
  tokenSymbol,
  type OnRampCryptoTransfer,
} from "../../utils/onramp";
import { ActionButton } from "../design/Buttons";
import { providerName } from "./QuoteOption";
import {
  clearOffRampHandoff,
  isOffRampDepositMessage,
  moonPayDeposit,
  type MoonPayDeposit,
} from "./offRampRedirect";

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
] as const;

export type OffRampDepositProps = {
  token: OnRampCaip19;
  amount: string;
  atomicAmount: string;
  walletAccount: WalletAccount;
  provider: v1FiatOnRampProvider;
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
  const { handleSendTransaction } = useTurnkey();
  const { isMobile } = useModal();
  const { assetsByCaip2 } = useSupportedAssets();
  const [destination, setDestination] = useState(initialAddress ?? "");
  const [returnedAmount, setReturnedAmount] = useState<string | undefined>(
    initialAmount,
  );
  const [filledFromProvider, setFilledFromProvider] =
    useState(!!initialAddress);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | undefined>(
    initialTag
      ? "MoonPay included a deposit tag. This transfer cannot attach it."
      : undefined,
  );
  const providerLabel = providerName(provider);
  const plan = applyReturnedAmount(
    depositPlan({
      token,
      amount,
      atomicAmount,
      provider,
      providerLabel,
      sandboxMode: !!sandboxMode,
      rpcUrl,
      symbol: tokenSymbol(token, assetsByCaip2),
    }),
    returnedAmount,
  );

  const acceptDeposit = (deposit: MoonPayDeposit) => {
    setDestination(deposit.address);
    setFilledFromProvider(true);
    setError(
      deposit.tag
        ? "MoonPay included a deposit tag. This transfer cannot attach it."
        : undefined,
    );
    if (deposit.amount) setReturnedAmount(deposit.amount);
  };

  useEffect(() => {
    if (provider !== "FIAT_ON_RAMP_PROVIDER_MOONPAY") return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!isOffRampDepositMessage(event.data)) return;
      acceptDeposit(event.data.deposit);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [provider, widget]);

  useEffect(() => {
    if (provider !== "FIAT_ON_RAMP_PROVIDER_MOONPAY" || !widget) return;
    const timer = window.setInterval(() => {
      try {
        if (widget.closed) {
          window.clearInterval(timer);
          return;
        }
        const deposit = moonPayDeposit(widget.location.href);
        if (!deposit) return;
        window.clearInterval(timer);
        acceptDeposit(deposit);
      } catch {
        // The window is still on MoonPay. location is readable after it returns here.
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [provider, widget]);

  const address = destination.trim();
  const canSend =
    plan.mode === "send" &&
    isDepositAddress(plan.caip2, address) &&
    positiveAtomic(plan.atomicAmount);

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setDestination(text.trim());
      setFilledFromProvider(false);
      setError(undefined);
    } catch {
      setError("Allow clipboard access, or paste the address into the field.");
    }
  };

  const send = async () => {
    if (!walletAccount.address || plan.mode !== "send" || !canSend) return;
    setSending(true);
    setError(undefined);
    try {
      const transaction = await depositTransaction({
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
        caught instanceof TurnkeyError &&
        caught.code === TurnkeyErrorCodes.USER_CANCELED
      ) {
        setSending(false);
        return;
      }
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to send this transfer.",
      );
      setSending(false);
    }
  };

  const lockedAddress = filledFromProvider && plan.mode === "send";

  return (
    <div
      className={clsx(
        "flex min-w-0 max-w-full flex-col items-center gap-4 py-4 text-center",
        isMobile ? "w-full" : "w-96",
      )}
    >
      {lockedAddress ? (
        <div className="flex w-full min-w-0 max-w-full flex-col items-center gap-1 px-2">
          <p className="max-w-full truncate text-5xl font-bold leading-none">
            {plan.amount}
          </p>
          <p className="text-sm text-icon-text-light dark:text-icon-text-dark">
            {plan.symbol} on {plan.network}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-2">
          <p className="text-base font-medium">{plan.title}</p>
          <p className="text-sm text-icon-text-light dark:text-icon-text-dark">
            {plan.instructions}
          </p>
          {plan.mode === "hold" && address ? (
            <LockedDepositAddress address={address} provider={providerLabel} />
          ) : null}
        </div>
      )}
      {plan.mode === "send" && (
        <>
          {lockedAddress ? (
            <LockedDepositAddress address={address} provider={providerLabel} />
          ) : (
            <>
              <div className="w-full min-w-0">
                <input
                  data-testid="offramp-deposit-address"
                  size={1}
                  value={destination}
                  placeholder="Deposit address"
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => {
                    setDestination(event.target.value);
                    setFilledFromProvider(false);
                  }}
                  className="box-border w-full min-w-0 rounded-md border border-modal-background-dark/20 bg-button-light px-3 py-2 text-left font-mono text-xs text-inherit placeholder-icon-text-light focus:outline-[1px] focus:outline-primary-light dark:border-modal-background-light/20 dark:bg-button-dark dark:placeholder-icon-text-dark focus:dark:outline-primary-dark"
                />
              </div>
              <ActionButton
                name="offramp-paste-address"
                onClick={() => void paste()}
                className="w-full bg-button-light text-inherit dark:bg-button-dark"
              >
                Paste address
              </ActionButton>
            </>
          )}
          <ActionButton
            name="offramp-send-deposit"
            onClick={() => void send()}
            disabled={!canSend}
            loading={sending}
            className="w-full bg-primary-light text-primary-text-light dark:bg-primary-dark dark:text-primary-text-dark"
            spinnerClassName="text-primary-text-light dark:text-primary-text-dark"
          >
            Send {plan.symbol}
          </ActionButton>
        </>
      )}
      {plan.mode === "hold" && plan.complete && (
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
          className="w-full text-sm text-red-500"
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

function truncateAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const SEPOLIA = "eip155:11155111";
const SOLANA_DEVNET = "solana:devnet";
const SOLANA_DEVNET_RPC = "https://api.devnet.solana.com";
// MoonPay's Sepolia ERC-20. Sandbox sells of USDC and other tokens deliver this, not the real token. 18 decimals.
const MOONPAY_TOKEN = "0x699cfe8997d647d03325ef4bfd039d5bb0984a17";
const POLYGON_ETH =
  "eip155:137/erc20:0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";

const NETWORK_LABELS: Record<string, string> = {
  "eip155:1": "Ethereum",
  "eip155:10": "Optimism",
  "eip155:137": "Polygon",
  "eip155:8453": "Base",
  "eip155:42161": "Arbitrum",
  [SEPOLIA]: "Sepolia",
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "Solana",
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d": "Solana",
  [SOLANA_DEVNET]: "Solana Devnet",
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1": "Solana Devnet",
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG": "Solana Devnet",
};

type DepositPlan =
  | {
      mode: "send";
      caip2: string;
      asset: string;
      symbol: string;
      network: string;
      amount: string;
      atomicAmount: string;
      title: string;
      instructions: string;
      rpcUrl?: string | undefined;
    }
  | {
      mode: "hold";
      title: string;
      instructions: string;
      complete: boolean;
    };

function depositPlan(params: {
  token: OnRampCaip19;
  amount: string;
  atomicAmount: string;
  provider: v1FiatOnRampProvider;
  providerLabel: string;
  sandboxMode: boolean;
  rpcUrl?: string | undefined;
  symbol: string;
}): DepositPlan {
  const { token, amount, provider, providerLabel, symbol } = params;
  const quotedCaip2 = caip2Of(token);
  const quotedNetwork = networkLabel(quotedCaip2);

  if (!params.sandboxMode) {
    return sendPlan({
      caip2: quotedCaip2,
      asset: assetOf(token),
      symbol,
      network: quotedNetwork,
      amount,
      atomicAmount: params.atomicAmount,
      rpcUrl: params.rpcUrl,
      instructions: depositInstructions(
        provider,
        providerLabel,
        `This sends ${amount} ${symbol} on ${quotedNetwork}.`,
      ),
    });
  }

  if (provider === "FIAT_ON_RAMP_PROVIDER_COINBASE") {
    return {
      mode: "hold",
      complete: false,
      title: "Coinbase offramp is live only",
      instructions: "Turn sandbox mode off to sell through Coinbase.",
    };
  }

  if (quotedCaip2.startsWith("solana:")) {
    if (assetOf(token).startsWith("token:")) {
      return {
        mode: "hold",
        complete: false,
        title: "Solana devnet does not support this token",
        instructions:
          "MoonPay sandbox accepts native SOL on Solana devnet. SPL tokens such as USDC are only available when sandbox mode is off.",
      };
    }
    return sendPlan({
      caip2: SOLANA_DEVNET,
      asset: "slip44:501",
      symbol: "SOL",
      network: "Solana Devnet",
      amount,
      atomicAmount: params.atomicAmount,
      rpcUrl: params.rpcUrl ?? SOLANA_DEVNET_RPC,
      instructions: `MoonPay sandbox does not use mainnet SOL. ${depositInstructions(provider, providerLabel, `This sends ${amount} SOL on Solana devnet.`)}`,
    });
  }

  if (isQuotedEth(token)) {
    return sendPlan({
      caip2: SEPOLIA,
      asset: "slip44:60",
      symbol: "ETH",
      network: "Sepolia",
      amount,
      atomicAmount: params.atomicAmount,
      instructions: `MoonPay sandbox does not use ${quotedNetwork} ETH. ${depositInstructions(provider, providerLabel, `This sends ${amount} ETH on Sepolia.`)}`,
    });
  }

  const tokenAmount = toAtomicAmount(amount, 18);
  if (tokenAmount === undefined) {
    return {
      mode: "hold",
      complete: false,
      title: "Unable to price this sandbox deposit",
      instructions:
        "MoonPay sandbox delivers its Sepolia test token, MoonPayToken, instead of the quoted asset. Enter the amount again and retry.",
    };
  }

  return sendPlan({
    caip2: SEPOLIA,
    asset: `erc20:${MOONPAY_TOKEN}`,
    symbol: "MPT",
    network: "Sepolia",
    amount,
    atomicAmount: tokenAmount,
    instructions: `MoonPay sandbox does not use real ${symbol} on ${quotedNetwork}. ${depositInstructions(provider, providerLabel, `This sends ${amount} MoonPayToken (MPT) on Sepolia.`)}`,
  });
}

function depositInstructions(
  provider: v1FiatOnRampProvider,
  providerLabel: string,
  detail: string,
) {
  if (provider === "FIAT_ON_RAMP_PROVIDER_MOONPAY") {
    return `Finish the sale in MoonPay, then click Send with. The deposit address fills in here. You can paste it instead. ${detail}`;
  }
  return `Finish the sale in ${providerLabel}, then paste the deposit address and send the crypto. ${detail}`;
}

function applyReturnedAmount(
  plan: DepositPlan,
  returned: string | undefined,
): DepositPlan {
  if (plan.mode !== "send" || !returned) return plan;
  const atomic = toAtomicAmount(returned, decimalsForAsset(plan.asset));
  if (atomic === undefined || !positiveAtomic(atomic)) return plan;
  return sendPlan({
    caip2: plan.caip2,
    asset: plan.asset,
    symbol: plan.symbol,
    network: plan.network,
    amount: returned,
    atomicAmount: atomic,
    instructions: plan.instructions,
    rpcUrl: plan.rpcUrl,
  });
}

function decimalsForAsset(asset: string) {
  const normalized = asset.toLowerCase();
  if (
    normalized === "slip44:60" ||
    normalized === `erc20:${MOONPAY_TOKEN}` ||
    normalized.includes("0x7ceb23fd6bc0add59e62ac25578270cff1b9f619")
  ) {
    return 18;
  }
  if (normalized === "slip44:501") return 9;
  return 6;
}

function sendPlan(params: {
  caip2: string;
  asset: string;
  symbol: string;
  network: string;
  amount: string;
  atomicAmount: string;
  instructions: string;
  rpcUrl?: string | undefined;
}): DepositPlan {
  return {
    mode: "send",
    ...params,
    title: `Send ${params.amount} ${params.symbol} on ${params.network}`,
  };
}

function isQuotedEth(token: OnRampCaip19) {
  return token.endsWith("/slip44:60") || token.toLowerCase() === POLYGON_ETH;
}

function assetOf(token: string) {
  return token.slice(token.indexOf("/") + 1);
}

function networkLabel(caip2: string) {
  return NETWORK_LABELS[caip2] ?? caip2;
}

function isDepositAddress(caip2: string, value: string) {
  if (caip2.startsWith("eip155:")) return /^0x[0-9a-fA-F]{40}$/.test(value);
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function toAtomicAmount(value: string, decimals: number) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return undefined;
  const [whole = "0", fraction = ""] = trimmed.split(".");
  const digits = `${fraction}${"0".repeat(decimals)}`.slice(0, decimals);
  try {
    return BigInt(`${whole || "0"}${digits}`).toString();
  } catch {
    return undefined;
  }
}

function positiveAtomic(value: string) {
  return /^\d+$/.test(value) && BigInt(value) > 0n;
}

async function depositTransaction(params: {
  caip2: string;
  asset: string;
  quotedToken: OnRampCaip19;
  from: string;
  to: string;
  atomicAmount: string;
  rpcUrl?: string | undefined;
}): Promise<EthTransaction | SolanaTransaction> {
  const { caip2, asset, quotedToken, from, to, atomicAmount, rpcUrl } = params;

  if (caip2.startsWith("solana:")) {
    if (!rpcUrl) {
      throw new TurnkeyError(
        "A Solana RPC URL is required to send this asset. Pass rpcUrl to handleOffRamp.",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }
    const spl = asset.startsWith("token:");
    if (!spl && asset !== "slip44:501") {
      throw new TurnkeyError(
        "This token cannot be transferred.",
        TurnkeyErrorCodes.INVALID_REQUEST,
      );
    }
    const transfer: OnRampCryptoTransfer = spl
      ? {
          kind: "spl",
          transactionType: "TRANSACTION_TYPE_SOLANA",
          from,
          to,
          caip2: caip2 as OnRampCryptoTransfer["caip2"],
          caip19: quotedToken,
          amount: atomicAmount,
          mintAddress: asset.slice("token:".length),
        }
      : {
          kind: "native",
          transactionType: "TRANSACTION_TYPE_SOLANA",
          from,
          to,
          caip2: caip2 as OnRampCryptoTransfer["caip2"],
          caip19: quotedToken,
          amount: atomicAmount,
        };
    const unsignedTransaction = await buildUnsignedSolanaTransaction(
      transfer,
      rpcUrl,
    );
    return {
      unsignedTransaction,
      signWith: from,
      caip2,
    } as SolanaTransaction;
  }

  if (asset.startsWith("erc20:")) {
    return {
      from,
      to: asset.slice("erc20:".length),
      caip2,
      value: "0",
      data: encodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [to as Hex, BigInt(atomicAmount)],
      }),
    } as EthTransaction;
  }

  if (asset !== "slip44:60") {
    throw new TurnkeyError(
      "This token cannot be transferred.",
      TurnkeyErrorCodes.INVALID_REQUEST,
    );
  }

  return {
    from,
    to,
    caip2,
    value: atomicAmount,
  } as EthTransaction;
}
