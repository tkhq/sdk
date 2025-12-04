import { Address, createPublicClient, http } from "viem";
import { EthereumLogo, SolanaLogo } from "../design/Svg";
export const DEFAULT_RPC_BY_CHAIN: Record<string, string> = {
  "eip155:8453": "https://mainnet.base.org",
  "eip155:84532": "https://sepolia.base.org",
  "eip155:1": "https://ethereum.publicnode.com",
  "eip155:11155111": "https://ethereum-sepolia.publicnode.com",
};

export async function fetchEoaNonce({
  rpcUrl,
  from,
}: {
  rpcUrl: string;
  from: Address;
}): Promise<string> {
  const client = createPublicClient({ transport: http(rpcUrl) });
  const nonce = await client.getTransactionCount({
    address: from,
    blockTag: "pending",
  });
  return nonce.toString();
}

export async function generateNonces({
  from,
  rpcUrl,
  providedNonce,
}: {
  from: Address;
  rpcUrl: string;
  providedNonce?: string | undefined;
}) {
  const nonce =
    providedNonce ??
    (await fetchEoaNonce({
      rpcUrl,
      from,
    }));

  return { nonce };
}

export function getExplorerUrl(txHash: string, caip2: string): string {
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
