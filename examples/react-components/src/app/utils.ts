import { PublicKey, PublicKeyInitData } from "@solana/web3.js";
import nacl from "tweetnacl";
import { Buffer } from "buffer";

import { hashMessage, keccak256, recoverAddress, toUtf8Bytes } from "ethers";

/**
 * Verifies an Ethereum signature and returns the address it was signed with.
 * @param {string} message - The original message that was signed.
 * @param {string} r - The r value of the signature.
 * @param {string} s - The s value of the signature.
 * @param {string} v - The v value of the signature.
 * @param {string} address - The Ethereum address of the signer.
 * @returns {boolean} - The recovered Ethereum address.
 */
export function verifyEthSignatureWithAddress(
  message: string,
  r: string,
  s: string,
  v: string,
  address: string,
): boolean {
  try {
    // Construct the full signature
    const signature = `0x${r}${s}${v === "00" ? "1b" : "1c"}`; // 1b/1c corresponds to v for Ethereum
    const hashedMessage = keccak256(toUtf8Bytes(message));

    // Recover the address from the signature
    return address == recoverAddress(hashedMessage, signature);
  } catch (error) {
    console.error("Ethereum signature verification failed:", error);
    return false;
  }
}

/**
 * Verifies a Solana signature using the address (treated as the public key).
 * @param {string} message - The original message that was signed.
 * @param {string} r - The r value of the signature.
 * @param {string} s - The s value of the signature.
 * @param {string} address - The Solana address of the signer.
 * @returns {boolean} - True if the signature is valid, false otherwise.
 */
export function verifySolSignatureWithAddress(
  message: string,
  r: string,
  s: string,
  address: string,
) {
  try {
    // Combine r and s as the full signature (64 bytes for Solana)
    const signature = Buffer.from(r + s, "hex");

    // Convert the message to a buffer
    const messageBuffer = Buffer.from(message);

    // Treat the address as the public key (if valid)
    const pubKey = new PublicKey(address);

    // Verify the signature
    return nacl.sign.detached.verify(
      messageBuffer,
      signature,
      pubKey.toBytes(),
    );
  } catch (error) {
    console.error("Solana signature verification failed:", error);
    return false;
  }
}
