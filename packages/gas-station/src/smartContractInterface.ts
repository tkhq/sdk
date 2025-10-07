import type { TurnkeyApiClient } from "@turnkey/sdk-server";
import { gasStationAbi } from "./abi/gas-station";

// In-memory cache to avoid repeated API calls within the same session
const interfaceCache = new Map<string, string>();

/**
 * Generates a cache key for a smart contract interface lookup.
 */
function getCacheKey(organizationId: string, contractAddress: string): string {
  return `${organizationId}:${contractAddress.toLowerCase()}`;
}

/**
 * Retrieves an existing smart contract interface for the given contract address.
 * Returns the interface ID if found, undefined otherwise.
 */
export async function getSmartContractInterface(
  client: TurnkeyApiClient,
  organizationId: string,
  contractAddress: `0x${string}`,
): Promise<string | undefined> {
  const cacheKey = getCacheKey(organizationId, contractAddress);

  // Check cache first
  if (interfaceCache.has(cacheKey)) {
    return interfaceCache.get(cacheKey);
  }

  // Query Turnkey for existing interfaces
  const response = await client.getSmartContractInterfaces({
    organizationId,
  });

  // Find interface matching the contract address (case-insensitive)
  const normalizedAddress = contractAddress.toLowerCase();
  const existingInterface = response.smartContractInterfaces.find(
    (iface: {
      smartContractAddress: string;
      smartContractInterfaceId: string;
    }) => iface.smartContractAddress.toLowerCase() === normalizedAddress,
  );

  if (existingInterface) {
    const interfaceId = existingInterface.smartContractInterfaceId;
    interfaceCache.set(cacheKey, interfaceId);
    return interfaceId;
  }

  return undefined;
}

/**
 * Uploads the Gas Station ABI to Turnkey as a Smart Contract Interface.
 * Returns the newly created interface ID.
 */
export async function uploadGasStationInterface(
  client: TurnkeyApiClient,
  organizationId: string,
  contractAddress: `0x${string}`,
  label?: string,
  chainName?: string,
): Promise<string> {
  const defaultLabel = chainName
    ? `Gas Station - ${chainName}`
    : `Gas Station - ${contractAddress}`;

  const result = await client.createSmartContractInterface({
    organizationId,
    type: "SMART_CONTRACT_INTERFACE_TYPE_ETHEREUM",
    label: label || defaultLabel,
    notes: `EIP-7702 Gas Station execution contract ABI. Automatically uploaded by @turnkey/gas-station SDK.`,
    smartContractAddress: contractAddress,
    smartContractInterface: JSON.stringify(gasStationAbi),
  });

  const interfaceId =
    result.activity.result.createSmartContractInterfaceResult
      ?.smartContractInterfaceId;

  if (!interfaceId) {
    throw new Error(
      "Failed to create smart contract interface: no interface ID returned",
    );
  }

  // Cache the result
  const cacheKey = getCacheKey(organizationId, contractAddress);
  interfaceCache.set(cacheKey, interfaceId);

  return interfaceId;
}

/**
 * Ensures that a Gas Station ABI is registered with Turnkey for the given contract.
 * Checks if an interface already exists; if not, uploads it automatically.
 * Returns the interface ID (existing or newly created).
 *
 * This function is called automatically by policy builders to enable ABI-based
 * policy conditions that can directly access and compare function arguments.
 *
 * @param client - Turnkey API client (from turnkeySDK.apiClient())
 * @param organizationId - Turnkey organization ID
 * @param contractAddress - Gas station contract address
 * @param label - Optional custom label for the interface
 * @param chainName - Optional chain name for labeling (e.g., "Base Mainnet")
 * @returns The smart contract interface ID
 *
 * @example
 * const interfaceId = await ensureGasStationInterface(
 *   turnkeyClient.apiClient(),
 *   "org-123",
 *   "0x576A4D741b96996cc93B4919a04c16545734481f",
 *   undefined,
 *   "Base Sepolia"
 * );
 */
export async function ensureGasStationInterface(
  client: TurnkeyApiClient,
  organizationId: string,
  contractAddress: `0x${string}`,
  label?: string,
  chainName?: string,
): Promise<string> {
  // Check if interface already exists
  const existingId = await getSmartContractInterface(
    client,
    organizationId,
    contractAddress,
  );

  if (existingId) {
    return existingId;
  }

  // Upload new interface
  return uploadGasStationInterface(
    client,
    organizationId,
    contractAddress,
    label,
    chainName,
  );
}
