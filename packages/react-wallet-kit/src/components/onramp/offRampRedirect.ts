import type {
  OnRampCaip19,
  StamperType,
  v1FiatOnRampProvider,
  WalletAccount,
} from "@turnkey/core";

export const OFFRAMP_POPUP_NAME = "turnkey-offramp";
export const OFFRAMP_DEPOSIT_MESSAGE = "turnkey:offramp-deposit";

const STORAGE_KEY = "tk-offramp-deposit";
const MOONPAY_PARAMS = [
  "transactionId",
  "baseCurrencyCode",
  "baseCurrencyAmount",
  "transactionStatus",
  "depositWalletAddress",
  "depositWalletAddressTag",
  "externalTransactionId",
] as const;

export type MoonPayDeposit = {
  address: string;
  amount?: string;
  tag?: string;
};

export type OffRampDepositMessage = {
  type: typeof OFFRAMP_DEPOSIT_MESSAGE;
  deposit: MoonPayDeposit;
};

export type OffRampHandoff = {
  token: OnRampCaip19;
  amount: string;
  atomicAmount: string;
  provider: v1FiatOnRampProvider;
  organizationId?: string;
  stampWith?: StamperType;
  rpcUrl?: string;
  sandboxMode?: boolean;
  successPageDuration?: number;
  walletAccount: WalletAccount;
};

export function offrampRedirectUrl(options?: {
  provider?: v1FiatOnRampProvider;
}): string | undefined {
  if (typeof window === "undefined") return undefined;
  const url = new URL(window.location.href);
  url.hash = "";
  for (const key of MOONPAY_PARAMS) url.searchParams.delete(key);

  // Coinbase checks this host against the CDP domain allowlist. Send the
  // origin only so the allowlist entry is the site, not a path or query.
  if (options?.provider === "FIAT_ON_RAMP_PROVIDER_COINBASE") {
    return url.origin;
  }

  return url.toString();
}

export function moonPayDeposit(href: string): MoonPayDeposit | undefined {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return undefined;
  }
  const address = url.searchParams.get("depositWalletAddress")?.trim();
  if (!address) return undefined;
  const amount = url.searchParams.get("baseCurrencyAmount")?.trim();
  const tag = url.searchParams.get("depositWalletAddressTag")?.trim();
  return {
    address,
    ...(amount ? { amount } : {}),
    ...(tag ? { tag } : {}),
  };
}

export function isOffRampDepositMessage(
  data: unknown,
): data is OffRampDepositMessage {
  if (!data || typeof data !== "object") return false;
  const message = data as Partial<OffRampDepositMessage>;
  return (
    message.type === OFFRAMP_DEPOSIT_MESSAGE &&
    !!message.deposit &&
    typeof message.deposit.address === "string" &&
    message.deposit.address.length > 0
  );
}

function persistHandoff(value: string) {
  // localStorage is shared with the popup. sessionStorage is copied into a
  // window only at the moment it opens, so it misses a later write.
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // The return page falls back to the paste field when storage is blocked.
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Ignore storage failures.
  }
}

function storedHandoff(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value) return value;
  } catch {
    // Fall through to sessionStorage.
  }
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveOffRampHandoff(handoff: OffRampHandoff) {
  const account = handoff.walletAccount;
  const stored: OffRampHandoff = {
    ...handoff,
    walletAccount: {
      address: account.address,
      addressFormat: account.addressFormat,
      source: "source" in account ? account.source : undefined,
    } as WalletAccount,
  };
  persistHandoff(JSON.stringify(stored));
}

export function readOffRampHandoff(): OffRampHandoff | undefined {
  try {
    const raw = storedHandoff();
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<OffRampHandoff>;
    if (!parsed.token || !parsed.walletAccount?.address || !parsed.provider) {
      return undefined;
    }
    return parsed as OffRampHandoff;
  } catch {
    return undefined;
  }
}

export function clearOffRampHandoff() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function stripMoonPayReturnParams() {
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of MOONPAY_PARAMS) {
    if (!url.searchParams.has(key)) continue;
    url.searchParams.delete(key);
    changed = true;
  }
  if (!changed) return;
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
}
