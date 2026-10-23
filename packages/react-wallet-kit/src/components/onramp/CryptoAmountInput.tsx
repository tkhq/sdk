import { Input } from "@headlessui/react";
import type { OnRampCaip19 } from "@turnkey/core";
import { useEffect, useMemo, useRef } from "react";
import { useSupportedAssets } from "../../providers/SupportedAssetsProvider";
import { caip2Of, tokenDecimals } from "../../utils/onramp";
import { sanitizeAmount } from "./FiatAmountInput";
import { TokenLogo, TokenSelect } from "./TokenSelect";

export type CryptoAmountInputProps = {
  value: string;
  onChange: (value: string) => void;
  token: OnRampCaip19;
  tokens: OnRampCaip19[];
  onTokenChange?: (token: OnRampCaip19) => void;
  locked?: boolean;
};

export function CryptoAmountInput(props: CryptoAmountInputProps) {
  const { value, onChange, token, tokens, onTokenChange, locked } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const { assetsByCaip2, ensureAssets } = useSupportedAssets();
  const chain = caip2Of(token);
  const decimals = useMemo(
    () => tokenDecimals(token, assetsByCaip2),
    [assetsByCaip2, token],
  );

  useEffect(() => {
    ensureAssets([chain]);
  }, [chain, ensureAssets]);

  useEffect(() => {
    const next = sanitizeAmount(value, decimals);
    if (next !== value) onChange(next);
  }, [decimals, value, onChange]);

  return (
    <div
      className="flex w-full cursor-text items-end justify-center gap-1.5 bg-transparent px-4 py-4 text-inherit"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="relative max-w-full pb-0.5">
        <span className="pointer-events-none absolute top-0 right-full pr-0.5">
          <TokenLogo
            token={token}
            assetsByCaip2={assetsByCaip2}
            className="size-3.5"
          />
        </span>
        <span className="invisible whitespace-pre px-0.5 text-6xl font-bold">
          {value || "0"}
        </span>
        <Input
          ref={inputRef}
          data-testid="crypto-amount-input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value || "0"}
          onChange={(event) =>
            onChange(sanitizeAmount(event.target.value, decimals))
          }
          className="absolute inset-0 w-full border-none bg-transparent p-0 text-center text-6xl font-bold text-inherit focus:outline-none focus:ring-0"
        />
      </div>
      <div className="pb-1" onClick={(event) => event.stopPropagation()}>
        <TokenSelect
          tokens={tokens}
          value={token}
          {...(onTokenChange ? { onChange: onTokenChange } : {})}
          locked={locked ?? false}
          trigger="symbol"
        />
      </div>
    </div>
  );
}
