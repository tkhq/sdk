import { EthereumLogo, SolanaLogo } from "../design/Svg";

export function getExplorerUrl(txHash: string, caip2: string): string {
  switch (caip2) {
    case "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp":
      return `https://solscan.io/tx/${txHash}`;
    case "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG":
      return `https://solscan.io/tx/${txHash}?cluster=devnet`;
    case "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY":
      return `https://solscan.io/tx/${txHash}?cluster=testnet`;
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
      return caip2.startsWith("solana:")
        ? `https://solscan.io/tx/${txHash}`
        : `https://etherscan.io/tx/${txHash}`;
  }
}

export function getChainLogo(caip2: string): React.ReactNode {
  const Logo = caip2.startsWith("solana:") ? SolanaLogo : EthereumLogo;

  return <Logo className="h-10 w-10 rounded-full" />;
}
