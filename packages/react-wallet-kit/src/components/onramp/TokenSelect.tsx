import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";
import type { OnRampCaip19, v1AssetMetadata } from "@turnkey/core";
import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSupportedAssets } from "../../providers/SupportedAssetsProvider";
import { useScreenSize } from "../../utils/utils";
import { caip2Of, tokenSymbol } from "./tokenSymbol";

type Placement = "top start" | "bottom start";
const desiredPanelHeight = 288;

const chainLabels: Record<string, string> = {
  "eip155:1": "Ethereum",
  "eip155:10": "Optimism",
  "eip155:137": "Polygon",
  "eip155:8453": "Base",
  "eip155:42161": "Arbitrum",
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "Solana",
};

function chainLabel(caip2: string): string {
  return chainLabels[caip2] ?? caip2;
}

function groupOnRampTokens(tokens: OnRampCaip19[]) {
  const order: string[] = [];
  const byChain = new Map<string, OnRampCaip19[]>();

  for (const token of tokens) {
    const caip2 = caip2Of(token);
    const list = byChain.get(caip2);
    if (list) {
      list.push(token);
    } else {
      order.push(caip2);
      byChain.set(caip2, [token]);
    }
  }

  return order.map((caip2) => ({
    caip2,
    label: chainLabel(caip2),
    tokens: byChain.get(caip2)!,
  }));
}

export type TokenSelectProps = {
  tokens: OnRampCaip19[];
  value: OnRampCaip19;
  onChange?: (token: OnRampCaip19) => void;
  amount?: string | undefined;
  locked?: boolean;
};

export function TokenSelect(props: TokenSelectProps) {
  const { tokens, value, onChange, amount, locked } = props;
  const selectable = !locked && !!onChange;
  const { assetsByCaip2, ensureAssets } = useSupportedAssets();
  const chains = tokens.map(caip2Of).join(",");

  useEffect(() => {
    ensureAssets([...new Set(tokens.map(caip2Of))]);
  }, [chains, ensureAssets, tokens]);

  if (selectable && onChange) {
    return (
      <SelectableToken
        tokens={tokens}
        value={value}
        onChange={onChange}
        amount={amount}
        assetsByCaip2={assetsByCaip2}
      />
    );
  }

  return (
    <TokenRow token={value} amount={amount} assetsByCaip2={assetsByCaip2} />
  );
}

function SelectableToken(props: {
  tokens: OnRampCaip19[];
  value: OnRampCaip19;
  onChange: (token: OnRampCaip19) => void;
  amount?: string | undefined;
  assetsByCaip2: Record<string, v1AssetMetadata[]>;
}) {
  const { tokens, value, onChange, amount, assetsByCaip2 } = props;
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [placement, setPlacement] = useState<Placement>("bottom start");
  const { height } = useScreenSize();

  const update = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;

    const bounds = btn.getBoundingClientRect();
    const spaceAbove = bounds.top;
    const spaceBelow = height - bounds.bottom;
    setPlacement(
      spaceBelow < desiredPanelHeight && spaceAbove > spaceBelow
        ? "top start"
        : "bottom start",
    );
  }, [height]);

  useEffect(() => {
    update();
  }, [update, height]);

  return (
    <Listbox<"div", OnRampCaip19> as="div" value={value} onChange={onChange}>
      <div className="relative">
        <ListboxButton
          ref={buttonRef}
          data-testid="onramp-token-select"
          className="flex cursor-pointer items-center border-none bg-transparent p-0 text-inherit focus:outline-none"
        >
          <TokenRow
            token={value}
            amount={amount}
            assetsByCaip2={assetsByCaip2}
            showChevron
          />
        </ListboxButton>
        <ListboxOptions
          transition
          anchor={placement}
          className="absolute tk-scrollbar z-50 mt-1 w-52 border border-modal-background-dark/20 dark:border-modal-background-light/20 !max-h-72 rounded-md shadow-lg overflow-y-auto overflow-x-hidden text-sm transition duration-200 ease-out data-closed:-translate-y-2 data-closed:opacity-0"
        >
          {groupOnRampTokens(tokens).map((group, index) => (
            <div key={group.caip2}>
              <div
                className={clsx(
                  "px-3 pb-1 text-xs font-medium text-icon-text-light dark:text-icon-text-dark  bg-button-light dark:bg-button-dark",
                  index === 0 ? "pt-2" : "pt-3",
                )}
              >
                {group.label}:
              </div>
              {group.tokens.map((token) => (
                <ListboxOption
                  key={token}
                  value={token}
                  className={({ active }) =>
                    clsx(
                      "cursor-pointer select-none py-2 px-3 bg-button-light dark:bg-button-dark flex items-center gap-2",
                      active &&
                        "bg-modal-background-light dark:bg-modal-background-dark",
                    )
                  }
                >
                  <TokenLogo token={token} assetsByCaip2={assetsByCaip2} />
                  <span>{tokenSymbol(token, assetsByCaip2)}</span>
                </ListboxOption>
              ))}
            </div>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}

function TokenRow(props: {
  token: OnRampCaip19;
  amount?: string | undefined;
  assetsByCaip2: Record<string, v1AssetMetadata[]>;
  showChevron?: boolean;
}) {
  const { token, amount, assetsByCaip2, showChevron } = props;

  return (
    <span className="flex items-center gap-1.5 text-sm">
      <TokenLogo token={token} assetsByCaip2={assetsByCaip2} />
      {amount && <span>{amount}</span>}
      <span className="font-medium">{tokenSymbol(token, assetsByCaip2)}</span>
      {showChevron && (
        <FontAwesomeIcon
          icon={faChevronDown}
          className="size-2.5 shrink-0 text-icon-text-light dark:text-icon-text-dark"
        />
      )}
    </span>
  );
}

function TokenLogo(props: {
  token: OnRampCaip19;
  assetsByCaip2: Record<string, v1AssetMetadata[]>;
}) {
  const { token, assetsByCaip2 } = props;
  const logoUrl = assetsByCaip2[caip2Of(token)]?.find(
    (asset) => asset.caip19 === token,
  )?.logoUrl;

  if (!logoUrl) {
    return (
      <span className="size-4 shrink-0 rounded-full bg-icon-background-light dark:bg-icon-background-dark" />
    );
  }

  return <img src={logoUrl} alt="" className="size-4 shrink-0 rounded-full" />;
}
