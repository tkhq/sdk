import { EIP1193Provider } from "viem";
import type { Wallet as SWSWallet } from "@wallet-standard/base";
import { WalletRpcProvider } from "./types";

export function asEip1193(p: WalletRpcProvider): EIP1193Provider {
  if (p && typeof (p as any).request === "function") {
    return p as EIP1193Provider;
  }

  throw new Error("Expected an EIP-1193 provider (Ethereum wallet)");
}

export function asSolana(p: WalletRpcProvider): SWSWallet {
  if (p && "features" in p && "solana:signMessage" in (p as any).features) {
    return p as SWSWallet;
  }

  throw new Error("Expected a Wallet-Standard provider (Solana wallet)");
}
