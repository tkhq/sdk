import { TurnkeyApi } from "@turnkey/http";
import bs58 from "bs58";

/**
 * Calls the Turnkey API with `privateKeyId` and derives a Solana address.
 * @param privateKeyId Turnkey Private key ID
 * @returns string
 */
export async function deriveSolanaAddress(
  privateKeyId: string
): Promise<string> {
  const keyInfo = await TurnkeyApi.getPrivateKey({
    body: {
      organizationId: process.env.ORGANIZATION_ID!,
      privateKeyId,
    },
  });

  const publicKey = keyInfo.privateKey.publicKey;
  const address = bs58.encode(Buffer.from(publicKey, "hex"));
  return address;
}
