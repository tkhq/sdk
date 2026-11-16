import {
  OnRampCaip19Values,
  type OnRampCaip19,
  type OnRampCaip2,
  type WalletAccount,
} from "@turnkey/core";
import { caip2Of } from "./tokenSymbol";

export function onRampTokensForAccount(
  walletAccount?: WalletAccount | undefined,
  locked?: {
    caip19?: OnRampCaip19 | undefined;
    caip2?: OnRampCaip2 | undefined;
  },
): OnRampCaip19[] {
  if (locked?.caip19) return [locked.caip19];

  let tokens: readonly OnRampCaip19[] = OnRampCaip19Values;
  if (walletAccount?.addressFormat === "ADDRESS_FORMAT_ETHEREUM") {
    tokens = tokens.filter((token) => caip2Of(token).startsWith("eip155:"));
  } else if (walletAccount?.addressFormat === "ADDRESS_FORMAT_SOLANA") {
    tokens = tokens.filter((token) => caip2Of(token).startsWith("solana:"));
  }

  if (locked?.caip2) {
    tokens = tokens.filter((token) => caip2Of(token) === locked.caip2);
  }

  return [...tokens];
}
