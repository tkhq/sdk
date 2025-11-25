import { Address, createPublicClient, http, parseAbi } from "viem";


// Default RPC Mapping Per CAIP-2 Chain
export const DEFAULT_RPC_BY_CHAIN: Record<string, string> = {
  "eip155:8453": "https://mainnet.base.org",
  "eip155:84532": "https://sepolia.base.org",
  "eip155:1": "https://ethereum.publicnode.com",
  "eip155:11155111": "https://ethereum-sepolia.publicnode.com",
};

// Gas Station Contract Mapping
export const GAS_STATION_BY_CHAIN: Record<string, Address> = {
  "eip155:8453": "0x4ece92b06C7d2d99d87f052E0Fca47Fb180c3348",      // Base mainnet
  "eip155:84532": "0x1aCb40d1d1B5447A51D28b7a38f306d32DA960fb",      // Base Sepolia
};

// ABI (pre-parsed for performance)
export const GAS_STATION_ABI = parseAbi([
  "function getNonce(address _targetEoA) view returns (uint128)",
]);

// Fetch EOA nonce (pending)
export async function fetchEoaNonce({
  rpcUrl,
  from,
}: {
  rpcUrl: string;
  from: Address;
}) {
  const client = createPublicClient({ transport: http(rpcUrl) });
  const nonce = await client.getTransactionCount({
    address: from,
    blockTag: "pending",
  });
  return nonce.toString();
}

// Fetch Gas Station nonce (first time defaults to 0)
export async function fetchGasStationNonce({
  rpcUrl,
  chain,
  from,
}: {
  rpcUrl: string;
  chain: string;
  from: Address;
}) {
  const gasStationAddress = GAS_STATION_BY_CHAIN[chain];
  if (!gasStationAddress) {
    throw new Error(`No Gas Station contract defined for chain '${chain}'`);
  }

  const client = createPublicClient({ transport: http(rpcUrl) });

  try {
    const result = await client.readContract({
      address: gasStationAddress,
      abi: GAS_STATION_ABI,
      functionName: "getNonce",
      args: [from],
    });

    return result.toString();
  } catch (err) {
    return "0";
  }
}

// Auto Deadline Generator (1 hour default)
export function getAutoDeadlineMs(hours = 1) {
  return Math.floor(Date.now() / 1000) + hours * 3600;
}


// Combined Nonce Helper
export async function generateNonces({
  from,
  caip2,
  sponsor,
  rpcUrl,
  providedNonce,
  providedGasStationNonce,
}: {
  from: Address;
  caip2: string;
  sponsor?: boolean;
  rpcUrl: string;
  providedNonce?: string;
  providedGasStationNonce?: string;
}) {
  // Always get EOA nonce if missing
  const nonce =
    providedNonce ??
    (await fetchEoaNonce({
      rpcUrl,
      from,
    }));

  // Gas Station nonce only when sponsoring
  const gasStationNonce = sponsor
    ? providedGasStationNonce ??
      (await fetchGasStationNonce({
        rpcUrl,
        chain: caip2,
        from,
      }))
    : undefined;

  return { nonce, gasStationNonce };
}
