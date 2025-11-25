import { Address, createPublicClient, http } from "viem";

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

export function getAutoDeadlineMs(hours = 1): string {
  return (Math.floor(Date.now() / 1000) + hours * 3600).toString();
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
