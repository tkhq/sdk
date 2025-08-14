import {
  findSwigPda
} from "@swig-wallet/classic";

/**
 * Generate a SWIG address from the wallet id
 * @param walletUUId Wallet id to generate the swig
 * @returns Generated SWIG address as string
 */
export function generateSwigAddress(walletUUId: string): [string, Uint8Array] {
  // Remove hyphens from UUID and convert to Uint8Array byte array
  const cleanUUID = walletUUId.replace(/-/g, '');
  const idBytes = new TextEncoder().encode(cleanUUID);
  
  // Use findSwigPda with the byte array
  const swigAddress = findSwigPda(idBytes);
  
  return [swigAddress.toBase58(), idBytes];
}
