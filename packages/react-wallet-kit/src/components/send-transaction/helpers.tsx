import { EthereumLogo, SolanaLogo } from "../design/Svg";

// CAIP-2 Solana references can be the 32-character reference, the full genesis
// hash, or a human-readable alias. The 32-character form is a prefix of the
// full hash, so a prefix match covers both.
const SOLANA_CLUSTERS = [
  {
    cluster: undefined,
    matches: ["solana:mainnet", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
  },
  {
    cluster: "devnet",
    matches: ["solana:devnet", "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"],
  },
  {
    cluster: "testnet",
    matches: ["solana:testnet", "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z"],
  },
] as const;

function solanaExplorerUrl(txHash: string, caip2: string): string {
  const match = SOLANA_CLUSTERS.find(({ matches }) =>
    matches.some((id) => caip2 === id || caip2.startsWith(id)),
  );

  if (!match || !match.cluster) {
    return `https://solscan.io/tx/${txHash}`;
  }

  return `https://solscan.io/tx/${txHash}?cluster=${match.cluster}`;
}

export function getExplorerUrl(txHash: string, caip2: string): string {
  if (caip2.startsWith("solana:")) {
    return solanaExplorerUrl(txHash, caip2);
  }

  switch (caip2) {
    case "eip155:8453":
      return `https://basescan.org/tx/${txHash}`;
    case "eip155:84532":
      return `https://sepolia.basescan.org/tx/${txHash}`;
    case "eip155:1":
      return `https://etherscan.io/tx/${txHash}`;
    case "eip155:11155111":
      return `https://sepolia.etherscan.io/tx/${txHash}`;
    case "eip155:137":
      return `https://polygonscan.com/tx/${txHash}`;
    default:
      return `https://etherscan.io/tx/${txHash}`;
  }
}

export function getChainLogo(caip2: string): React.ReactNode {
  const Logo = caip2.startsWith("solana:") ? SolanaLogo : EthereumLogo;

  return <Logo className="h-10 w-10 rounded-full" />;
}
