import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

/**
   * This function derives a Solana associated token address for a given Solana wallet address, related to a particular token mint address
   *
   * @param walletAddress string representation of the Solana wallet address (base58 encoded)
   * @param mintAddress string representation of the token mint address (base58 encoded)
   */
export function getAssociatedTokenAddress(mintAddress: string, walletAddress: string) {
    const mintPublicKey = new PublicKey(mintAddress);
    const walletPublicKey = new PublicKey(walletAddress);
  
    const associatedTokenAddress = getAssociatedTokenAddressSync(
      mintPublicKey,
      walletPublicKey
    );
  
    return associatedTokenAddress.toString();
}
  