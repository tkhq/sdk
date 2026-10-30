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
import { caip2Of, chainLabel, tokenSymbol } from "../../utils/funding";

type Placement = "top start" | "bottom start";
const desiredPanelHeight = 288;

export type TokenSelectTrigger = "row" | "symbol";

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
  // TODO (Amir): This might be too weird. Maybe just componantize the inner list box options
  /** "row" sits under the cash amount. "symbol" sits beside a crypto amount, like the currency code. */
  trigger?: TokenSelectTrigger;
};

export function TokenSelect(props: TokenSelectProps) {
  const { tokens, value, onChange, amount, locked, trigger = "row" } = props;
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
        trigger={trigger}
      />
    );
  }

  if (trigger === "symbol") {
    return (
      <span className="text-lg font-bold leading-none">
        {tokenSymbol(value, assetsByCaip2)}
      </span>
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
  trigger: TokenSelectTrigger;
}) {
  const { tokens, value, onChange, amount, assetsByCaip2, trigger } = props;
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
          className={clsx(
            "flex cursor-pointer items-center border-none bg-transparent p-0 text-inherit focus:outline-none",
            trigger === "symbol" && "gap-1",
          )}
        >
          {trigger === "symbol" ? (
            <>
              <span className="text-lg font-bold leading-none">
                {tokenSymbol(value, assetsByCaip2)}
              </span>
              <FontAwesomeIcon
                icon={faChevronDown}
                className="size-3 shrink-0 text-icon-text-light dark:text-icon-text-dark"
              />
            </>
          ) : (
            <TokenRow
              token={value}
              amount={amount}
              assetsByCaip2={assetsByCaip2}
              showChevron
            />
          )}
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
                  className={({ focus }) =>
                    clsx(
                      "cursor-pointer select-none py-2 px-3 bg-button-light dark:bg-button-dark flex items-center gap-2",
                      focus &&
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

export function TokenLogo(props: {
  token: OnRampCaip19;
  assetsByCaip2: Record<string, v1AssetMetadata[]>;
  className?: string;
}) {
  const { token, assetsByCaip2, className = "size-4" } = props;
  const logoUrl = assetsByCaip2[caip2Of(token)]?.find(
    (asset) => asset.caip19 === token,
  )?.logoUrl;

  if (!logoUrl) {
    return (
      <span
        className={clsx(
          "shrink-0 rounded-full bg-icon-background-light dark:bg-icon-background-dark",
          className,
        )}
      />
    );
  }

  return (
    <img
      src={logoUrl}
      alt=""
      className={clsx("shrink-0 rounded-full", className)}
    />
  );
}
