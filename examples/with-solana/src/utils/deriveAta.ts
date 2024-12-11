import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

export function getAssociatedTokenAddress(mintAddress: string, walletAddress:string) {
    const mintPublicKey = new PublicKey(mintAddress);
    const walletPublicKey = new PublicKey(walletAddress);

    const associatedTokenAddress = getAssociatedTokenAddressSync(
        mintPublicKey,
        walletPublicKey
    );

    return associatedTokenAddress.toString();
}